import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { banner, promptfooFile, promptfooIo } from './support/command.mjs';
import { makeIo } from './support/io.mjs';

test('an empty --baseline path names no file: check reports no baseline there and does not fall back to the default path', () => {
  const io = promptfooIo('run-good.json');
  const output = cli(['check', 'run-good.json', '--baseline', ''], io);
  assert.equal(output.findings.length, 1);
  assert.equal(output.findings[0].startsWith('no-baseline'), true);
  assert.equal(output.stdout[0], `${banner} check ""`);
});

test('an empty --baseline path is written to as given and the default baseline is neither read nor replaced', () => {
  const io = promptfooIo('run-worse.json');
  const output = cli(['record', 'run-worse.json', '--baseline', '', '--tolerance', '0'], io);
  assert.equal(output.code, 0);
  assert.deepEqual(output.findings, []);
  assert.deepEqual(io.writes.map(([path]) => path), ['']);
  assert.equal(io.store.get('evals-baseline.json'), promptfooFile('evals-baseline.json'));
  assert.equal(output.stdout.length, 1);
});

test('a write failure that carries no error code is reported as an internal error, not as a write refusal, and nothing is claimed written', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json'), 'write:evals-baseline.json': new Error('boom') });
  const output = cli(['record', 'run-good.json', '--tolerance', '0'], io);
  assert.deepEqual(output.stdout, [`${banner} record: refused: internal-error: "boom"; nothing written`]);
  assert.equal(output.code, 3);
  assert.deepEqual(io.writes, []);
});
