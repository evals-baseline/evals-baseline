import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { banner, promptfooFile, promptfooIo } from './support/command.mjs';
import { editedFixture } from './support/fixtures.mjs';

const promptfooBumped = (file) =>
  editedFixture('promptfoo', file, (document) => {
    document.metadata.promptfooVersion = '0.126.0';
  });

test('a promptfoo version bump with identical numbers is unchanged: nothing is written and the recorded date is kept', () => {
  const io = promptfooIo('run-good.json', { 'run-good.json': promptfooBumped('run-good.json') });
  const output = cli(['record', 'run-good.json'], io);
  assert.deepEqual(output.stdout, [`${banner} record: unchanged: "evals-baseline.json" already holds these values; not rewritten (recorded 2026-09-02)`]);
  assert.equal(output.code, 0);
  assert.deepEqual(io.writes, []);
});

test('a promptfoo version bump together with a changed value writes with --replace, with the new version and the new date, and keeps a hand-set tolerance', () => {
  const handTuned = JSON.parse(promptfooFile('evals-baseline.json'));
  handTuned.metrics['agent :: accuracy'].tolerance = 0.05;
  const io = promptfooIo('run-worse.json', {
    'run-worse.json': promptfooBumped('run-worse.json'),
    'evals-baseline.json': JSON.stringify(handTuned, null, 2),
  });
  const output = cli(['record', 'run-worse.json', '--replace'], io);
  assert.deepEqual(output.stdout, [
    `${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, promptfoo "0.126.0")`,
    'replaced: the previous baseline would have reported 1 finding against this run:',
    '  below-baseline "agent :: accuracy": 0.75 over 4 samples is below the baseline 1 over 4 samples by 0.25, more than the tolerance 0.05',
  ]);
  assert.equal(io.writes.length, 1);
  const written = JSON.parse(io.writes[0][1]);
  assert.deepEqual([written.source.toolVersion, written.recordedAt], ['0.126.0', '2026-11-11T12:00:00.000Z']);
  assert.deepEqual(written.metrics['agent :: accuracy'], { value: 0.75, samples: 4, tolerance: 0.05 });
});
