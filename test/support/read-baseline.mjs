import assert from 'node:assert/strict';
import { readBaseline } from '../../src/read-baseline.mjs';
import { Unreadable } from '../../src/unreadable.mjs';
import { editedFixture } from './fixtures.mjs';

export const refusal = (text, name = 'evals-baseline.json') => {
  try {
    readBaseline(text, name);
  } catch (error) {
    assert.equal(error instanceof Unreadable, true, `expected Unreadable, got ${error}`);
    return error.message;
  }
  return assert.fail('expected the reader to refuse');
};
export const edited = (edit, tool = 'promptfoo') => editedFixture(tool, 'evals-baseline.json', edit);
export const accuracyKey = 'agent :: accuracy';
