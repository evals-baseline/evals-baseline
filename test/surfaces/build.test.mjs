import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { miniRepository } from './mini-repository.mjs';
import { miniSources } from './mini-sources.mjs';
import { runNode, scratchDirectory } from './support.mjs';

const GENERATED = ['action.mjs', 'evals-baseline.mjs', 'manifest.json'];

const buildIn = (root, ...args) => runNode(['build/build.mjs', ...args], { cwd: root });
const checkIn = (root, ...args) => buildIn(root, '--check', ...args);

const snapshot = (directory) =>
  Object.fromEntries(readdirSync(directory).sort().map((name) => [name, readFileSync(join(directory, name)).toString('hex')]));

function builtRepository(t, options) {
  const root = miniRepository(t, options);
  const result = buildIn(root);
  assert.equal(result.code, 0, result.output);
  return root;
}

function flipByte(path, index) {
  const bytes = readFileSync(path);
  bytes[index] ^= 1;
  writeFileSync(path, bytes);
}

test('writes the three generated files into dist and names each one', (t) => {
  const root = miniRepository(t);
  const result = buildIn(root);
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(readdirSync(join(root, 'dist')).sort(), GENERATED);
  assert.deepEqual(result.stdout.trim().split('\n'), GENERATED.map((name) => `build: wrote dist/${name}`));
});

test('writes the same bytes when it runs again, from another directory, under another locale and time zone', (t) => {
  const root = builtRepository(t);
  const first = snapshot(join(root, 'dist'));
  rmSync(join(root, 'dist'), { recursive: true });
  const elsewhere = scratchDirectory(t, 'cwd');
  const env = { PATH: process.env.PATH, TZ: 'Pacific/Kiritimati', LANG: 'ja_JP.UTF-8', LC_ALL: 'ja_JP.UTF-8' };
  const second = runNode([join(root, 'build/build.mjs')], { cwd: elsewhere, env });
  assert.equal(second.code, 0, second.output);
  assert.deepEqual(snapshot(join(root, 'dist')), first);
});

test('--dist writes into that directory and leaves dist alone', (t) => {
  const root = miniRepository(t);
  const target = scratchDirectory(t, 'target');
  const result = buildIn(root, '--dist', target);
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(readdirSync(target).sort(), GENERATED);
  assert.equal(existsSync(join(root, 'dist')), false);
});

test('does not delete anything else in the directory it writes to', (t) => {
  const root = miniRepository(t);
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'dist', 'keep.txt'), 'kept\n');
  assert.equal(buildIn(root).code, 0);
  assert.equal(readFileSync(join(root, 'dist', 'keep.txt'), 'utf8'), 'kept\n');
});

test('--check passes on a directory that matches a fresh build and writes nothing', (t) => {
  const root = builtRepository(t);
  const before = snapshot(join(root, 'dist'));
  const result = checkIn(root);
  assert.equal(result.code, 0, result.output);
  assert.equal(result.stdout.trim(), 'rebuild: dist matches a fresh build (3 files)');
  assert.deepEqual(snapshot(join(root, 'dist')), before);
});

test('--check goes red when one byte of a generated script is changed, and names the file and the byte', (t) => {
  const root = builtRepository(t);
  flipByte(join(root, 'dist', 'evals-baseline.mjs'), 40);
  const result = checkIn(root);
  assert.equal(result.code, 1);
  assert.match(
    result.stdout,
    /^rebuild: dist\/evals-baseline\.mjs differs from a fresh build \(committed (\d+) bytes, fresh \1 bytes, first difference at byte 40\)$/m,
  );
  assert.match(result.stdout, /^rebuild: 1 problem in dist; run node build\/build\.mjs and commit the result$/m);
  assert.doesNotMatch(result.stdout, /action\.mjs/);
});

test('--check still goes red when the hand edit was written into the manifest as well', (t) => {
  const root = builtRepository(t);
  const script = join(root, 'dist', 'evals-baseline.mjs');
  flipByte(script, 40);
  const manifestPath = join(root, 'dist', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.generated['dist/evals-baseline.mjs'] = createHash('sha256').update(readFileSync(script)).digest('hex');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = checkIn(root);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /^rebuild: dist\/evals-baseline\.mjs differs from a fresh build/m);
  assert.match(result.stdout, /^rebuild: dist\/manifest\.json differs from a fresh build/m);
});

test('--check goes red when only the manifest is changed', (t) => {
  const root = builtRepository(t);
  flipByte(join(root, 'dist', 'manifest.json'), 20);
  const result = checkIn(root);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /^rebuild: dist\/manifest\.json differs from a fresh build/m);
  assert.doesNotMatch(result.stdout, /evals-baseline\.mjs|action\.mjs/);
});

test('--check goes red when a generated file is missing', (t) => {
  const root = builtRepository(t);
  rmSync(join(root, 'dist', 'action.mjs'));
  const result = checkIn(root);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /^rebuild: dist\/action\.mjs is missing$/m);
});

test('--check goes red when dist holds a file that is not generated', (t) => {
  const root = builtRepository(t);
  writeFileSync(join(root, 'dist', 'extra.mjs'), 'void 0;\n');
  const result = checkIn(root);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /^rebuild: dist\/extra\.mjs is not a generated file$/m);
});

test('--check goes red on a directory that does not exist, listing every file as missing', (t) => {
  const root = miniRepository(t);
  const result = checkIn(root);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /^rebuild: 3 problems in dist; run node build\/build\.mjs and commit the result$/m);
});

test('--check compares against --dist when it is given', (t) => {
  const root = builtRepository(t);
  const copy = scratchDirectory(t, 'copy');
  for (const name of GENERATED) writeFileSync(join(copy, name), readFileSync(join(root, 'dist', name)));
  assert.equal(checkIn(root, '--dist', copy).code, 0);
  flipByte(join(copy, 'action.mjs'), 7);
  const result = checkIn(root, '--dist', copy);
  assert.equal(result.code, 1);
  assert.ok(result.stdout.includes(`rebuild: ${join(copy, 'action.mjs')} differs from a fresh build`), result.stdout);
});

test('refuses a concatenation that does not parse, shows the syntax error, and writes nothing', (t) => {
  const sources = miniSources();
  sources.quantise += 'const helper = 1;\n';
  sources.compare += 'const helper = 2;\n';
  const root = miniRepository(t, { sources });
  const result = buildIn(root);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^build: refused: .*does not parse/m);
  assert.match(result.stderr, /already been declared/);
  assert.equal(existsSync(join(root, 'dist')), false);
});

test('refuses a module the stripper cannot handle and names the file and line', (t) => {
  const sources = miniSources();
  sources.compare = 'const compare = 1;\nexport default compare;\n';
  const result = buildIn(miniRepository(t, { sources }));
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^build: refused: src\/compare\.mjs:2: /m);
});

test('refuses when package.json and --version disagree about the package version', (t) => {
  const root = miniRepository(t, { version: '2.0.0' });
  const result = buildIn(root);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^build: refused: package\.json says version 2\.0\.0 but --version prints 1\.0\.0$/m);
  assert.equal(existsSync(join(root, 'dist')), false);
});

test('refuses when a source module is missing and names it', (t) => {
  const sources = miniSources();
  delete sources.digest;
  const result = buildIn(miniRepository(t, { sources }));
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^build: refused: src\/digest\.mjs is missing$/m);
});

test('--check refuses in the same way and does not report a match', (t) => {
  const result = checkIn(miniRepository(t, { version: '2.0.0' }));
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^build: refused: /m);
  assert.doesNotMatch(result.stdout, /matches a fresh build/);
});

test('exits 2 with a usage line on an unknown flag', (t) => {
  const result = buildIn(miniRepository(t), '--fix');
  assert.equal(result.code, 2);
  assert.match(result.stderr, /^usage: node build\/build\.mjs \[--check\] \[--dist <directory>\]/);
});
