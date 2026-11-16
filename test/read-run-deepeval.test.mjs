import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRun } from '../src/read-run.mjs';
import { deepevalDigest, deepevalSwappedDigest, deepevalThreeCasesDigest } from './support/digests.mjs';
import { readFixtureText } from './support/fixtures.mjs';
import { brokenField, deepeval, editedDeepeval, refusal } from './support/read-run.mjs';

test('deepeval: a good run is read into cases, no version and keyed metrics', () => {
  assert.deepEqual(deepeval('run-good.json'), {
    name: 'run-good.json',
    tool: 'deepeval',
    toolVersion: null,
    shape: 'deepeval-test-run',
    cases: { count: 4, digest: deepevalDigest },
    metrics: [
      { key: 'Accuracy', value: 1, samples: 4 },
      { key: 'Format', value: 1, samples: 4 },
    ],
    refused: [],
    errors: [],
  });
});

test('deepeval: two separate runs of one suite read to the same metrics and the same digest', () => {
  const first = deepeval('run-good.json');
  assert.deepEqual({ ...deepeval('run-good-again.json'), name: first.name }, first);
});

test('deepeval: a worse agent lowers the mean and keeps the sample count', () => {
  assert.deepEqual(deepeval('run-worse.json').metrics, [
    { key: 'Accuracy', value: 0.75, samples: 4 },
    { key: 'Format', value: 1, samples: 4 },
  ]);
});

test('deepeval: a run with one metric keeps only that metric', () => {
  assert.deepEqual(deepeval('run-nometric.json').metrics, [{ key: 'Accuracy', value: 1, samples: 4 }]);
});

test('deepeval: built-in local metrics read as their own keys, in key order', () => {
  assert.deepEqual(
    deepeval('run-extra.json').metrics.map((metric) => [metric.key, metric.samples]),
    [
      ['Accuracy', 4],
      ['Exact Match', 4],
      ['Format', 4],
      ['Pattern Match', 4],
    ],
  );
});

test('deepeval: three cases and a swapped case give their own digests', () => {
  const dropped = deepeval('run-drop-one.json');
  assert.deepEqual(dropped.cases, { count: 3, digest: deepevalThreeCasesDigest });
  assert.deepEqual(
    dropped.metrics.map((metric) => metric.samples),
    [3, 3],
  );
  assert.deepEqual(deepeval('run-swap.json').cases, { count: 4, digest: deepevalSwappedDigest });
});

test('deepeval: samples DeepEval counted as errors lower the sample count and are reported per metric', () => {
  const run = deepeval('run-error-one.json');
  assert.deepEqual(
    run.metrics.map((metric) => [metric.key, metric.value, metric.samples]),
    [
      ['Accuracy', 1, 3],
      ['Format', 1, 3],
    ],
  );
  assert.deepEqual(run.errors, [
    '"Accuracy": 1 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)',
    '"Format": 1 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)',
  ]);
  assert.deepEqual(run.cases, { count: 4, digest: deepevalDigest });
});

test('deepeval: a score-only metric has no samples, is not a metric and is reported as errors', () => {
  const run = deepeval('run-score-only.json');
  assert.deepEqual(
    run.metrics.map((metric) => metric.key),
    ['Accuracy', 'Format'],
  );
  assert.deepEqual(run.errors, [
    '"Brevity": 4 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)',
  ]);
  assert.deepEqual(run.refused, []);
});

test("deepeval: a metric whose own verdicts contradict higher-is-better is refused with DeepEval's evidence", () => {
  const run = deepeval('run-inverted.json');
  assert.deepEqual(
    run.metrics.map((metric) => metric.key),
    ['Accuracy', 'Format'],
  );
  assert.deepEqual(run.refused, [
    {
      key: 'Failure rate',
      reason:
        "DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only",
    },
  ]);
  assert.deepEqual(run.errors, []);
});

test('deepeval: one contradicting sample is enough, in either direction, and only contradictions are counted', () => {
  const oneTooLow = editedDeepeval((document) => {
    const sample = document.testCases[2].metricsData[0];
    sample.score = 0.2;
    sample.success = true;
  });
  const first = readRun(oneTooLow, 'run.json');
  assert.deepEqual(first.refused, [
    {
      key: 'Accuracy',
      reason:
        "DeepEval's own verdicts contradict higher-is-better in 1 sample(s) (success=true, score=0.2, threshold=0.5); this implementation reads higher-is-better metrics only",
    },
  ]);
  assert.deepEqual(
    first.metrics.map((metric) => metric.key),
    ['Format'],
  );
  const oneTooHigh = editedDeepeval((document) => {
    const sample = document.testCases[0].metricsData[1];
    sample.score = 0.9;
    sample.success = false;
  });
  assert.match(readRun(oneTooHigh, 'run.json').refused[0].reason, /in 1 sample\(s\) \(success=false, score=0\.9, threshold=0\.5\)/);
});

test('deepeval: a verdict that agrees with higher-is-better on the threshold itself is not a contradiction', () => {
  const text = editedDeepeval((document) => {
    const sample = document.testCases[0].metricsData[0];
    sample.score = 0.5;
    sample.success = true;
  });
  assert.deepEqual(readRun(text, 'run.json').refused, []);
});

test('deepeval: samples without a numeric score, a numeric threshold and a boolean verdict are no evidence', () => {
  const text = editedDeepeval((document) => {
    const sample = document.testCases[0].metricsData[0];
    delete sample.threshold;
    sample.success = false;
  });
  assert.deepEqual(readRun(text, 'run.json').refused, []);
});

test('deepeval: a test case without an expected output has the null expected output as its identity', () => {
  const text = editedDeepeval((document) => {
    delete document.testCases[3].expectedOutput;
  });
  const run = readRun(text, 'run.json');
  assert.equal(run.cases.count, 4);
  assert.notEqual(run.cases.digest, deepevalDigest);
});

test('the DeepEval rolling wrapper file is refused with the file to use instead', () => {
  assert.equal(
    refusal(readFixtureText('deepeval', 'wrapped.json'), 'wrapped.json'),
    '"wrapped.json": this is DeepEval .latest_test_run.json, which wraps the run in testRunData; read .latest_run_full.json or a test_run_*.json file',
  );
});

test('deepeval: a conversational test case is refused', () => {
  const text = editedDeepeval((document) => {
    document.conversationalTestCases = [{ name: 'chat' }];
  });
  assert.equal(refusal(text, 'chat.json'), '"chat.json": conversationalTestCases is not empty; this implementation does not read multi-turn runs');
});

test('deepeval: every field the reader needs is checked for presence and type, and the refusal names the path', () => {
  const cases = [
    ['testCases[0]', (d) => (d.testCases[0] = 'x'), 'an object'],
    ['testCases[0].input', (d) => delete d.testCases[0].input, 'a string'],
    ['testCases[0].expectedOutput', (d) => (d.testCases[0].expectedOutput = 4), 'a string'],
    ['metricsScores[0]', (d) => (d.metricsScores[0] = null), 'an object'],
    ['metricsScores[0].metric', (d) => delete d.metricsScores[0].metric, 'a string'],
    ['metricsScores[0].scores', (d) => delete d.metricsScores[0].scores, 'an array'],
    ['metricsScores[0].scores[1]', (d) => (d.metricsScores[0].scores[1] = 'x'), 'a number'],
    ['metricsScores[0].errors', (d) => delete d.metricsScores[0].errors, 'a non-negative integer'],
  ];
  for (const [path, edit, expected] of cases) {
    assert.equal(refusal(editedDeepeval(edit)), `${brokenField(path)} ${expected}`, path);
  }
});

test('deepeval: a metric reported twice is refused', () => {
  const text = editedDeepeval((document) => {
    document.metricsScores.push(structuredClone(document.metricsScores[0]));
  });
  assert.equal(refusal(text), '"run.json": metricsScores names the metric "Accuracy" twice');
});

test('deepeval: a metric data list that is not an array is refused', () => {
  const text = editedDeepeval((document) => {
    document.testCases[1].metricsData = {};
  });
  assert.equal(refusal(text), '"run.json": testCases[1].metricsData is not an array');
});
