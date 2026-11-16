import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectAssertionLabels, deepevalDirectionRefusal, metricsShownHigherIsBetter, promptfooDirectionRefusal } from '../src/direction.mjs';

const refusalFor = (...labels) => promptfooDirectionRefusal(new Set(labels));
const higherTypes = ['contains', 'icontains', 'regex', 'equals', 'llm-rubric', 'similar', 'similar:cosine', 'is-json', 'latency', 'perplexity', 'cost', 'trajectory:goal-success'];

test('direction: types whose score runs with pass are read, with and without the not- prefix', () => {
  for (const type of [...higherTypes, 'javascript', 'python', 'ruby', 'tool-call-f1']) {
    assert.equal(refusalFor(type), undefined, type);
  }
  for (const type of higherTypes) {
    assert.equal(refusalFor(`not-${type}`), undefined, `not-${type}`);
  }
});

test('direction: the types whose score runs against pass are refused only with the not- prefix', () => {
  for (const type of ['javascript', 'python', 'ruby', 'tool-call-f1']) {
    assert.match(refusalFor(`not-${type}`), /^promptfoo scores it as lower-is-better \(/, type);
  }
});

test('direction: a type that is not on the list, with or without a prefix, is refused as unchecked', () => {
  for (const type of ['select-best', 'not-select-best', 'not-not-contains', '', 'Contains']) {
    assert.match(refusalFor(type), /^promptfoo assertion type ".*" feeds it, and this implementation has not checked/, type);
  }
});

test('direction: a metric with no listed assertion is refused only when the file lists none for any metric', () => {
  assert.equal(promptfooDirectionRefusal(undefined), undefined);
  assert.equal(promptfooDirectionRefusal(new Set()), undefined);
  assert.match(promptfooDirectionRefusal(undefined, true), /^the file lists no assertion for any metric/);
  assert.match(promptfooDirectionRefusal(new Set(), true), /^the file lists no assertion for any metric/);
});

test('direction: labels come from component results, and malformed entries are skipped', () => {
  const labels = collectAssertionLabels([
    null,
    'text',
    { gradingResult: null },
    { gradingResult: { componentResults: 'none' } },
    {
      gradingResult: {
        componentResults: [
          null,
          { assertion: null },
          { assertion: { type: 'contains' } },
          { assertion: { type: 42, metric: 'a' } },
          { assertion: { type: 'contains', metric: 'a' } },
          { assertion: { type: 'cost', metric: 'a' } },
          { assertion: { type: 'not-cost', threshold: 1, metric: 'b' } },
        ],
      },
    },
  ]);
  assert.deepEqual([...labels.keys()], ['a', 'b']);
  assert.deepEqual([...labels.get('a')].sort(), ['contains', 'cost with no threshold']);
  assert.deepEqual([...labels.get('b')], ['not-cost']);
});

test('direction: a very deep assert-set is read without a stack overflow', () => {
  let nested = { type: 'cost' };
  for (let depth = 0; depth < 50000; depth += 1) {
    nested = { type: 'assert-set', assert: [nested] };
  }
  const labels = collectAssertionLabels([{ gradingResult: { componentResults: [{ assertion: { ...nested, metric: 'deep' } }] } }]);
  assert.deepEqual([...labels.get('deep')], ['cost with no threshold']);
});

test('direction: only a verdict with score, threshold, success and name can show a direction', () => {
  const shown = metricsShownHigherIsBetter([
    {
      metricsData: [
        { name: 'ok', score: 1, threshold: 0.5, success: true },
        { name: 'tie', score: 1, threshold: 1, success: true },
        { name: 'strict-tie', score: 1, threshold: 1, success: true, strictMode: true },
        { name: 'strict-zero', score: 0, threshold: 0, success: true, strictMode: true },
        { name: 'wrong-way', score: 0, threshold: 0.5, success: true },
        { name: 'no-success', score: 1, threshold: 0.5 },
        { score: 1, threshold: 0.5, success: true },
        null,
      ],
    },
    {},
  ]);
  assert.deepEqual([...shown].sort(), ['ok', 'strict-tie']);
});

test('direction: only the four metrics DeepEval 4.2.0 reversed need a verdict that shows the direction', () => {
  const shown = new Set(['Toxicity']);
  for (const name of ['Bias', 'Hallucination', 'Misuse']) {
    assert.match(deepevalDirectionRefusal(name, shown), /^DeepEval 4\.2\.0 reversed this metric's score/, name);
  }
  assert.equal(deepevalDirectionRefusal('Toxicity', shown), undefined);
  assert.equal(deepevalDirectionRefusal('Answer Relevancy', shown), undefined);
});
