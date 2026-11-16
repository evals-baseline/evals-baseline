import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRun } from '../src/read-run.mjs';
import { editedPromptfoo, withAccuracyTotals } from './support/read-run.mjs';

test('promptfoo: a weight total of exactly one or of one half is a positive number, and the value is the sum divided by the weight total', () => {
  const table = [
    [1, 1, 1],
    [1, 0.5, 2],
    [3, 1, 3],
    [0.5, 0.25, 2],
    [0.000001, 0.000001, 1],
  ];
  for (const [sum, weightTotal, value] of table) {
    const run = readRun(withAccuracyTotals(sum, weightTotal), 'run.json');
    assert.deepEqual(run.metrics[0], { key: 'agent :: accuracy', value, samples: 4 }, `${sum} over ${weightTotal}`);
    assert.deepEqual(run.refused, [], `${sum} over ${weightTotal}`);
  }
});

test('promptfoo: a weight total of zero, of minus one, of a string, of null, of true, of false, of a list or of an object is refused with the weight in the reason', () => {
  const weights = [
    [0, '0'],
    [-1, '-1'],
    ['1', '"1"'],
    [null, 'null'],
    [true, 'true'],
    [false, 'false'],
    [[2], '"[2]"'],
    [{}, '"{}"'],
    [{ a: 1 }, '"{\\u0022a\\u0022:1}"'],
    ['a"b\\c', '"a\\u0022b\\\\c"'],
  ];
  for (const [weightTotal, spelled] of weights) {
    const run = readRun(withAccuracyTotals(1, weightTotal), 'run.json');
    const label = JSON.stringify(weightTotal);
    assert.deepEqual(
      run.metrics.map((metric) => metric.key),
      ['agent :: format'],
      label,
    );
    assert.deepEqual(
      run.refused,
      [{ key: 'agent :: accuracy', reason: `promptfoo's weight total for it is ${spelled}, which is not a positive number` }],
      label,
    );
  }
});

test('promptfoo: a weight total written as 1e999, which reads as infinity, is refused instead of reading the metric as zero', () => {
  for (const literal of ['1e999', '-1e999']) {
    const run = readRun(withAccuracyTotals(4, '__WEIGHT__').replace('"__WEIGHT__"', literal), 'run.json');
    assert.deepEqual(run.metrics.map((metric) => metric.key), ['agent :: format'], literal);
    assert.equal(run.refused.length, 1, literal);
    assert.equal(run.refused[0].key, 'agent :: accuracy', literal);
    assert.match(run.refused[0].reason, /^promptfoo's weight total for it is .*, which is not a positive number$/, literal);
  }
});

test('promptfoo: a metric with no entry in namedScoreWeights is divided by its sample count while its neighbour is divided by its weight total', () => {
  const text = editedPromptfoo((document) => {
    const { metrics } = document.results.prompts[0];
    delete metrics.namedScoreWeights.accuracy;
    metrics.namedScores.accuracy = 3;
    metrics.namedScores.format = 2;
    metrics.namedScoreWeights.format = 0.5;
  });
  assert.deepEqual(readRun(text, 'run.json').metrics, [
    { key: 'agent :: accuracy', value: 0.75, samples: 4 },
    { key: 'agent :: format', value: 4, samples: 4 },
  ]);
});
