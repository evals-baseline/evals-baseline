import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ActionMetadataRefusal, actionDefaults, parseActionYml } from '../../build/lib/action-yml.mjs';
import { ROOT } from './support.mjs';

const refusal = (text) => {
  try {
    parseActionYml(text);
  } catch (error) {
    assert.ok(error instanceof ActionMetadataRefusal, `expected an ActionMetadataRefusal, got ${error}`);
    return error.message;
  }
  return assert.fail('expected the text to be refused');
};

test('reads nested mappings and plain scalars as strings', () => {
  const text = 'name: evals-baseline\ninputs:\n  strict:\n    required: false\n    default: off\n';
  assert.deepEqual(parseActionYml(text), { name: 'evals-baseline', inputs: { strict: { required: 'false', default: 'off' } } });
});

test('reads single-quoted and double-quoted scalars without their quotes', () => {
  assert.deepEqual(parseActionYml("a: 'false'\nb: \"true\"\n"), { a: 'false', b: 'true' });
});

test('keeps a colon followed by no space, and a hyphen, inside a plain scalar', () => {
  assert.deepEqual(parseActionYml('main: dist/action.mjs\nname: evals-baseline\nnote: a:b\n'), {
    main: 'dist/action.mjs',
    name: 'evals-baseline',
    note: 'a:b',
  });
});

test('reads keys that contain a hyphen', () => {
  assert.deepEqual(parseActionYml('inputs:\n  run-file:\n    required: true\n'), { inputs: { 'run-file': { required: 'true' } } });
});

test('ignores blank lines', () => {
  assert.deepEqual(parseActionYml('a: 1\n\nb: 2\n'), { a: '1', b: '2' });
});

test('returns to an outer level when the indent drops', () => {
  assert.deepEqual(parseActionYml('a:\n  b:\n    c: 1\n  d: 2\ne: 3\n'), { a: { b: { c: '1' }, d: '2' }, e: '3' });
});

for (const [label, text, pattern] of [
  ['a tab in the indent', 'a:\n\tb: 1\n', /line 2.*tab/],
  ['a list item', 'a:\n  - b\n', /line 2/],
  ['a comment', '# note\na: 1\n', /line 1/],
  ['a line with no key', 'just words\n', /line 1/],
  ['an indent that is not two spaces per level', 'a:\n   b: 1\n', /line 2.*indent/],
  ['a key given twice', 'a: 1\na: 2\n', /line 2.*twice/],
  ['a key with a value and children', 'a: 1\n  b: 2\n', /line 2/],
]) {
  test(`refuses ${label}, naming the line`, () => {
    assert.match(refusal(text), pattern);
  });
}

test('actionDefaults reads the default of each input and leaves out an input that has none', () => {
  const text = 'inputs:\n  run-file:\n    required: true\n  baseline:\n    default: evals-baseline.json\n  strict:\n    default: \'false\'\n';
  assert.deepEqual(actionDefaults(text), { baseline: 'evals-baseline.json', strict: 'false' });
});

test('actionDefaults refuses metadata that declares none of the three inputs the Action reads', () => {
  assert.throws(() => actionDefaults('name: x\n'), (error) => error instanceof ActionMetadataRefusal && /inputs/.test(error.message));
});

for (const missing of ['run-file', 'baseline', 'strict']) {
  test(`actionDefaults refuses metadata with no input named ${missing}`, () => {
    const inputs = ['run-file', 'baseline', 'strict'].filter((name) => name !== missing).map((name) => `  ${name}:\n    required: false\n`);
    assert.throws(() => actionDefaults(`inputs:\n${inputs.join('')}`), (error) => error instanceof ActionMetadataRefusal && error.message.includes(missing));
  });
}

test('the action.yml in this repository is read, with the defaults the specification gives', () => {
  const defaults = actionDefaults(readFileSync(new URL('action.yml', `file://${ROOT}`), 'utf8'));
  assert.deepEqual(defaults, { baseline: 'evals-baseline.json', strict: 'false' });
});
