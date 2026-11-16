import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VectorRefusal, actionInputsFor, maskPackageVersion, parseVectors } from '../../build/lib/vectors.mjs';

const vector = (overrides = {}) => ({
  id: 'S2-worse',
  dir: 'fixtures/promptfoo',
  argv: ['check', 'run-worse.json'],
  now: '2026-11-11T12:00:00.000Z',
  baseline: 'fixtures/promptfoo/evals-baseline.json',
  run: 'fixtures/promptfoo/run-worse.json',
  stdout: ['evals-baseline <package version> (specification 1.0) check evals-baseline.json', 'evals-baseline: no findings'],
  stderr: [],
  code: 0,
  writes: [],
  ...overrides,
});
const FILES = { 'fixtures/promptfoo/evals-baseline.json': '{}', 'fixtures/promptfoo/run-worse.json': '{}' };
const document = (vectors, files = FILES) => JSON.stringify({ specification: '1.0', vectors, files });

const refusal = (text) => {
  try {
    parseVectors(text);
  } catch (error) {
    assert.ok(error instanceof VectorRefusal, `expected a VectorRefusal, got ${error}`);
    return error.message;
  }
  return assert.fail('expected the vectors to be refused');
};

test('parses the vectors and the files they read, in the order written', () => {
  const parsed = parseVectors(document([vector(), vector({ id: 'S2-worse-strict', argv: ['check', 'run-worse.json', '--strict'], code: 1 })]));
  assert.deepEqual(
    parsed.vectors.map(({ id, argv, code }) => ({ id, argv, code })),
    [
      { id: 'S2-worse', argv: ['check', 'run-worse.json'], code: 0 },
      { id: 'S2-worse-strict', argv: ['check', 'run-worse.json', '--strict'], code: 1 },
    ],
  );
  assert.deepEqual(parsed.files, FILES);
});

test('gives each write its path from the repository root, joined to the directory the vector runs in', () => {
  const [parsed] = parseVectors(document([vector({ writes: [{ path: 'planted/evals-baseline.json', content: 'text' }] })])).vectors;
  assert.deepEqual(parsed.writes, [{ path: 'fixtures/promptfoo/planted/evals-baseline.json', content: 'text' }]);
});

test('refuses text that is not JSON, naming the file', () => {
  assert.match(refusal('{'), /^fixtures\/vectors\.json: not JSON/);
});

test('refuses a document that is not an object with a vectors array', () => {
  assert.match(refusal('[]'), /object with a vectors array/);
  assert.match(refusal('{"vectors": {}}'), /object with a vectors array/);
});

test('refuses an empty list, because a parity run over nothing proves nothing', () => {
  assert.match(refusal(document([])), /no vector/);
});

test('refuses a document with no files object, because the vectors would then depend on a checkout', () => {
  assert.match(refusal(JSON.stringify({ vectors: [vector()] })), /files must be an object/);
  assert.match(refusal(JSON.stringify({ vectors: [vector()], files: [] })), /files must be an object/);
});

test('refuses a file whose path leaves the repository or is not normalised, or whose text is not a string', () => {
  for (const path of ['/etc/passwd', '../elsewhere.json', 'fixtures/../../elsewhere.json', 'fixtures//run.json', 'fixtures/./run.json']) {
    assert.match(refusal(document([vector()], { [path]: '{}' })), /files: .*not a normalised path inside the repository/, path);
  }
  assert.match(refusal(document([vector()], { 'fixtures/promptfoo/run-worse.json': 3 })), /files: .*not a text/);
});

test('refuses a vector that is not an object', () => {
  assert.match(refusal(document(['S1'])), /vector 1 .*not an object/);
});

const BAD_MEMBERS = {
  id: ['', 3, undefined],
  dir: ['/etc', '../elsewhere', 'fixtures/../../elsewhere', '.', 'fixtures/..', undefined],
  argv: ['check run.json', ['check', 3], undefined],
  now: ['2026-11-11', '2026-11-11T12:00:00Z', '2026-13-11T12:00:00.000Z', 3, undefined],
  baseline: ['', 3, undefined],
  run: ['', 3, undefined],
  stdout: ['line', ['line', 3], undefined],
  stderr: ['line', ['line', 3], undefined],
  code: ['0', -1, 1.5, undefined],
  writes: [{}, [{ path: 'a.json' }], [{ path: '', content: '' }], [{ path: '../../../outside.json', content: '' }], undefined],
};

for (const [member, badValues] of Object.entries(BAD_MEMBERS)) {
  test(`refuses a vector with no usable ${member}, naming the vector`, () => {
    for (const bad of badValues) {
      assert.match(refusal(document([vector(), vector({ id: 'S2-other', [member]: bad })])), new RegExp(`vector 2 .*${member}`), String(bad));
    }
  });
}

test('accepts a null baseline and a null run, as a vector refused for its arguments has', () => {
  assert.equal(parseVectors(document([vector({ baseline: null, run: null })])).vectors.length, 1);
});

test('refuses two vectors with one id, naming it', () => {
  assert.match(refusal(document([vector(), vector()])), /S2-worse.*twice|twice.*S2-worse/);
});

test('maskPackageVersion replaces the package version in the banner line and nothing else', () => {
  assert.equal(maskPackageVersion('evals-baseline 1.0.0 (specification 1.0)'), 'evals-baseline <package version> (specification 1.0)');
  assert.equal(maskPackageVersion('evals-baseline 12.3.4-rc.1 (specification 1.0) check x.json'), 'evals-baseline <package version> (specification 1.0) check x.json');
  assert.equal(maskPackageVersion('missing-metric evals-baseline 1.0.0 (specification 1.0)'), 'missing-metric evals-baseline 1.0.0 (specification 1.0)');
});

const inputs = (argv) => actionInputsFor(argv);

test('reads the run file, and leaves the baseline and strict unset when the argv does not give them', () => {
  assert.deepEqual(inputs(['check', 'run.json']), { runFile: 'run.json', baseline: undefined, strict: false });
});

test('reads --strict', () => {
  assert.deepEqual(inputs(['check', 'run.json', '--strict']), { runFile: 'run.json', baseline: undefined, strict: true });
});

test('reads --baseline and its value', () => {
  assert.deepEqual(inputs(['check', 'run.json', '--baseline', 'base.json']), { runFile: 'run.json', baseline: 'base.json', strict: false });
});

test('reads the flags in any order, before or after the run file', () => {
  assert.deepEqual(inputs(['check', '--strict', '--baseline', 'base.json', 'run.json']), { runFile: 'run.json', baseline: 'base.json', strict: true });
});

test('reads check with no run file as an empty run file, which the command refuses as a usage error', () => {
  assert.deepEqual(inputs(['check']), { runFile: '', baseline: undefined, strict: false });
  assert.deepEqual(inputs(['check', '--strict']), { runFile: '', baseline: undefined, strict: true });
});

for (const [label, argv] of [
  ['another verb', ['record', 'run.json']],
  ['the show verb', ['show', 'run.json']],
  ['the version flag', ['--version']],
  ['no argument', []],
  ['two run files', ['check', 'a.json', 'b.json']],
  ['a flag only record takes', ['check', 'run.json', '--tolerance', '0.1']],
  ['an unknown flag', ['check', 'run.json', '--ci']],
  ['a --baseline with no value', ['check', 'run.json', '--baseline']],
  ['a --baseline whose value is a flag', ['check', 'run.json', '--baseline', '--strict']],
  ['two --baseline flags', ['check', 'run.json', '--baseline', 'a', '--baseline', 'b']],
  ['two --strict flags', ['check', 'run.json', '--strict', '--strict']],
]) {
  test(`has no Action inputs for ${label}, because the Action only runs check with its three inputs`, () => {
    assert.equal(inputs(argv), null);
  });
}
