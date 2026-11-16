import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import assert from 'node:assert/strict';
import { createScratch, snapshotDirectory } from '../../build/lib/scratch.mjs';
import { runScript } from '../../build/lib/surfaces.mjs';
import { VECTOR_FILE, maskPackageVersion } from '../../build/lib/vectors.mjs';
import { MINI_CASES, MINI_DIRECTORY, MINI_FIXTURES, MINI_INSTANTS, miniActionYml, miniToolSources } from './mini-tool.mjs';
import { miniSources } from './mini-sources.mjs';
import { ROOT, proveWithSpecimen, runNode, scratchDirectory } from './support.mjs';

export function miniRepository(test, { sources = miniSources(), version = '1.0.0', files = {}, actionYml } = {}) {
  const root = scratchDirectory(test, 'repository');
  cpSync(join(ROOT, 'build'), join(root, 'build'), { recursive: true });
  mkdirSync(join(root, 'src'));
  for (const [name, text] of Object.entries(sources)) writeFileSync(join(root, 'src', `${name}.mjs`), text);
  const manifest = { name: 'mini', version, type: 'module', bin: { 'evals-baseline': 'src/cli.mjs' } };
  writeFileSync(join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(root, 'action.yml'), actionYml ?? readFileSync(join(ROOT, 'action.yml'), 'utf8'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

export function builtRepository(test, options) {
  const root = miniRepository(test, options);
  const result = runNode(['build/build.mjs'], { cwd: root });
  assert.equal(result.code, 0, result.output);
  return root;
}

const linesOf = (text) => {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};

const inMini = (name) => (name === undefined ? null : `${MINI_DIRECTORY}/${name}`);

function deriveVector(root, files, { id, argv, now = MINI_INSTANTS[0], run, baseline }) {
  const scratch = createScratch('vector');
  try {
    mkdirSync(join(scratch.directory, MINI_DIRECTORY), { recursive: true });
    for (const path of [inMini(run), inMini(baseline)]) {
      if (path !== null && Object.hasOwn(files, path)) writeFileSync(join(scratch.directory, path), files[path]);
    }
    const before = snapshotDirectory(scratch.directory);
    const outcome = runScript({ script: join(root, 'src', 'cli.mjs'), args: argv, cwd: join(scratch.directory, MINI_DIRECTORY), instant: now });
    const after = snapshotDirectory(scratch.directory);
    const writes = Object.keys(after)
      .filter((path) => before[path] !== after[path])
      .map((path) => ({ path: posix.relative(MINI_DIRECTORY, path), content: readFileSync(join(scratch.directory, path), 'utf8') }));
    const stdout = linesOf(outcome.stdout).map((line, index) => (index === 0 ? maskPackageVersion(line) : line));
    return { id, dir: MINI_DIRECTORY, argv, now, baseline: inMini(baseline), run: inMini(run), covers: [], stdout, stderr: linesOf(outcome.stderr), code: outcome.code, writes };
  } finally {
    scratch.dispose();
  }
}

export function deriveVectors(root, cases = MINI_CASES) {
  const files = {};
  for (const { run, baseline } of cases) {
    for (const path of [inMini(run), inMini(baseline)]) {
      if (path !== null && Object.hasOwn(MINI_FIXTURES, path)) files[path] = MINI_FIXTURES[path];
    }
  }
  return { specification: '1.0', vectors: cases.map((entry) => deriveVector(root, files, entry)), files };
}

export const readVectors = (root) => JSON.parse(readFileSync(join(root, VECTOR_FILE), 'utf8'));
export const writeVectors = (root, document) => writeFileSync(join(root, VECTOR_FILE), `${JSON.stringify(document, null, 2)}\n`);

export function derivedRepository(test, { cases = MINI_CASES, ...options } = {}) {
  const root = builtRepository(test, { sources: miniToolSources(), files: MINI_FIXTURES, actionYml: miniActionYml(), ...options });
  writeVectors(root, deriveVectors(root, cases));
  return root;
}

export function copyRepository(test, root) {
  const copy = scratchDirectory(test, 'repository');
  cpSync(root, copy, { recursive: true });
  return copy;
}

const atExit = { after: (cleanup) => process.on('exit', cleanup) };
let template;
const pristine = () => (template ??= derivedRepository(atExit));

export const derivedCopy = (test) => copyRepository(test, pristine());
export const pristineVector = (id) => readVectors(pristine()).vectors.find((vector) => vector.id === id);

export const parity = (root, ...args) => () => runNode(['build/parity.mjs', ...args], { cwd: root });
let pristineRun;
const pristineParity = () => (pristineRun ??= parity(copyRepository(atExit, pristine()))());

export function proveRed(root, { plant, token }) {
  const runs = [];
  const run = () => {
    const result = runs.length === 0 ? pristineParity() : parity(root)();
    runs.push(result);
    return result;
  };
  const proof = proveWithSpecimen({ run, plant, token });
  assert.ok(proof.ok, proof.reason);
  return runs.at(-1);
}

export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
export const problemLine = (id, surface, rest) => `parity: ${id}: ${surface}: ${rest}`;

export function reportOf({ stdout }) {
  const lines = stdout.trimEnd().split('\n');
  const verdict = lines.pop();
  const keys = lines.map((line) => /^parity: ([^:]+): (package|copy|action): /.exec(line)).filter(Boolean).map(([, id, surface]) => [id, surface]);
  const pairs = keys.filter(([id, surface], index) => index === 0 || keys[index - 1][0] !== id || keys[index - 1][1] !== surface);
  return { lines, verdict, pairs, surfaces: [...new Set(keys.map(([, surface]) => surface))] };
}

function replaceOnce(path, from, to) {
  const text = readFileSync(path, 'utf8');
  const count = text.split(from).length - 1;
  assert.equal(count, 1, `${JSON.stringify(from)} occurs ${count} times in ${path}, so the specimen would plant nothing or too much`);
  writeFileSync(path, text.replace(from, () => to));
}

export const plantEdits = (directory, edits) => () => {
  const originals = [...new Set(edits.map(({ file }) => file))].map((file) => [join(directory, file), readFileSync(join(directory, file), 'utf8')]);
  for (const { file, from, to } of edits) replaceOnce(join(directory, file), from, to);
  return () => {
    for (const [path, text] of originals) writeFileSync(path, text);
  };
};

export const plantText = (path, text) => () => {
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, text);
  return () => writeFileSync(path, original);
};
