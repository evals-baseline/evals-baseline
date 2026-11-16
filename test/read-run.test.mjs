import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readRun } from '../src/read-run.mjs';
import { readFixtureText } from './support/fixtures.mjs';
import { editedDeepeval, editedPromptfoo, refusal } from './support/read-run.mjs';

test('a file that matches both shapes is refused and names the top-level keys', () => {
  const text = editedPromptfoo((document) => {
    document.testCases = [];
    document.metricsScores = [];
  });
  assert.equal(
    refusal(text, 'both.json'),
    '"both.json": matches both a promptfoo results file and a DeepEval test run; top-level keys: "config", "evalId", "metadata", "metricsScores", "results", "runtimeOptions", "shareableUrl", "testCases", "vars"',
  );
});

test('a file that matches neither shape is refused and names the top-level keys', () => {
  assert.equal(
    refusal('{"accuracy":1}', 'hand.json'),
    '"hand.json": neither a promptfoo results file nor a DeepEval test run; top-level keys: "accuracy"',
  );
  assert.equal(refusal('{}', 'empty.json'), '"empty.json": neither a promptfoo results file nor a DeepEval test run; top-level keys: none');
});

test('top-level keys are listed in sorted order, at most ten, then the number left out', () => {
  const object = Object.fromEntries('lkjihgfedcba'.split('').map((letter) => [letter, 1]));
  assert.equal(
    refusal(JSON.stringify(object), 'many.json'),
    '"many.json": neither a promptfoo results file nor a DeepEval test run; top-level keys: "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", and 2 more',
  );
});

test('a JSON value that is not an object is refused and says what it is', () => {
  const cases = [
    ['[]', 'an array'],
    ['"text"', 'a string'],
    ['12', 'a number'],
    ['true', 'a boolean'],
    ['null', 'null'],
  ];
  for (const [text, kind] of cases) {
    assert.equal(refusal(text, 'odd.json'), `"odd.json": neither a promptfoo results file nor a DeepEval test run; the JSON value is ${kind}`);
  }
});

test('a file that is not JSON is refused without the parser message', () => {
  assert.equal(refusal('definitely not json', 'plain.txt'), '"plain.txt": not JSON');
  assert.equal(refusal('SQLite format 3\u0000\u0010', 'results.db'), '"results.db": not JSON');
  assert.equal(refusal('', 'empty.json'), '"empty.json": not JSON');
});

test('every refusal starts with the name it was given', () => {
  for (const text of ['x', '[]', '{"a":1}', editedPromptfoo((d) => (d.results.version = 9))]) {
    assert.equal(refusal(text, 'given-name.json').startsWith('"given-name.json": '), true);
  }
});

test('a run name with a quote, a backslash or an invisible character is delimited and escaped in the refusal', () => {
  assert.equal(refusal('x', 'a"b.json'), '"a\\u0022b.json": not JSON');
  assert.equal(refusal('x', 'a\\b.json'), '"a\\\\b.json": not JSON');
  assert.equal(refusal('x', 'a\u200db.json'), '"a\\u200db.json": not JSON');
  assert.equal(refusal('x', 'a\u{e0069}b.json'), '"a\\u{e0069}b.json": not JSON');
});

test('reading does not depend on the name: the shape is chosen from the content', () => {
  const asDeepeval = readRun(readFixtureText('deepeval', 'run-good.json'), 'run-promptfoo.json');
  const asPromptfoo = readRun(readFixtureText('promptfoo', 'run-good.json'), 'accuracy.deepeval.json');
  assert.equal(asDeepeval.tool, 'deepeval');
  assert.equal(asPromptfoo.tool, 'promptfoo');
});

test('reading the same text twice gives equal runs', () => {
  const text = readFixtureText('promptfoo', 'run-extra.json');
  assert.deepEqual(readRun(text, 'a.json'), readRun(text, 'a.json'));
});

test('a run file that gives a key twice in one object is refused instead of letting the last one win, for each tool', () => {
  const promptfooText = editedPromptfoo(() => {}).replace('"namedScoresCount":{"accuracy":4', '"namedScoresCount":{"accuracy":4,"accuracy":3');
  assert.equal(JSON.parse(promptfooText).results.prompts[0].metrics.namedScoresCount.accuracy, 3);
  assert.equal(refusal(promptfooText, 'dup.json'), '"dup.json": the key "accuracy" appears twice in one object');
  const deepevalText = editedDeepeval(() => {}).replace('"errors":0}', '"errors":3,"errors":0}');
  assert.equal(JSON.parse(deepevalText).metricsScores[0].errors, 0);
  assert.equal(deepevalText.includes('"errors":3,"errors":0}'), true);
  assert.equal(refusal(deepevalText, 'dup.json'), '"dup.json": the key "errors" appears twice in one object');
});
