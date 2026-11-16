import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { compare } from './compare.mjs';
import { describeCannotRead, describeFinding } from './describe.mjs';
import { datum, printable } from './printable.mjs';
import { isQuantisable } from './quantise.mjs';
import { readBaseline } from './read-baseline.mjs';
import { readRun } from './read-run.mjs';
import { baselineText, isUnchanged, record, replaceRefusal, toleranceRefusal, writeAtomically } from './record.mjs';
import {
  exitCode,
  noMetricAdvice,
  render,
  renderRecordRefusal,
  renderRecordUnchanged,
  renderRecordWritten,
  renderShow,
  renderShowRefusal,
  renderVersion,
} from './render.mjs';
import { Unreadable } from './unreadable.mjs';

const usageLine = 'usage: evals-baseline <check|record|show> <run-file> [--baseline <path>] [--strict] [--tolerance <n>] [--replace]';
const defaultBaselinePath = 'evals-baseline.json';
const flagsByVerb = { check: ['--baseline', '--strict'], record: ['--baseline', '--tolerance', '--replace'], show: [] };
const everyFlag = ['--baseline', '--strict', '--tolerance', '--replace'];
const decimalPattern = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

const defaultIo = {
  readFile: (path) => readFileSync(path, 'utf8'),
  writeFile: (path, text) => writeAtomically(path, text, { renameSync, rmSync, writeFileSync }, process.pid),
  now: () => new Date(),
};

function outcome({ stdout = [], stderr = [], code = 0, findings = [], failing = [] }) {
  return { stdout, stderr, code, findings, failing };
}

const internalError = (error) => ({ id: 'internal-error', message: error instanceof Error ? error.message : String(error) });

function flagProblem(verb, flag, taken) {
  if (!everyFlag.includes(flag)) {
    return `unknown flag ${datum(flag)}`;
  }
  if (!flagsByVerb[verb].includes(flag)) {
    return `${flag} is not a flag of ${verb}`;
  }
  return taken.has(flag) ? `${flag} given twice` : null;
}

function readFlagValue(flag, value) {
  if (flag === '--baseline') {
    return value === undefined || value.startsWith('-') ? { problem: '--baseline needs a path' } : { value };
  }
  if (value === undefined) {
    return { problem: '--tolerance needs a number of at least 0' };
  }
  if (!decimalPattern.test(value) || !isQuantisable(Number(value))) {
    return { problem: `--tolerance needs a number of at least 0, got ${datum(value)}` };
  }
  return { value: Number(value) };
}

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === '--version') {
    return { version: true };
  }
  const [verb, ...rest] = argv;
  if (!Object.hasOwn(flagsByVerb, String(verb))) {
    return { usage: [usageLine] };
  }
  const taken = new Map();
  const files = [];
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('-')) {
      files.push(token);
      continue;
    }
    const problem = flagProblem(verb, token, taken);
    if (problem !== null) {
      return { usage: [`evals-baseline: ${problem}`, usageLine] };
    }
    if (token === '--strict' || token === '--replace') {
      taken.set(token, true);
      continue;
    }
    const read = readFlagValue(token, rest[index + 1]);
    if (read.problem !== undefined) {
      return { usage: [`evals-baseline: ${read.problem}`, usageLine] };
    }
    taken.set(token, read.value);
    index += 1;
  }
  if (files.length !== 1) {
    return { usage: [usageLine] };
  }
  return {
    verb,
    runFile: files[0],
    baselinePath: taken.get('--baseline') ?? defaultBaselinePath,
    strict: taken.has('--strict'),
    replace: taken.has('--replace'),
    tolerance: taken.get('--tolerance'),
  };
}

function readInput(io, path) {
  try {
    return { text: io.readFile(path) };
  } catch (error) {
    if (typeof error?.code === 'string') {
      return { failure: error.code };
    }
    throw error;
  }
}

function attempt(read) {
  try {
    return { value: read() };
  } catch (error) {
    if (error instanceof Unreadable) {
      return { refusal: error.message, problem: error.problem };
    }
    throw error;
  }
}

function examine(state, runFile, baselinePath, io) {
  const baselineInput = readInput(io, baselinePath);
  if (baselineInput.failure === 'ENOENT') {
    state.findings.push({ id: 'no-baseline', file: baselinePath });
    return;
  }
  if (baselineInput.failure !== undefined) {
    state.findings.push({ id: 'bad-baseline', file: baselinePath, cause: 'cannot-read', failure: baselineInput.failure });
    return;
  }
  const baseline = attempt(() => readBaseline(baselineInput.text, baselinePath));
  if (baseline.refusal !== undefined) {
    state.findings.push({ id: 'bad-baseline', file: baselinePath, cause: 'refused', problem: baseline.problem });
    return;
  }
  state.baseline = baseline.value;
  const runInput = readInput(io, runFile);
  if (runInput.failure !== undefined) {
    state.findings.push({ id: 'bad-run', file: runFile, cause: 'cannot-read', failure: runInput.failure });
    return;
  }
  const run = attempt(() => readRun(runInput.text, runFile));
  if (run.refusal !== undefined) {
    state.findings.push({ id: 'bad-run', file: runFile, cause: 'refused', problem: run.problem });
    return;
  }
  const result = compare(baseline.value, run.value);
  state.findings.push(...result.findings);
  state.notes.push(...result.notes);
}

function runCheck({ runFile, baselinePath, strict }, io) {
  const today = io.now().toISOString().slice(0, 10);
  const state = { baseline: null, findings: [], notes: [] };
  try {
    examine(state, runFile, baselinePath, io);
  } catch (error) {
    state.findings.push(internalError(error));
  }
  const output = render({ baselinePath, baseline: state.baseline, findings: state.findings, notes: state.notes }, strict, today);
  return outcome({ stdout: output.lines, code: output.code, findings: output.findings, failing: output.failing });
}

function loadRun(runFile, io) {
  const input = readInput(io, runFile);
  if (input.failure !== undefined) {
    return { refusal: describeCannotRead(runFile, input.failure) };
  }
  return attempt(() => readRun(input.text, runFile));
}

function runShow({ runFile }, io) {
  try {
    const run = loadRun(runFile, io);
    if (run.refusal !== undefined) {
      return outcome({ stdout: renderShowRefusal(run.refusal), code: exitCode.notEvaluated });
    }
    return outcome({ stdout: renderShow(run.value, runFile) });
  } catch (error) {
    return outcome({ stdout: renderShowRefusal(describeFinding(internalError(error))), code: exitCode.notEvaluated });
  }
}

function refusalReason(run) {
  if (run.errors.length > 0) {
    return `the run has errored samples (${run.errors.join('; ')}); fix them and run the suite again`;
  }
  if (run.cases.count === 0) {
    return 'the run holds no cases, so a baseline of it would guard nothing';
  }
  if (run.metrics.length === 0) {
    return run.refused.length > 0 ? 'every metric in this run was refused by the reader' : noMetricAdvice(run.tool);
  }
  return null;
}

const unreadableBaselineAdvice =
  'the existing baseline cannot be read, so recording over it would discard its tolerances; fix it or delete it, then record again';

function loadPrevious(baselinePath, io) {
  const input = readInput(io, baselinePath);
  if (input.failure === 'ENOENT') {
    return { previous: null };
  }
  if (input.failure !== undefined) {
    return { refusal: describeCannotRead(baselinePath, input.failure) };
  }
  const baseline = attempt(() => readBaseline(input.text, baselinePath));
  if (baseline.refusal !== undefined) {
    return { refusal: `${baseline.refusal}; ${unreadableBaselineAdvice}` };
  }
  return { previous: baseline.value };
}

function findingsReplaced(previous, run) {
  if (previous !== null) {
    return compare(previous, run).findings;
  }
  return [];
}

function writeBaseline(io, baselinePath, text) {
  try {
    io.writeFile(baselinePath, text);
    return null;
  } catch (error) {
    if (typeof error?.code === 'string') {
      return `cannot write ${datum(baselinePath)}: ${error.code}`;
    }
    throw error;
  }
}

function recordRun({ runFile, baselinePath, tolerance, replace }, io) {
  const refused = (reason, refusedMetrics = [], held = [], notes = []) =>
    outcome({ stdout: renderRecordRefusal(reason, refusedMetrics, held, notes), code: exitCode.notEvaluated });
  try {
    const run = loadRun(runFile, io);
    if (run.refusal !== undefined) {
      return refused(run.refusal);
    }
    const reason = refusalReason(run.value);
    if (reason !== null) {
      return refused(reason, run.value.refused);
    }
    const existing = loadPrevious(baselinePath, io);
    if (existing.refusal !== undefined) {
      return refused(existing.refusal);
    }
    const toleranceProblem = toleranceRefusal(run.value, tolerance, existing.previous);
    if (toleranceProblem !== null) {
      return refused(toleranceProblem.reason, [], toleranceProblem.held);
    }
    const next = record(run.value, io.now(), tolerance, existing.previous);
    if (existing.previous !== null && isUnchanged(existing.previous, next)) {
      return outcome({ stdout: renderRecordUnchanged(baselinePath, existing.previous, run.value.refused) });
    }
    const replacement = replaceRefusal(baselinePath, existing.previous, next, replace);
    if (replacement !== null) {
      return refused(replacement.reason, [], [], replacement.notes);
    }
    const replaced = findingsReplaced(existing.previous, run.value);
    const writeFailure = writeBaseline(io, baselinePath, baselineText(next));
    if (writeFailure !== null) {
      return refused(writeFailure);
    }
    return outcome({ stdout: renderRecordWritten(baselinePath, next, run.value.refused, replaced) });
  } catch (error) {
    return refused(describeFinding(internalError(error)));
  }
}

const verbs = { check: runCheck, record: recordRun, show: runShow };

export function cli(argv, io = defaultIo) {
  const parsed = parseArguments(argv);
  if (parsed.usage !== undefined) {
    return outcome({ stderr: parsed.usage.map(printable), code: exitCode.usage });
  }
  if (parsed.version) {
    return outcome({ stdout: renderVersion() });
  }
  return verbs[parsed.verb](parsed, io);
}
