import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRun } from '../src/read-run.mjs';
import { readFixtureText } from './support/fixtures.mjs';

const UNKNOWN_DIRECTION =
  "DeepEval 4.2.0 reversed this metric's score, and no verdict in this file shows which way it runs; run it again on DeepEval 4.2.0 or later with strict mode off and the default threshold";
const CONTRADICTED =
  "DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only";

const direction = (file, edit = () => {}) => {
  const document = JSON.parse(readFixtureText('deepeval', `direction/${file}`));
  edit(document);
  return readRun(JSON.stringify(document), file);
};
const metricOf = (run, key = 'Bias') => run.metrics.find((metric) => metric.key === key);
const refusalOf = (run, key = 'Bias') => run.refused.find((entry) => entry.key === key)?.reason;
const renamed = (name) => (document) => {
  document.metricsScores.forEach((entry) => {
    entry.metric = entry.metric === 'Bias' ? name : entry.metric;
  });
  document.testCases.forEach((testCase) =>
    testCase.metricsData.forEach((sample) => {
      sample.name = sample.name === 'Bias' ? name : sample.name;
    }),
  );
};

test('deepeval direction: real 4.2.0 exports of a clean and a mixed run read as higher-is-better', () => {
  assert.deepEqual(metricOf(direction('bias-4.2.0-clean.json')), { key: 'Bias', value: 1, samples: 4 });
  assert.deepEqual(metricOf(direction('bias-4.2.0-mixed.json')), { key: 'Bias', value: 0.75, samples: 4 });
});

test('deepeval direction: real exports from the latest release read the same way', () => {
  assert.deepEqual(metricOf(direction('bias-4.3.3-clean.json')), { key: 'Bias', value: 1, samples: 4 });
  assert.deepEqual(metricOf(direction('bias-4.3.3-mixed.json')), { key: 'Bias', value: 0.75, samples: 4 });
});

test('deepeval direction: a strict 4.2.0 run, where score and threshold are both 1, still reads', () => {
  assert.deepEqual(metricOf(direction('bias-4.2.0-clean-strict.json')), { key: 'Bias', value: 1, samples: 4 });
});

test('deepeval direction: a strict 4.1.10 run, where score and threshold are both 0, is refused and not read as a perfect 0', () => {
  const run = direction('bias-4.1.10-clean-strict.json');
  assert.equal(metricOf(run), undefined);
  assert.equal(refusalOf(run), UNKNOWN_DIRECTION);
});

test('deepeval direction: a 4.1.10 run with threshold 0 is refused although another metric in the file has clear verdicts', () => {
  const run = direction('bias-4.1.10-clean-threshold-0.json');
  assert.deepEqual(metricOf(run, 'Accuracy'), { key: 'Accuracy', value: 1, samples: 4 });
  assert.equal(metricOf(run), undefined);
  assert.equal(refusalOf(run), UNKNOWN_DIRECTION);
});

test('deepeval direction: a 4.2.0 run with threshold 1 and no strict mode is refused, which is the cost of not guessing', () => {
  const run = direction('bias-4.2.0-clean-threshold-1.json');
  assert.equal(metricOf(run), undefined);
  assert.equal(refusalOf(run), UNKNOWN_DIRECTION);
});

test('deepeval direction: 4.1.10 runs whose verdicts show the old direction keep the old refusal', () => {
  assert.equal(refusalOf(direction('bias-4.1.10-clean.json')), CONTRADICTED);
  assert.equal(refusalOf(direction('bias-4.1.10-mixed.json')), CONTRADICTED);
});

test('deepeval direction: one verdict that is not a tie is enough to read the metric', () => {
  const run = direction('bias-4.2.0-clean-threshold-1.json', (document) => {
    const sample = document.testCases[0].metricsData.find((entry) => entry.name === 'Bias');
    Object.assign(sample, { score: 0.5, success: false });
    document.metricsScores.find((entry) => entry.metric === 'Bias').scores[0] = 0.5;
  });
  assert.deepEqual(metricOf(run), { key: 'Bias', value: 0.875, samples: 4 });
});

test('deepeval direction: the four reversed metrics are Bias, Hallucination, Misuse and Toxicity', () => {
  for (const name of ['Hallucination', 'Misuse', 'Toxicity']) {
    const run = direction('bias-4.1.10-clean-strict.json', renamed(name));
    assert.equal(metricOf(run, name), undefined, name);
    assert.equal(refusalOf(run, name), UNKNOWN_DIRECTION, name);
  }
});

test('deepeval direction: known limit, a metric outside those four is read from tied verdicts', () => {
  const run = direction('bias-4.1.10-clean-strict.json', renamed('Answer Relevancy'));
  assert.deepEqual(metricOf(run, 'Answer Relevancy'), { key: 'Answer Relevancy', value: 0, samples: 4 });
  assert.deepEqual(run.refused, []);
});
