import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRun } from '../src/read-run.mjs';
import { promptfooDigest, promptfooSwappedDigest, promptfooThreeCasesDigest } from './support/digests.mjs';
import { readFixtureText } from './support/fixtures.mjs';
import { brokenField, editedPromptfoo, feedMetrics, promptfoo, refusal } from './support/read-run.mjs';

test('promptfoo: a good run is read into a tool, a version, a shape, cases and keyed metrics', () => {
  assert.deepEqual(promptfoo('run-good.json'), {
    name: 'run-good.json',
    tool: 'promptfoo',
    toolVersion: '0.125.1',
    shape: 'promptfoo-results-3',
    cases: { count: 4, digest: promptfooDigest },
    metrics: [
      { key: 'agent :: accuracy', value: 1, samples: 4 },
      { key: 'agent :: format', value: 1, samples: 4 },
    ],
    refused: [],
    errors: [],
  });
});

test('promptfoo: two separate runs of one suite read to the same metrics and the same digest', () => {
  const first = promptfoo('run-good.json');
  const second = promptfoo('run-good-again.json');
  assert.deepEqual({ ...second, name: first.name }, first);
});

test('promptfoo: a worse agent lowers the value and keeps the sample count', () => {
  const run = promptfoo('run-worse.json');
  assert.deepEqual(run.metrics, [
    { key: 'agent :: accuracy', value: 0.75, samples: 4 },
    { key: 'agent :: format', value: 1, samples: 4 },
  ]);
  assert.equal(run.cases.digest, promptfooDigest);
});

test('promptfoo: removing an assertion removes its metric and leaves the digest alone', () => {
  const run = promptfoo('run-nometric.json');
  assert.deepEqual(run.metrics, [{ key: 'agent :: accuracy', value: 1, samples: 4 }]);
  assert.equal(run.cases.digest, promptfooDigest);
});

test('promptfoo: an added metric is listed in key order and leaves the digest alone', () => {
  const run = promptfoo('run-extra.json');
  assert.deepEqual(
    run.metrics.map((metric) => metric.key),
    ['agent :: accuracy', 'agent :: extra', 'agent :: format'],
  );
  assert.equal(run.cases.digest, promptfooDigest);
});

test('promptfoo: a provider error lowers the metric sample counts to 3, keeps 4 cases and is reported as an error', () => {
  const run = promptfoo('run-error-one.json');
  assert.deepEqual(
    run.metrics.map((metric) => [metric.key, metric.value, metric.samples]),
    [
      ['agent :: accuracy', 1, 3],
      ['agent :: format', 1, 3],
    ],
  );
  assert.deepEqual(run.errors, ['"agent": 1 errored test(s) in this run (promptfoo testErrorCount)']);
  assert.deepEqual(run.cases, { count: 4, digest: promptfooDigest });
});

test('promptfoo: a suite with no named metric reads to no metrics and no error', () => {
  const run = promptfoo('run-unnamed.json');
  assert.deepEqual(run.metrics, []);
  assert.deepEqual(run.errors, []);
  assert.deepEqual(run.cases, { count: 4, digest: promptfooDigest });
});

test('promptfoo: three cases and a swapped case give their own digests', () => {
  assert.deepEqual(promptfoo('run-3tests.json').cases, { count: 3, digest: promptfooThreeCasesDigest });
  assert.deepEqual(promptfoo('run-swapped.json').cases, { count: 4, digest: promptfooSwappedDigest });
});

test('promptfoo: a weighted metric is divided by its weight total, not by its sample count', () => {
  const run = promptfoo('run-weighted.json');
  assert.deepEqual(run.metrics, [
    { key: 'agent :: accuracy', value: 0.9375, samples: 8 },
    { key: 'agent :: format', value: 1, samples: 4 },
  ]);
});

test('promptfoo: a metric without a weight total is divided by its sample count', () => {
  const text = editedPromptfoo((document) => {
    delete document.results.prompts[0].metrics.namedScoreWeights;
    document.results.prompts[0].metrics.namedScores.accuracy = 3;
  });
  const run = readRun(text, 'run.json');
  assert.deepEqual(run.metrics[0], { key: 'agent :: accuracy', value: 0.75, samples: 4 });
});

test('promptfoo: a metric name with a newline, a workflow command and an escape character is kept as data', () => {
  const run = promptfoo('run-injection.json');
  assert.deepEqual(
    run.metrics.map((metric) => metric.key),
    ['agent :: accuracy', 'agent :: bad\n::error::pwned\u001b[31m', 'agent :: format'],
  );
});

test('promptfoo: two providers give keys for each provider label', () => {
  const run = promptfoo('run-two-providers.json');
  assert.deepEqual(run.metrics, [
    { key: 'agent :: accuracy', value: 1, samples: 4 },
    { key: 'agent :: format', value: 1, samples: 4 },
    { key: 'agent-b :: accuracy', value: 0.75, samples: 4 },
    { key: 'agent-b :: format', value: 1, samples: 4 },
  ]);
  assert.equal(run.cases.count, 4);
});

test('promptfoo: two prompts under one provider label are refused', () => {
  assert.equal(
    refusal(readFixtureText('promptfoo', 'run-two-prompts.json'), 'two.json'),
    '"two.json": two prompts share the provider label "agent"; this implementation reads one prompt per provider',
  );
});

test('promptfoo: a derived metric that has no sample count is skipped', () => {
  const text = editedPromptfoo((document) => {
    document.results.prompts[0].metrics.namedScores.derived = 2;
  });
  assert.deepEqual(
    readRun(text, 'run.json').metrics.map((metric) => metric.key),
    ['agent :: accuracy', 'agent :: format'],
  );
});

test('promptfoo: a metric with a weight total that is not a positive number is refused and left out of the metrics', () => {
  for (const weight of [0, -4, 'four']) {
    const text = editedPromptfoo((document) => {
      document.results.prompts[0].metrics.namedScoreWeights.accuracy = weight;
    });
    const run = readRun(text, 'run.json');
    assert.deepEqual(
      run.metrics.map((metric) => metric.key),
      ['agent :: format'],
    );
    assert.deepEqual(run.refused, [
      {
        key: 'agent :: accuracy',
        reason: `promptfoo's weight total for it is ${JSON.stringify(weight)}, which is not a positive number`,
      },
    ]);
  }
});

test('promptfoo: a metric with a zero sample count is not sample-bearing', () => {
  const text = editedPromptfoo((document) => {
    document.results.prompts[0].metrics.namedScoresCount.accuracy = 0;
  });
  assert.deepEqual(
    readRun(text, 'run.json').metrics.map((metric) => metric.key),
    ['agent :: format'],
  );
});

test('promptfoo: a metric name that is __proto__ is an ordinary key', () => {
  const text = editedPromptfoo((document) => {
    const metrics = document.results.prompts[0].metrics;
    for (const field of ['namedScores', 'namedScoresCount', 'namedScoreWeights']) {
      Object.defineProperty(metrics[field], '__proto__', { value: field === 'namedScores' ? 2 : 4, enumerable: true, configurable: true, writable: true });
    }
    feedMetrics(document, '__proto__');
  });
  const run = readRun(text, 'run.json');
  assert.deepEqual(
    run.metrics.map((metric) => metric.key),
    ['agent :: __proto__', 'agent :: accuracy', 'agent :: format'],
  );
  assert.equal(run.metrics[0].value, 0.5);
});

test('promptfoo: the tool version is null when the output carries none', () => {
  const text = editedPromptfoo((document) => {
    delete document.metadata;
  });
  assert.equal(readRun(text, 'run.json').toolVersion, null);
});

test('promptfoo: a tool version that is not a string is refused', () => {
  const text = editedPromptfoo((document) => {
    document.metadata.promptfooVersion = 125;
  });
  assert.match(refusal(text), /^"run\.json": metadata\.promptfooVersion is missing or is not a string$/);
});

test('promptfoo: a results version other than 3 is refused and named', () => {
  const text = editedPromptfoo((document) => {
    document.results.version = 4;
  });
  assert.equal(refusal(text, 'v4.json'), '"v4.json": promptfoo results version 4 is not read; this implementation reads version 3');
});

test('promptfoo: every field the reader needs is checked for presence and type, and the refusal names the path', () => {
  const cases = [
    ['results.prompts', (d) => delete d.results.prompts, 'an array'],
    ['results.results', (d) => delete d.results.results, 'an array'],
    ['results.prompts[0].provider', (d) => delete d.results.prompts[0].provider, 'a string'],
    ['results.prompts[0].metrics', (d) => delete d.results.prompts[0].metrics, 'an object'],
    ['results.prompts[0].metrics.testErrorCount', (d) => delete d.results.prompts[0].metrics.testErrorCount, 'a number'],
    ['results.prompts[0].metrics.namedScores', (d) => delete d.results.prompts[0].metrics.namedScores, 'an object'],
    ['results.prompts[0].metrics.namedScoresCount', (d) => delete d.results.prompts[0].metrics.namedScoresCount, 'an object'],
    ['results.prompts[0].metrics.namedScoreWeights', (d) => (d.results.prompts[0].metrics.namedScoreWeights = [1]), 'an object'],
    ['results.prompts[0].metrics.namedScores["accuracy"]', (d) => delete d.results.prompts[0].metrics.namedScores.accuracy, 'a number'],
    ['results.prompts[0].metrics.namedScoresCount["accuracy"]', (d) => (d.results.prompts[0].metrics.namedScoresCount.accuracy = 1.5), 'a non-negative integer'],
    ['results.results[0].testIdx', (d) => delete d.results.results[0].testIdx, 'a number'],
    ['results.results[0].testCase', (d) => delete d.results.results[0].testCase, 'an object'],
    ['results.results[0].testCase.vars', (d) => (d.results.results[0].testCase.vars = 'x'), 'an object'],
  ];
  for (const [path, edit, expected] of cases) {
    const text = editedPromptfoo(edit);
    assert.equal(refusal(text), `${brokenField(path)} ${expected}`, path);
  }
});

test('promptfoo: a test without vars is a case with no variables', () => {
  const text = editedPromptfoo((document) => {
    for (const result of document.results.results) {
      delete result.testCase.vars;
    }
  });
  assert.deepEqual(readRun(text, 'run.json').cases.count, 4);
});

test('promptfoo: a value outside the range that millionths can hold exactly is refused', () => {
  const text = editedPromptfoo((document) => {
    document.results.prompts[0].metrics.namedScores.accuracy = 1e12;
    document.results.prompts[0].metrics.namedScoreWeights.accuracy = 4;
  });
  assert.equal(refusal(text), '"run.json": the value of "agent :: accuracy" is out of range');
});
