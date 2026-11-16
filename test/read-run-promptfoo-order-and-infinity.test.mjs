import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRun } from '../src/read-run.mjs';
import { brokenField, editedPromptfoo, refusal } from './support/read-run.mjs';

test('promptfoo: a number that is infinity is refused as not a number wherever the reader wants one', () => {
  const cases = [
    ['results.prompts[0].metrics.testErrorCount', (d, value) => (d.results.prompts[0].metrics.testErrorCount = value)],
    ['results.prompts[0].metrics.namedScores["accuracy"]', (d, value) => (d.results.prompts[0].metrics.namedScores.accuracy = value)],
    ['results.results[0].testIdx', (d, value) => (d.results.results[0].testIdx = value)],
  ];
  for (const [path, edit] of cases) {
    const text = editedPromptfoo((document) => edit(document, 'INFINITY')).replace('"INFINITY"', '1e999');
    assert.equal(refusal(text), `${brokenField(path)} a number`, path);
  }
});

test('promptfoo: error notes and refused metrics are listed in key order whatever order the prompts arrive in', () => {
  const text = editedPromptfoo((document) => {
    const { prompts } = document.results;
    const other = structuredClone(prompts[0]);
    other.provider = 'aaa';
    prompts.push(other);
    for (const prompt of prompts) {
      prompt.metrics.testErrorCount = 1;
      prompt.metrics.namedScoreWeights.accuracy = -1;
    }
  });
  const run = readRun(text, 'run.json');
  assert.deepEqual(
    run.refused.map((metric) => metric.key),
    ['aaa :: accuracy', 'agent :: accuracy'],
  );
  assert.deepEqual(
    run.errors.map((note) => note.split(':')[0]),
    ['"aaa"', '"agent"'],
  );
});
