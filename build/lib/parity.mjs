import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, posix, relative } from 'node:path';
import { ActionMetadataRefusal, actionDefaults } from './action-yml.mjs';
import { ACTION_FILE, COPY_FILE } from './layout.mjs';
import { createScratch, snapshotDirectory } from './scratch.mjs';
import { runScriptAsync } from './surfaces.mjs';
import { VECTOR_FILE, VectorRefusal, actionInputsFor, maskPackageVersion, parseVectors } from './vectors.mjs';

const PACKAGE_BIN = 'evals-baseline';
const SURFACES = ['package', 'copy', 'action'];
const USAGE_ERROR_CODE = 2;
const FENCE_OPENER = /^::stop-commands::(\S+)$/;
const ANNOTATION = /^::(warning|error) title=evals-baseline::(.*)$/;
const SUMMARY = /^evals-baseline: (?:no findings$|(\d+) findings?; )/;
const WARNING_ONLY_SUMMARY = /^evals-baseline: \d+ findings?; warning only, exit 0 \(pass --strict to exit 1\)$/;

export class ParityRefusal extends Error {}

export const isRefusal = (error) =>
  error instanceof ParityRefusal || error instanceof VectorRefusal || error instanceof ActionMetadataRefusal;

const pluralise = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const escapeData = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

function labelOf(root, path) {
  const inside = relative(root, path);
  return inside.startsWith('..') ? path : inside;
}

function readRequired(root, path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) throw new ParityRefusal(`${path} is missing`);
  return readFileSync(absolute, 'utf8');
}

function requireScript(root, path) {
  if (!existsSync(path)) throw new ParityRefusal(`${labelOf(root, path)} is missing`);
  return path;
}

function binOf(root) {
  let manifest;
  try {
    manifest = JSON.parse(readRequired(root, 'package.json'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new ParityRefusal('package.json is not JSON');
    throw error;
  }
  const bin = manifest.bin?.[PACKAGE_BIN];
  if (typeof bin !== 'string') throw new ParityRefusal(`package.json declares no bin named ${PACKAGE_BIN}`);
  return bin;
}

function loadInputs({ root, distDir }) {
  const bin = binOf(root);
  const { vectors, files } = parseVectors(readRequired(root, VECTOR_FILE));
  return {
    vectors,
    files,
    defaults: actionDefaults(readRequired(root, 'action.yml')),
    scripts: {
      package: requireScript(root, join(root, bin)),
      copy: requireScript(root, join(distDir, COPY_FILE)),
      action: requireScript(root, join(distDir, ACTION_FILE)),
    },
  };
}

function installedScripts(scratch, scripts) {
  const installed = {};
  for (const [surface, path] of Object.entries(scripts)) {
    if (surface === 'package') {
      installed.package = path;
      continue;
    }
    const folder = join(scratch.directory, 'installed', surface);
    mkdirSync(folder, { recursive: true });
    installed[surface] = join(folder, posix.basename(path));
    copyFileSync(path, installed[surface]);
  }
  return installed;
}

const linesOf = (text) => {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

const isTerminated = (text) => text === '' || text.endsWith('\n');
const show = (line) => (line === undefined ? 'nothing' : JSON.stringify(line));

function streamProblem({ id, surface, stream, expected, actual, terminated }) {
  for (let index = 0; index < Math.max(actual.length, expected.length); index += 1) {
    if (actual[index] !== expected[index]) {
      return `parity: ${id}: ${surface}: ${stream} line ${index + 1}: ${surface} prints ${show(actual[index])}, the vector has ${show(expected[index])}`;
    }
  }
  return terminated ? null : `parity: ${id}: ${surface}: ${stream} does not end with a newline`;
}

function fileProblems({ vector, surface, before, after }) {
  const { id, dir, writes } = vector;
  const declared = new Map(writes.map(({ path, content }) => [path, sha256(content)]));
  const named = (path) => posix.relative(dir, path);
  const problems = [];
  for (const [path, digest] of declared) {
    if (after[path] === undefined) problems.push(`parity: ${id}: ${surface}: did not write ${named(path)}, which the vector lists`);
    else if (after[path] !== digest) problems.push(`parity: ${id}: ${surface}: wrote ${named(path)} with other content than the vector`);
  }
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((path) => before[path] !== after[path]).sort();
  for (const path of changed.filter((name) => !declared.has(name))) {
    problems.push(`parity: ${id}: ${surface}: ${after[path] === undefined ? 'removed' : 'wrote'} ${named(path)}, which the vector does not list`);
  }
  return problems;
}

const countedFindings = (report) => {
  const match = SUMMARY.exec(report.at(-1) ?? '');
  return match === null ? null : Number(match[1] ?? 0);
};

function fenceOf(vector, lines) {
  if (vector.stdout.length === 0) return { report: lines, tail: [], tailStart: 0 };
  const opener = FENCE_OPENER.exec(lines[0] ?? '');
  const prefix = `parity: ${vector.id}: action: stdout line`;
  if (opener === null) return { problem: `${prefix} 1: action prints ${show(lines[0])}, the report must open with ::stop-commands::<token>` };
  const closer = `::${opener[1]}::`;
  const closerIndex = 1 + vector.stdout.length;
  if (lines[closerIndex] !== closer) {
    return { problem: `${prefix} ${closerIndex + 1}: action prints ${show(lines[closerIndex])}, the report must close with ${closer}` };
  }
  return { report: lines.slice(1, closerIndex), tail: lines.slice(closerIndex + 1), tailStart: closerIndex + 2 };
}

function annotationProblems({ vector, strict, tail, tailStart }) {
  const { id, stdout: report, code } = vector;
  const problems = [];
  const severities = [];
  let from = 0;
  tail.forEach((line, offset) => {
    const where = `parity: ${id}: action: stdout line ${tailStart + offset}`;
    const parsed = ANNOTATION.exec(line);
    if (parsed === null) {
      problems.push(`${where}: action prints ${show(line)}, which is no annotation`);
      return;
    }
    const found = report.findIndex((text, index) => index >= from && escapeData(text) === parsed[2]);
    if (found === -1) {
      problems.push(`${where}: action annotates ${show(parsed[2])}, which is no line of the report after the previous annotation`);
      return;
    }
    from = found + 1;
    severities.push(parsed[1]);
  });
  const errors = severities.filter((severity) => severity === 'error').length;
  if (!strict && errors > 0) problems.push(`parity: ${id}: action: ${pluralise(errors, 'error annotation')} without --strict`);
  if (strict && (errors > 0) !== (code !== 0)) problems.push(`parity: ${id}: action: exit code ${code} with ${pluralise(errors, 'error annotation')} under --strict`);
  const counted = countedFindings(report);
  if (counted !== null && tail.length !== counted) {
    problems.push(`parity: ${id}: action: ${pluralise(tail.length, 'annotation')} for ${pluralise(counted, 'finding')}`);
  }
  return problems;
}

function outputProblem({ vector, githubOutput }) {
  const counted = countedFindings(vector.stdout);
  const expected = vector.code === USAGE_ERROR_CODE ? '' : counted === null ? null : `findings=${counted}\n`;
  if (expected === null || githubOutput === expected) return null;
  return `parity: ${vector.id}: action: wrote ${show(githubOutput)} to GITHUB_OUTPUT, the report calls for ${show(expected)}`;
}

function problemsOf({ vector, surface, inputs, outcome }) {
  const { id } = vector;
  if (outcome.failure !== undefined) return [`parity: ${id}: ${surface}: did not finish: ${outcome.failure}`];
  const stdoutLines = linesOf(outcome.stdout);
  const fence = surface === 'action' ? fenceOf(vector, stdoutLines) : { report: stdoutLines, tail: [] };
  const reportLines = fence.report?.map((line, index) => (index === 0 ? maskPackageVersion(line) : line));
  return [
    outcome.code === vector.code ? null : `parity: ${id}: ${surface}: exit code ${outcome.code}, the vector has ${vector.code}`,
    fence.problem ?? null,
    reportLines === undefined
      ? null
      : streamProblem({ id, surface, stream: 'stdout', expected: vector.stdout, actual: reportLines, terminated: isTerminated(outcome.stdout) }),
    streamProblem({ id, surface, stream: 'stderr', expected: vector.stderr, actual: linesOf(outcome.stderr), terminated: isTerminated(outcome.stderr) }),
    ...fileProblems({ vector, surface, before: outcome.before, after: outcome.after }),
    ...(surface === 'action' && fence.problem === undefined
      ? [...annotationProblems({ vector, strict: inputs.strict, tail: fence.tail, tailStart: fence.tailStart }), outputProblem({ vector, githubOutput: outcome.githubOutput })]
      : []),
  ].filter((line) => line !== null);
}

function runnerInputs(inputs, defaults) {
  return {
    'run-file': inputs.runFile,
    baseline: inputs.baseline ?? defaults.baseline ?? '',
    strict: inputs.strict ? 'true' : (defaults.strict ?? ''),
  };
}

function coverageProblems(vectors) {
  const forAction = vectors.map((vector) => ({ vector, inputs: actionInputsFor(vector.argv) })).filter(({ inputs }) => inputs !== null);
  const strictWithFinding = forAction.some(({ vector, inputs }) => inputs.strict && vector.code === 1);
  const warningOnly = forAction.some(
    ({ vector, inputs }) => !inputs.strict && vector.code === 0 && WARNING_ONLY_SUMMARY.test(vector.stdout.at(-1) ?? ''),
  );
  const refused = vectors.some((vector) => vector.code === USAGE_ERROR_CODE && vector.stdout.length === 0 && vector.stderr.length > 0);
  const writes = vectors.some((vector) => vector.writes.length > 0);
  return [
    strictWithFinding ? null : 'parity: coverage: no vector runs check with --strict and a finding, so the Action reading strict would go unchecked',
    warningOnly ? null : 'parity: coverage: no vector runs check without --strict and a finding, so the Action default for strict would go unchecked',
    refused ? null : 'parity: coverage: no vector is refused with exit code 2 and text on stderr, so a surface that moved that text to stdout or changed that code would go unchecked',
    writes ? null : 'parity: coverage: no vector writes a file, so a surface that wrote nothing would go unchecked',
  ].filter((line) => line !== null);
}

const CONCURRENT_PROCESSES = Math.min(8, availableParallelism());

function jobsFor(vectors) {
  return vectors
    .flatMap((vector) => {
      const inputs = actionInputsFor(vector.argv);
      return (inputs === null ? SURFACES.filter((surface) => surface !== 'action') : SURFACES).map((surface) => ({ vector, surface, inputs }));
    })
    .map((job, index) => ({ ...job, index }));
}

async function inLanes(items, lanes, work) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(lanes, items.length) }, lane));
}

function materialise({ vector, files, runRoot }) {
  mkdirSync(join(runRoot, vector.dir), { recursive: true });
  for (const path of [vector.baseline, vector.run]) {
    if (path === null || !Object.hasOwn(files, path)) continue;
    mkdirSync(join(runRoot, posix.dirname(path)), { recursive: true });
    writeFileSync(join(runRoot, path), files[path]);
  }
}

async function runAction({ script, cwd, inputs, instant, outputFile }) {
  writeFileSync(outputFile, '');
  const env = { GITHUB_OUTPUT: outputFile };
  for (const [name, value] of Object.entries(inputs)) env[`INPUT_${name.toUpperCase()}`] = value;
  const outcome = await runScriptAsync({ script, cwd, instant, env });
  return { ...outcome, githubOutput: readFileSync(outputFile, 'utf8') };
}

async function execute({ job, files, scratch, installed, defaults }) {
  const { vector, surface, index, inputs } = job;
  const runRoot = join(scratch.directory, `run-${index}`);
  materialise({ vector, files, runRoot });
  const before = snapshotDirectory(runRoot);
  const cwd = join(runRoot, vector.dir);
  try {
    const outcome =
      surface === 'action'
        ? await runAction({ script: installed.action, cwd, inputs: runnerInputs(inputs, defaults), instant: vector.now, outputFile: join(scratch.directory, `output-${index}`) })
        : await runScriptAsync({ script: installed[surface], args: vector.argv, cwd, instant: vector.now });
    job.outcome = { ...outcome, before, after: snapshotDirectory(runRoot) };
  } catch (error) {
    job.outcome = { failure: error.message };
  }
}

const countRuns = (jobs, surface) => jobs.filter((job) => job.surface === surface).length;

export async function runParity({ root, distDir }) {
  const { vectors, files, defaults, scripts } = loadInputs({ root, distDir });
  const scratch = createScratch('parity');
  try {
    const installed = installedScripts(scratch, scripts);
    const jobs = jobsFor(vectors);
    await inLanes(jobs, CONCURRENT_PROCESSES, (job) => execute({ job, files, scratch, installed, defaults }));
    const problems = [...jobs.flatMap(problemsOf), ...coverageProblems(vectors)];
    const runs = SURFACES.map((surface) => `${surface} ${pluralise(countRuns(jobs, surface), 'run')}`);
    const instants = new Set(vectors.map((vector) => vector.now));
    const verdict =
      problems.length === 0
        ? `parity: ${pluralise(vectors.length, 'vector')} at ${pluralise(instants.size, 'instant')}; ${runs.join(', ')}; no mismatches`
        : `parity: ${pluralise(problems.length, 'problem')}`;
    return { ok: problems.length === 0, lines: [...problems, verdict] };
  } finally {
    scratch.dispose();
  }
}
