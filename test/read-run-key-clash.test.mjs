import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRun } from '../src/read-run.mjs';
import { editedPromptfoo, feedMetrics, refusal } from './support/read-run.mjs';

const runOfTwoPrompts = (first, second) =>
  editedPromptfoo((document) => {
    const [template] = document.results.prompts;
    document.results.prompts = [first, second].map(([provider, metric, weightTotal]) => ({
      ...template,
      provider,
      metrics: {
        ...template.metrics,
        namedScores: { [metric]: 1 },
        namedScoresCount: { [metric]: 4 },
        namedScoreWeights: { [metric]: weightTotal },
      },
    }));
    feedMetrics(document, first[1], second[1]);
  });

const clashingRun = (firstWeightTotal, secondWeightTotal) =>
  runOfTwoPrompts(['agent', 'accuracy :: x', firstWeightTotal], ['agent :: accuracy', 'x', secondWeightTotal]);

const producedTwice = '"run.json": the metric key "agent :: accuracy :: x" is produced twice';

test('promptfoo: two prompts whose provider label and metric name build the same key are refused when the reader accepts both metrics', () => {
  assert.equal(refusal(clashingRun(4, 4)), producedTwice);
});

test('promptfoo: a key built twice is refused when the reader refuses one of the two metrics, whichever one', () => {
  assert.equal(refusal(clashingRun(0, 4)), producedTwice);
  assert.equal(refusal(clashingRun(4, 0)), producedTwice);
});

test('promptfoo: a key built twice is refused when the reader refuses both metrics', () => {
  assert.equal(refusal(clashingRun(0, 0)), producedTwice);
  assert.equal(refusal(clashingRun(-1, 'x')), producedTwice);
});

test('promptfoo: prompts that build different keys are read together, and a refused metric is listed apart', () => {
  const mixed = readRun(runOfTwoPrompts(['agent', 'accuracy :: x', 4], ['agent :: accuracy', 'y', 0]), 'run.json');
  assert.deepEqual(mixed.metrics, [{ key: 'agent :: accuracy :: x', value: 0.25, samples: 4 }]);
  assert.deepEqual(mixed.refused, [
    { key: 'agent :: accuracy :: y', reason: "promptfoo's weight total for it is 0, which is not a positive number" },
  ]);
  const accepted = readRun(runOfTwoPrompts(['agent', 'accuracy :: x', 4], ['agent :: accuracy', 'y', 4]), 'run.json');
  assert.deepEqual(
    accepted.metrics.map((metric) => metric.key),
    ['agent :: accuracy :: x', 'agent :: accuracy :: y'],
  );
  assert.deepEqual(accepted.refused, []);
});
