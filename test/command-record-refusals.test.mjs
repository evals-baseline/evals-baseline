import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { banner, erroredNote, promptfooFile, promptfooIo } from './support/command.mjs';
import { editedFixture } from './support/fixtures.mjs';
import { makeIo } from './support/io.mjs';

const discardsTolerances =
  'the existing baseline cannot be read, so recording over it would discard its tolerances; fix it or delete it, then record again';

const noCases = `${banner} record: refused: the run holds no cases, so a baseline of it would guard nothing; nothing written`;

const unreadableBaselines = [
  ['a misspelt tolerance key', promptfooFile('planted/baseline-misspelt-key.json'), 'unknown key "tolerence" in metrics["agent :: accuracy"]'],
  ['specification 2.0', promptfooFile('planted/baseline-other-major.json'), 'specification 2.0 is not read by this implementation, which reads 1.x up to 1.0'],
  ['specification 1.1', promptfooFile('planted/baseline-newer-minor.json'), 'specification 1.1 is newer than 1.0, the newest this implementation reads'],
  ['no source', '{"spec": "1.0"}', 'missing key "source" in the baseline'],
  ['text that stops half way', '{"spec": "1.0", "source": {', 'not JSON'],
  ['no text at all', '', 'not JSON'],
];

for (const [description, existing, reason] of unreadableBaselines) {
  test(`record over a baseline with ${description} refuses, writes nothing and leaves the file as it was`, () => {
    const io = promptfooIo('run-good.json', { 'evals-baseline.json': existing });
    const output = cli(['record', 'run-good.json'], io);
    assert.deepEqual(output.stdout, [`${banner} record: refused: "evals-baseline.json": ${reason}; ${discardsTolerances}; nothing written`]);
    assert.equal(output.code, 3);
    assert.deepEqual(io.writes, []);
    assert.equal(io.store.get('evals-baseline.json'), existing);
  });
}

test('the refusal over an unreadable baseline holds neither a raw U+2028 nor a raw ##[ from a hostile key of that baseline', () => {
  const existing = promptfooFile('planted/baseline-misspelt-key.json').replace('"tolerence"', '"tolerence\\u2028##[x"');
  const output = cli(['record', 'run-good.json'], promptfooIo('run-good.json', { 'evals-baseline.json': existing }));
  const [line] = output.stdout;
  assert.equal(output.stdout.length, 1);
  assert.equal(line.includes('\u2028'), false);
  assert.equal(line.includes('##[x'), false);
  assert.ok(line.startsWith(`${banner} record: refused: "evals-baseline.json": unknown key "tolerence`), line);
  assert.ok(line.endsWith(`; ${discardsTolerances}; nothing written`), line);
  assert.equal(output.code, 3);
});

const emptyPromptfoo = (file) =>
  editedFixture('promptfoo', file, (document) => {
    document.results.results = [];
  });

const emptyDeepeval = (file) =>
  editedFixture('deepeval', file, (document) => {
    document.testCases = [];
  });

const erroredPromptfoo = `${banner} record: refused: the run has errored samples ("agent": 1 errored test(s) in this run (promptfoo testErrorCount)); fix them and run the suite again; nothing written`;

const erroredDeepeval = `${banner} record: refused: the run has errored samples (${erroredNote('Accuracy')}; ${erroredNote('Format')}); fix them and run the suite again; nothing written`;

const runsWithNoCases = [
  ['a promptfoo run with no cases', emptyPromptfoo('run-good.json'), noCases],
  ['a DeepEval run with no test cases', emptyDeepeval('run-good.json'), noCases],
  ['a promptfoo run with no cases and no named metric, naming the lack of cases first', emptyPromptfoo('run-unnamed.json'), noCases],
  ['a promptfoo run with no cases and an errored test, naming the errored test first', emptyPromptfoo('run-error-one.json'), erroredPromptfoo],
  ['a DeepEval run with no test cases and errored samples, naming the errored samples first', emptyDeepeval('run-error-one.json'), erroredDeepeval],
];

for (const [description, text, line] of runsWithNoCases) {
  test(`record refuses ${description}, exits 3 and writes nothing`, () => {
    const io = makeIo({ 'run.json': text });
    const output = cli(['record', 'run.json'], io);
    assert.deepEqual(output.stdout, [line]);
    assert.equal(output.code, 3);
    assert.deepEqual(io.writes, []);
  });
}
