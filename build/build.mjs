import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, parseVersionLine } from './lib/generate.mjs';
import { COMMITTED_DIRECTORY, ENTRY_PATHS, GENERATED_FILES, GENERATED_SCRIPTS, SOURCE_SET, sourcePath } from './lib/layout.mjs';
import { BuildRefusal } from './lib/strip.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const USAGE = 'usage: node build/build.mjs [--check] [--dist <directory>]';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function labelOf(path) {
  const inside = relative(ROOT, path);
  return inside.startsWith('..') ? path : inside;
}

function parseOptions(argv) {
  try {
    return parseArgs({
      args: argv,
      options: { check: { type: 'boolean' }, dist: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch {
    return null;
  }
}

function readIfPresent(path) {
  try {
    return readFileSync(join(ROOT, path), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function versionLineOfSources() {
  const path = join(ROOT, sourcePath('command'));
  let module;
  try {
    module = await import(pathToFileURL(path).href);
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') throw new BuildRefusal(`${sourcePath('command')} is missing`);
    throw error;
  }
  return module.cli(['--version']).stdout[0];
}

function checkPackageVersion(versionLine) {
  const declared = JSON.parse(readIfPresent('package.json') ?? '{}').version;
  const printed = parseVersionLine(versionLine).package;
  if (declared !== printed) {
    throw new BuildRefusal(`package.json says version ${declared} but --version prints ${printed}`);
  }
}

function checkSyntax(directory) {
  for (const name of GENERATED_SCRIPTS) {
    const result = spawnSync(process.execPath, ['--check', join(directory, name)], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new BuildRefusal(`${name} does not parse:\n${result.stderr.trim().split('\n').slice(0, 8).join('\n')}`);
    }
  }
}

function firstDifference(committed, fresh) {
  const shared = Math.min(committed.length, fresh.length);
  for (let index = 0; index < shared; index += 1) if (committed[index] !== fresh[index]) return index;
  return shared;
}

function problemsWith(scratch, directory) {
  const label = labelOf(directory);
  const present = new Set(readdirSync(directory, { withFileTypes: true }).map((entry) => entry.name));
  const missingOrDifferent = GENERATED_FILES.flatMap((name) => {
    if (!present.has(name)) return [`rebuild: ${join(label, name)} is missing`];
    const committed = readFileSync(join(directory, name));
    const fresh = readFileSync(join(scratch, name));
    if (committed.equals(fresh)) return [];
    return [
      `rebuild: ${join(label, name)} differs from a fresh build (committed ${committed.length} bytes, fresh ${fresh.length} bytes, first difference at byte ${firstDifference(committed, fresh)})`,
    ];
  });
  const strays = [...present].filter((name) => !GENERATED_FILES.includes(name)).sort();
  return [...missingOrDifferent, ...strays.map((name) => `rebuild: ${join(label, name)} is not a generated file`)];
}

function compareWith(scratch, directory) {
  const label = labelOf(directory);
  let problems;
  try {
    problems = problemsWith(scratch, directory);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    problems = GENERATED_FILES.map((name) => `rebuild: ${join(label, name)} is missing`);
  }
  for (const problem of problems) process.stdout.write(`${problem}\n`);
  if (problems.length === 0) {
    process.stdout.write(`rebuild: ${label} matches a fresh build (${plural(GENERATED_FILES.length, 'file')})\n`);
    return 0;
  }
  process.stdout.write(`rebuild: ${plural(problems.length, 'problem')} in ${label}; run node build/build.mjs and commit the result\n`);
  return 1;
}

function install(scratch, directory) {
  mkdirSync(directory, { recursive: true });
  for (const name of GENERATED_FILES) {
    copyFileSync(join(scratch, name), join(directory, name));
    process.stdout.write(`build: wrote ${join(labelOf(directory), name)}\n`);
  }
  return 0;
}

async function buildInto(scratch) {
  const versionLine = await versionLineOfSources();
  checkPackageVersion(versionLine);
  const sources = Object.fromEntries(SOURCE_SET.map((name) => [name, readIfPresent(sourcePath(name))]));
  const entries = Object.fromEntries(ENTRY_PATHS.map((path) => [path, readIfPresent(path)]));
  const files = generate({ sources, entries, versionLine });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(scratch, name), text);
  checkSyntax(scratch);
}

async function main(argv) {
  const options = parseOptions(argv);
  if (options === null) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const directory = resolve(options.dist ?? join(ROOT, COMMITTED_DIRECTORY));
  const scratch = mkdtempSync(join(tmpdir(), 'evals-baseline-build-'));
  try {
    await buildInto(scratch);
    return options.check ? compareWith(scratch, directory) : install(scratch, directory);
  } catch (error) {
    if (!(error instanceof BuildRefusal)) throw error;
    process.stderr.write(`build: refused: ${error.message}\n`);
    return 1;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

process.exitCode = await main(process.argv.slice(2));
