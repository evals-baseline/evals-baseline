import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caseDigest } from '../src/digest.mjs';
import { readRun } from '../src/read-run.mjs';
import { readFixtureText } from './support/fixtures.mjs';
import { brokenField, deepeval, editedDeepeval, refusal } from './support/read-run.mjs';

test('deepeval: a score of infinity is refused as not a number', () => {
  const text = editedDeepeval((document) => {
    document.metricsScores[0].scores[1] = 'INFINITY';
  }).replace('"INFINITY"', '1e999');
  assert.equal(refusal(text), `${brokenField('metricsScores[0].scores[1]')} a number`);
});

test('deepeval: error notes and refused metrics are listed in key order whatever order the metrics arrive in', () => {
  const text = editedDeepeval((document) => {
    document.metricsScores.reverse();
    for (const entry of document.metricsScores) {
      entry.errors = 1;
    }
    for (const testCase of document.testCases) {
      for (const sample of testCase.metricsData) {
        sample.success = false;
      }
    }
  });
  const run = readRun(text, 'run.json');
  assert.deepEqual(
    run.refused.map((metric) => metric.key),
    ['Accuracy', 'Format'],
  );
  assert.deepEqual(
    run.errors.map((note) => note.split(':')[0]),
    ['"Accuracy"', '"Format"'],
  );
});

test('deepeval: a sample that is not a complete, correctly typed verdict is no evidence, whatever it claims', () => {
  const samples = [
    null,
    'sample',
    7,
    [],
    { name: 'Accuracy', score: '0.2', threshold: 0.5, success: true },
    { name: 'Accuracy', score: 0.2, threshold: '0.5', success: true },
    { name: 'Accuracy', score: 0.2, threshold: 0.5, success: 'true' },
    { name: 'Accuracy', score: 0.2, threshold: 0.5, success: null },
    { name: 'Accuracy', score: 0.2, threshold: 0.5 },
    { name: 'Accuracy', score: 0.2, success: true },
    { name: 'Accuracy', threshold: 0.5, success: true },
    { score: 0.2, threshold: 0.5, success: true },
    { name: 5, score: 0.2, threshold: 0.5, success: true },
  ];
  for (const sample of samples) {
    const text = editedDeepeval((document) => {
      document.testCases[0].metricsData.push(structuredClone(sample));
    });
    const run = readRun(text, 'run.json');
    assert.deepEqual(run.refused, [], JSON.stringify(sample));
    assert.deepEqual(
      run.metrics.map((metric) => metric.key),
      ['Accuracy', 'Format'],
      JSON.stringify(sample),
    );
  }
});

test('deepeval: a run without the conversational test case list is read, and a list that is not an array is refused', () => {
  const absent = editedDeepeval((document) => {
    delete document.conversationalTestCases;
  });
  assert.deepEqual({ ...readRun(absent, 'run.json'), name: 'run-good.json' }, deepeval('run-good.json'));
  for (const value of [null, {}, 'chat', 0]) {
    const text = editedDeepeval((document) => {
      document.conversationalTestCases = value;
    });
    assert.equal(refusal(text), `${brokenField('conversationalTestCases')} an array`, JSON.stringify(value));
  }
});

test('deepeval: an empty expected output is its own identity, apart from a missing or null one', () => {
  const digestWith = (expectedOutput) =>
    readRun(
      editedDeepeval((document) => {
        if (expectedOutput === undefined) {
          delete document.testCases[3].expectedOutput;
        } else {
          document.testCases[3].expectedOutput = expectedOutput;
        }
      }),
      'run.json',
    ).cases.digest;
  const identitiesWithLast = (expectedOutput) =>
    JSON.parse(readFixtureText('deepeval', 'run-good.json')).testCases.map(({ input, expectedOutput: recorded }, index) => ({
      input,
      expectedOutput: index === 3 ? expectedOutput : recorded,
    }));
  assert.equal(digestWith(''), caseDigest(identitiesWithLast('')));
  assert.equal(digestWith(undefined), caseDigest(identitiesWithLast(null)));
  assert.equal(digestWith(null), digestWith(undefined));
  assert.notEqual(digestWith(''), digestWith(null));
});
