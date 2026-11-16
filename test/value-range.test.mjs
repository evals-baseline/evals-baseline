import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBaseline } from '../src/read-baseline.mjs';
import { readRun } from '../src/read-run.mjs';
import { accuracyKey, edited } from './support/read-baseline.mjs';
import { editedDeepeval, refusal, withAccuracyTotals } from './support/read-run.mjs';

test('promptfoo: a value of exactly 4000000000 or minus 4000000000 is read, divided by the weight total or, without one, by the sample count', () => {
  const table = [
    [16000000000, 4, 4000000000],
    [-16000000000, 4, -4000000000],
    [8000000000, 2, 4000000000],
    [-8000000000, 2, -4000000000],
    [16000000000, undefined, 4000000000],
    [-16000000000, undefined, -4000000000],
  ];
  for (const [sum, weightTotal, value] of table) {
    const run = readRun(withAccuracyTotals(sum, weightTotal), 'run.json');
    assert.deepEqual(run.metrics[0], { key: 'agent :: accuracy', value, samples: 4 }, `${sum} over ${weightTotal}`);
  }
});

test('promptfoo: a value beyond 4000000000 or below minus 4000000000 is refused, divided by the weight total or, without one, by the sample count', () => {
  const table = [
    [16000000004, 4],
    [-16000000004, 4],
    [8000000002, 2],
    [-8000000002, 2],
    [16000000004, undefined],
    [-16000000004, undefined],
  ];
  for (const [sum, weightTotal] of table) {
    assert.equal(refusal(withAccuracyTotals(sum, weightTotal)), '"run.json": the value of "agent :: accuracy" is out of range', `${sum} over ${weightTotal}`);
  }
});

test('deepeval: a mean outside the range that millionths can hold exactly is refused, also when the sum overflows', () => {
  for (const scores of [[1e15, 1e15, 1e15, 1e15], [1e308, 1e308]]) {
    const text = editedDeepeval((document) => {
      document.metricsScores[0].scores = scores;
    });
    assert.equal(refusal(text), '"run.json": the value of "Accuracy" is out of range', JSON.stringify(scores));
  }
});

const withAccuracyScores = (scores) =>
  editedDeepeval((document) => {
    document.metricsScores[0].scores = scores;
  });

test('deepeval: a mean of exactly 4000000000 or minus 4000000000 is read, and it is the mean that is judged, not each score', () => {
  const table = [
    [[4000000000, 4000000000, 4000000000, 4000000000], 4000000000],
    [[5000000000, 3000000000], 4000000000],
    [[-4000000000, -4000000000, -4000000000, -4000000000], -4000000000],
    [[-9000000000, 1000000000], -4000000000],
  ];
  for (const [scores, value] of table) {
    const run = readRun(withAccuracyScores(scores), 'run.json');
    assert.deepEqual(run.metrics[0], { key: 'Accuracy', value, samples: scores.length }, JSON.stringify(scores));
  }
});

test('deepeval: a mean beyond 4000000000 or below minus 4000000000 is refused with the metric named', () => {
  const table = [
    [4000000001],
    [4000000001, 4000000001, 4000000001, 4000000001],
    [3000000000, 5000000002],
    [9000000000, 9000000000],
    [-4000000001],
    [-5000000002, -3000000000],
  ];
  for (const scores of table) {
    assert.equal(refusal(withAccuracyScores(scores)), '"run.json": the value of "Accuracy" is out of range', JSON.stringify(scores));
  }
});

test('deepeval: the refusal of a mean out of range names the metric it belongs to', () => {
  const text = editedDeepeval((document) => {
    document.metricsScores[1].scores = [4000000001, 4000000001, 4000000001, 4000000001];
  });
  assert.equal(refusal(text), '"run.json": the value of "Format" is out of range');
});

test('a value of 4000000000 or minus 4000000000 and a tolerance of 4000000000 are read, because their millionths are exact integers', () => {
  const metricWith = (value, tolerance) =>
    readBaseline(
      edited((document) => {
        document.metrics[accuracyKey].value = value;
        document.metrics[accuracyKey].tolerance = tolerance;
      }),
      'b.json',
    ).metrics[0];
  assert.deepEqual(metricWith(4000000000, 4000000000), { key: accuracyKey, value: 4000000000, samples: 4, tolerance: 4000000000 });
  assert.deepEqual(metricWith(-4000000000, 0), { key: accuracyKey, value: -4000000000, samples: 4, tolerance: 0 });
});
