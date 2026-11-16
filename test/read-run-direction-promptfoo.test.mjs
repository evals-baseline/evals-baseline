import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRun } from '../src/read-run.mjs';
import { readFixtureText } from './support/fixtures.mjs';

const COST_REASON =
  'promptfoo scores it as lower-is-better ("cost with no threshold"); this implementation reads higher-is-better metrics only. To compare cost, give the cost assertion a threshold so that it scores pass or fail';
const NOT_JAVASCRIPT_REASON = 'promptfoo scores it as lower-is-better ("not-javascript"); this implementation reads higher-is-better metrics only';
const UNKNOWN_REASON =
  'promptfoo assertion type "future-rubric" feeds it, and this implementation has not checked which way that score runs; update evals-baseline, or use an assertion type it knows';
const MIXED_REASON =
  'promptfoo feeds it from assertions that disagree on which way a score runs ("contains", "cost with no threshold"); give each kind its own metric name';
const NO_ASSERTION_REASON =
  'the file lists no assertion for any metric, so which way its scores run cannot be established; this implementation reads higher-is-better metrics only';

const costRun = (edit = () => {}) => {
  const document = JSON.parse(readFixtureText('promptfoo', 'direction/run-cost.json'));
  edit(document);
  return readRun(JSON.stringify(document), 'run-cost.json');
};
const assertionsOf = (document) =>
  document.results.results.flatMap((result) => result.gradingResult.componentResults.map((component) => component.assertion));
const feeding = (metric, change) => (document) => assertionsOf(document).filter((assertion) => assertion.metric === metric).forEach(change);
const reads = (key, value) => ({ key: `agent :: ${key}`, value, samples: 4 });
const refusalOf = (run, metric) => run.refused.find((entry) => entry.key === `agent :: ${metric}`)?.reason;
const keysOf = (run) => run.metrics.map((metric) => metric.key);

test('promptfoo direction: a real raw cost metric is refused, because a lower number is better', () => {
  const run = costRun();
  assert.deepEqual(run.metrics, [reads('accuracy', 1), reads('within-budget', 1)]);
  assert.deepEqual(run.refused, [{ key: 'agent :: cost', reason: COST_REASON }]);
});

test('promptfoo direction: a cost assertion with a threshold scores pass or fail and is read', () => {
  const run = costRun((document) => {
    feeding('cost', (assertion) => {
      assertion.threshold = 0.01;
    })(document);
    document.results.prompts[0].metrics.namedScores.cost = 4;
  });
  assert.deepEqual(run.metrics, [reads('accuracy', 1), reads('cost', 1), reads('within-budget', 1)]);
  assert.deepEqual(run.refused, []);
});

test('promptfoo direction: a type this tool has never seen refuses the metric it feeds and no other', () => {
  const run = costRun(
    feeding('accuracy', (assertion) => {
      assertion.type = 'future-rubric';
    }),
  );
  assert.equal(refusalOf(run, 'accuracy'), UNKNOWN_REASON);
  assert.deepEqual(keysOf(run), ['agent :: within-budget']);
});

test('promptfoo direction: a metric fed by assertions that disagree on direction is refused', () => {
  const run = costRun(
    feeding('accuracy', (assertion) => {
      assertion.metric = 'cost';
    }),
  );
  assert.equal(refusalOf(run, 'cost'), MIXED_REASON);
});

test('promptfoo direction: not-javascript runs its score against pass and is refused', () => {
  const run = costRun(
    feeding('accuracy', (assertion) => {
      assertion.type = 'not-javascript';
    }),
  );
  assert.equal(refusalOf(run, 'accuracy'), NOT_JAVASCRIPT_REASON);
});

test('promptfoo direction: not-contains keeps score and pass together and is read', () => {
  const run = costRun(
    feeding('accuracy', (assertion) => {
      assertion.type = 'not-contains';
    }),
  );
  assert.deepEqual(run.metrics[0], reads('accuracy', 1));
});

test('promptfoo direction: a cost assertion hidden inside an assert-set is found', () => {
  const run = costRun(
    feeding('accuracy', (assertion) => {
      Object.assign(assertion, { type: 'assert-set', assert: [{ type: 'cost' }] });
    }),
  );
  assert.equal(refusalOf(run, 'accuracy'), COST_REASON);
});

test('promptfoo direction: a file that lists no assertion for any metric cannot show which way a metric runs', () => {
  const run = costRun((document) => {
    for (const result of document.results.results) {
      delete result.gradingResult.componentResults;
    }
  });
  assert.deepEqual(run.metrics, []);
  assert.deepEqual(
    run.refused.map((entry) => [entry.key, entry.reason]),
    ['accuracy', 'cost', 'within-budget'].map((metric) => [`agent :: ${metric}`, NO_ASSERTION_REASON]),
  );
});

test('promptfoo direction: known limit, a metric that no listed assertion names is read when other metrics have assertions', () => {
  const run = costRun((document) => {
    const { metrics } = document.results.prompts[0];
    for (const field of ['namedScores', 'namedScoresCount', 'namedScoreWeights']) {
      metrics[field].renamed = metrics[field].accuracy;
    }
  });
  assert.deepEqual(run.metrics.map((metric) => metric.key), ['agent :: accuracy', 'agent :: renamed', 'agent :: within-budget']);
});

test('promptfoo direction: a run with no results at all is not refused for listing no assertions', () => {
  const run = costRun((document) => {
    document.results.results = [];
  });
  assert.deepEqual(run.metrics.map((metric) => metric.key), ['agent :: accuracy', 'agent :: cost', 'agent :: within-budget']);
  assert.deepEqual(run.refused, []);
});
