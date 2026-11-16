import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBaseline } from '../src/read-baseline.mjs';
import { edited, refusal } from './support/read-baseline.mjs';

test('a baseline that lists one metric twice is refused instead of letting the last entry win', () => {
  const text = edited(() => {}).replace(
    '"agent :: format":{',
    '"agent :: accuracy":{"value":1,"samples":4,"tolerance":3000000000},"agent :: format":{',
  );
  const lastEntryWins = JSON.stringify(JSON.parse(text));
  assert.equal(readBaseline(lastEntryWins, 'last.json').metrics[0].tolerance, 3000000000);
  assert.equal(refusal(text, 'dup.json'), '"dup.json": the key "agent :: accuracy" appears twice in one object');
});
