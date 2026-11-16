import assert from 'node:assert/strict';
import { readRun } from '../../src/read-run.mjs';
import { Unreadable } from '../../src/unreadable.mjs';
import { editedFixture, readFixtureText } from './fixtures.mjs';

export const promptfoo = (file) => readRun(readFixtureText('promptfoo', file), file);
export const deepeval = (file) => readRun(readFixtureText('deepeval', file), file);
export const refusal = (text, name = 'run.json') => {
  try {
    readRun(text, name);
  } catch (error) {
    assert.equal(error instanceof Unreadable, true, `expected Unreadable, got ${error}`);
    return error.message;
  }
  return assert.fail('expected the reader to refuse');
};
export const editedPromptfoo = (edit) => editedFixture('promptfoo', 'run-good.json', edit);
export const editedDeepeval = (edit) => editedFixture('deepeval', 'run-good.json', edit);
export const feedMetrics = (document, ...metricNames) => {
  for (const result of document.results.results) {
    for (const metric of metricNames) {
      result.gradingResult.componentResults.push({ pass: true, score: 1, reason: 'fed for the test', assertion: { type: 'contains', metric } });
    }
  }
};
export const withAccuracyTotals = (sum, weightTotal) =>
  editedPromptfoo((document) => {
    const { metrics } = document.results.prompts[0];
    metrics.namedScores.accuracy = sum;
    if (weightTotal === undefined) {
      delete metrics.namedScoreWeights.accuracy;
    } else {
      metrics.namedScoreWeights.accuracy = weightTotal;
    }
  });

export const brokenField = (path) => `"run.json": ${path} is missing or is not`;
