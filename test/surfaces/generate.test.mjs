import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { freezeClock } from '../../build/lib/clock.mjs';
import { generate } from '../../build/lib/generate.mjs';
import { BuildRefusal } from '../../build/lib/strip.mjs';
import { MINI_VERSION_LINE, miniSources } from './mini-sources.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const SOURCE_ORDER = [
  'printable',
  'unreadable',
  'digest',
  'quantise',
  'direction',
  'read-run',
  'read-baseline',
  'compare',
  'describe',
  'record',
  'render',
  'command',
  'cli',
];

const sources = miniSources;

const entries = () => ({
  'build/entries/copy-main.mjs': "import { cli } from '../../src/command.mjs';\n\n{\n  cli(process.argv.slice(2));\n}\n",
  'build/entries/action-lib.mjs': 'export const escapeData = (value) => value;\n',
  'build/entries/action-main.mjs': [
    "import { cli } from '../../src/command.mjs';",
    "import { escapeData } from './action-lib.mjs';",
    '',
    '{',
    '  escapeData(cli([]));',
    '}',
    '',
  ].join('\n'),
});

const versionLine = MINI_VERSION_LINE;
const build = (overrides = {}) => generate({ sources: sources(), entries: entries(), versionLine, ...overrides });

const positionsOf = (text, markers) => markers.map((marker) => {
  const position = text.indexOf(marker);
  assert.notEqual(position, -1, `${marker} is missing`);
  return position;
});

test('produces the Action bundle, the copyable file and the manifest, and nothing else', () => {
  assert.deepEqual(Object.keys(build()).sort(), ['action.mjs', 'evals-baseline.mjs', 'manifest.json']);
});

test('opens both scripts with the package and specification version it was generated from', () => {
  const { 'action.mjs': action, 'evals-baseline.mjs': copy } = build();
  for (const text of [action, copy]) {
    const [first, second, third] = text.split('\n');
    assert.equal(first, '// evals-baseline 1.0.0 (specification 1.0)');
    assert.match(second, /^\/\/ Generated file\. Do not edit\./);
    assert.equal(third, '');
  }
});

test('concatenates the modules in the fixed order and appends the command entry last', () => {
  const copy = build()['evals-baseline.mjs'];
  const positions = positionsOf(copy, [
    'class Unreadable',
    "import { createHash } from 'node:crypto';",
    'const digestOf',
    'const quantise',
    'const readRun',
    'const specificationVersion',
    'const compare',
    'const describeFinding',
    'const record',
    'const packageVersion',
    'function cli(argv)',
    'cli(process.argv.slice(2));',
  ]);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('concatenates the Action library and the Action entry after the modules', () => {
  const action = build()['action.mjs'];
  const positions = positionsOf(action, ['function cli(argv)', 'const escapeData', 'escapeData(cli([]));']);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(!action.includes('cli(process.argv.slice(2));'), 'the copy entry leaked into the Action bundle');
});

test('keeps the Action library out of the copyable file', () => {
  assert.ok(!build()['evals-baseline.mjs'].includes('escapeData'));
});

test('leaves the executable entry out of both scripts', () => {
  for (const name of ['action.mjs', 'evals-baseline.mjs']) {
    assert.ok(!build()[name].includes('#!/usr/bin/env node'), `${name} carries the shebang of src/cli.mjs`);
  }
});

test('leaves no relative import and no export keyword at the start of a line', () => {
  for (const name of ['action.mjs', 'evals-baseline.mjs']) {
    const text = build()[name];
    assert.doesNotMatch(text, /^export\b/m, `${name} still exports`);
    assert.doesNotMatch(text, /from '\.{1,2}\//, `${name} still imports a relative module`);
  }
});

test('separates parts with one blank line and ends with one newline', () => {
  for (const name of ['action.mjs', 'evals-baseline.mjs']) {
    const text = build()[name];
    assert.doesNotMatch(text, /\n\n\n/, `${name} has two blank lines in a row`);
    assert.match(text, /[^\n]\n$/, `${name} does not end with exactly one newline`);
  }
});

test('writes a manifest whose hashes anyone can recompute', () => {
  const files = build();
  const manifestText = files['manifest.json'];
  const manifest = JSON.parse(manifestText);
  const listing = SOURCE_ORDER.map((name) => `${sha256(sources()[name])}  src/${name}.mjs\n`).join('');
  assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.deepEqual(manifest, {
    package: '1.0.0',
    specification: '1.0',
    sourceSet: { sha256: sha256(listing), files: SOURCE_ORDER.map((name) => `src/${name}.mjs`) },
    generated: {
      'dist/action.mjs': sha256(files['action.mjs']),
      'dist/evals-baseline.mjs': sha256(files['evals-baseline.mjs']),
    },
  });
});

test('builds the same bytes twice', () => {
  assert.deepEqual(build(), build());
});

test('builds the same bytes on two different days', () => {
  const restoreFirst = freezeClock('2026-11-11T12:00:00.000Z');
  const first = build();
  restoreFirst();
  const restoreSecond = freezeClock('2031-01-01T00:00:00.000Z');
  const second = build();
  restoreSecond();
  assert.deepEqual(first, second);
});

test('a change to a concatenated module changes the scripts and the manifest', () => {
  const before = build();
  const changed = sources();
  changed.quantise = changed.quantise.replace('1000000', '1000001');
  const after = build({ sources: changed });
  assert.notEqual(after['action.mjs'], before['action.mjs']);
  assert.notEqual(after['evals-baseline.mjs'], before['evals-baseline.mjs']);
  assert.notEqual(after['manifest.json'], before['manifest.json']);
});

test('a blank line at the end of a module changes the manifest and not the scripts', () => {
  const before = build();
  const changed = sources();
  changed.quantise += '\n';
  const after = build({ sources: changed });
  assert.equal(after['action.mjs'], before['action.mjs']);
  assert.equal(after['evals-baseline.mjs'], before['evals-baseline.mjs']);
  assert.notEqual(after['manifest.json'], before['manifest.json']);
});

test('a change to a source that is not concatenated changes only the manifest', () => {
  const before = build();
  const changed = sources();
  changed.cli += '\n';
  const after = build({ sources: changed });
  assert.equal(after['action.mjs'], before['action.mjs']);
  assert.equal(after['evals-baseline.mjs'], before['evals-baseline.mjs']);
  assert.notEqual(JSON.parse(after['manifest.json']).sourceSet.sha256, JSON.parse(before['manifest.json']).sourceSet.sha256);
});

test('refuses a version line that is not the one --version prints', () => {
  assert.throws(() => build({ versionLine: 'evals-baseline version 1.0.0' }), BuildRefusal);
});

test('refuses a source module that is missing and names it', () => {
  const missing = sources();
  delete missing.digest;
  assert.throws(() => build({ sources: missing }), (error) => error instanceof BuildRefusal && /src\/digest\.mjs/.test(error.message));
});

test('refuses an entry that is missing and names it', () => {
  const missing = entries();
  delete missing['build/entries/action-lib.mjs'];
  assert.throws(() => build({ entries: missing }), (error) => error instanceof BuildRefusal && /action-lib\.mjs/.test(error.message));
});

test('refuses a module that imports a module later in the order', () => {
  const backwards = sources();
  backwards.digest = "import { quantise } from './quantise.mjs';\nexport const digestOf = quantise;\n";
  assert.throws(() => build({ sources: backwards }), (error) => error instanceof BuildRefusal && /src\/digest\.mjs:1/.test(error.message));
});

test('refuses an entry that imports a source that is not concatenated', () => {
  const wrong = entries();
  wrong['build/entries/copy-main.mjs'] = "import { cli } from '../../src/cli.mjs';\n";
  assert.throws(() => build({ entries: wrong }), (error) => error instanceof BuildRefusal && /build\/entries\/copy-main\.mjs:1/.test(error.message));
});

test('refuses an unsupported export in a module and names the module', () => {
  const unsupported = sources();
  unsupported.compare = 'const compare = 1;\nexport default compare;\n';
  assert.throws(() => build({ sources: unsupported }), (error) => error instanceof BuildRefusal && /src\/compare\.mjs:2/.test(error.message));
});
