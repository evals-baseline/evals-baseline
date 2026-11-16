import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBaseline } from '../src/read-baseline.mjs';
import { readRun } from '../src/read-run.mjs';
import { record, replaceRefusal } from '../src/record.mjs';
import { assertSafeLines, plantedNames } from './support/command.mjs';
import { promptfooDigest, promptfooThreeCasesDigest } from './support/digests.mjs';
import { readFixtureText } from './support/fixtures.mjs';

const clock = new Date('2026-11-11T12:00:00.000Z');
const path = 'evals-baseline.json';

const run = (tool, file) => readRun(readFixtureText(tool, file), file);
const baselineFrom = (tool, file) => readBaseline(readFixtureText(tool, file), file);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const withMetrics = (baseline, change) => ({ ...baseline, metrics: baseline.metrics.map((metric) => ({ ...metric, ...change(metric) })) });

const refusalFor = (previous, nextRun, tolerance = 0) => replaceRefusal(path, previous, record(nextRun, clock, tolerance, previous), false);

const heldNow = '"evals-baseline.json" already holds a baseline of 2 metrics and 4 cases, recorded 2026-09-02';
const wouldBecome = (summary) => `; this run would replace it with ${summary}; pass --replace to replace it`;

test('with no baseline on disk there is nothing to replace, so nothing is refused', () => {
  const next = record(run('promptfoo', 'run-good.json'), clock, 0, null);
  assert.equal(replaceRefusal(path, null, next, false), null);
  assert.equal(replaceRefusal(path, undefined, next, false), null);
});

test('the flag lifts the refusal, whatever the run would change', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const next = record(run('promptfoo', 'run-worse.json'), clock, 0, previous);
  assert.equal(replaceRefusal(path, previous, next, true), null);
});

test('a baseline that is already there is refused, and the refusal says what it holds, what would replace it and which flag to pass', () => {
  const refusal = refusalFor(baselineFrom('promptfoo', 'evals-baseline.json'), run('promptfoo', 'run-worse.json'));
  assert.equal(refusal.reason, `${heldNow}${wouldBecome('a baseline of 2 metrics and 4 cases')}`);
});

test('a metric that would fall is named with the size of the fall and both values', () => {
  const refusal = refusalFor(baselineFrom('promptfoo', 'evals-baseline.json'), run('promptfoo', 'run-worse.json'));
  assert.deepEqual(refusal.notes, ['"agent :: accuracy": would fall by 0.25, from 1 over 4 samples to 0.75 over 4 samples']);
});

test('a metric that would rise is named as a rise, and a metric that stays as it is is not listed', () => {
  const previous = withMetrics(baselineFrom('promptfoo', 'evals-baseline.json'), (metric) => (metric.key.endsWith('accuracy') ? { value: 0.9 } : {}));
  const refusal = refusalFor(previous, run('promptfoo', 'run-good.json'));
  assert.deepEqual(refusal.notes, ['"agent :: accuracy": would rise by 0.1, from 0.9 over 4 samples to 1 over 4 samples']);
});

test('a fall of one millionth is a fall, so a move too small to see in a rounded number is still named', () => {
  const previous = withMetrics(baselineFrom('promptfoo', 'evals-baseline.json'), (metric) => ({ value: metric.key.endsWith('accuracy') ? 0.900001 : 1 }));
  const next = withMetrics(previous, (metric) => (metric.key.endsWith('accuracy') ? { value: 0.9 } : {}));
  assert.deepEqual(replaceRefusal(path, previous, next, false).notes, ['"agent :: accuracy": would fall by 0.000001, from 0.900001 over 4 samples to 0.9 over 4 samples']);
});

test('a change in the number of samples is named even when the value stays, and one sample is spelt in the singular', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const next = withMetrics(previous, (metric) => (metric.key.endsWith('format') ? { samples: 8 } : {}));
  assert.deepEqual(replaceRefusal(path, previous, next, false).notes, ['"agent :: format": would keep the value 1 and go from 4 samples to 8 samples']);
  const single = withMetrics(previous, (metric) => (metric.key.endsWith('format') ? { samples: 1 } : {}));
  assert.deepEqual(replaceRefusal(path, previous, single, false).notes, ['"agent :: format": would keep the value 1 and go from 4 samples to 1 sample']);
});

test('a metric that the baseline holds and the run lacks would be removed, and one that only the run has would be added', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const removed = refusalFor(previous, run('promptfoo', 'run-nometric.json'));
  assert.equal(removed.reason, `${heldNow}${wouldBecome('a baseline of 1 metric and 4 cases')}`);
  assert.deepEqual(removed.notes, ['"agent :: format": would be removed; the baseline holds 1 over 4 samples, with the tolerance 0']);
  const added = refusalFor(previous, run('promptfoo', 'run-extra.json'));
  assert.equal(added.reason, `${heldNow}${wouldBecome('a baseline of 3 metrics and 4 cases')}`);
  assert.deepEqual(added.notes, ['"agent :: extra": would be added, at 1 over 4 samples']);
});

test('a metric that would be removed names the tolerance the baseline holds for it, because a removed metric takes a hand-set tolerance with it', () => {
  const previous = withMetrics(baselineFrom('promptfoo', 'evals-baseline.json'), (metric) => (metric.key.endsWith('format') ? { tolerance: 0.05 } : {}));
  const refusal = refusalFor(previous, run('promptfoo', 'run-nometric.json'), 0);
  assert.deepEqual(refusal.notes, ['"agent :: format": would be removed; the baseline holds 1 over 4 samples, with the tolerance 0.05']);
});

test('a run of other cases names both case sets, then each metric in key order', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const refusal = refusalFor(previous, run('promptfoo', 'run-3tests.json'));
  assert.deepEqual(refusal.notes, [
    `the cases would change from 4 cases (digest ${promptfooDigest}) to 3 cases (digest ${promptfooThreeCasesDigest})`,
    '"agent :: accuracy": would keep the value 1 and go from 4 samples to 3 samples',
    '"agent :: format": would keep the value 1 and go from 4 samples to 3 samples',
  ]);
  assert.equal(refusal.reason, `${heldNow}${wouldBecome('a baseline of 2 metrics and 3 cases')}`);
});

test('a baseline of the other tool is named, and the refusal says that no tolerance would be carried over', () => {
  const refusal = refusalFor(baselineFrom('deepeval', 'evals-baseline.json'), run('promptfoo', 'run-good.json'));
  assert.equal(refusal.notes[0], 'the tool would change from deepeval to promptfoo, so no tolerance would be carried over');
});

test('the notes list metrics in text order, so a key that JavaScript would reorder as an array index stays where the text puts it', () => {
  const previous = withMetrics(baselineFrom('deepeval', 'evals-baseline.json'), () => ({}));
  const keys = ['2', '10', 'B', 'a'];
  const before = { ...previous, metrics: keys.map((key) => ({ key, value: 1, samples: 4, tolerance: 0 })) };
  const after = { ...before, metrics: before.metrics.map((metric) => ({ ...metric, value: 0.5 })) };
  assert.deepEqual(
    replaceRefusal(path, before, after, false).notes.map((note) => note.split(':')[0]),
    ['"10"', '"2"', '"B"', '"a"'],
  );
});

test('the baseline path in the refusal is quoted as the other lines quote it', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const next = record(run('promptfoo', 'run-worse.json'), clock, 0, previous);
  assert.equal(replaceRefusal('suites/one.json', previous, next, false).reason.startsWith('"suites/one.json" already holds a baseline'), true);
});

for (const { label, name, printed } of plantedNames) {
  test(`a metric named with ${label} is printed quoted and escaped in the note, and the lines stay safe to print`, () => {
    const previous = { ...baselineFrom('promptfoo', 'evals-baseline.json'), metrics: [{ key: name, value: 1, samples: 4, tolerance: 0 }] };
    const next = { ...previous, metrics: [{ key: name, value: 0.5, samples: 4, tolerance: 0 }] };
    const refusal = replaceRefusal(path, previous, next, false);
    assert.deepEqual(refusal.notes, [`"${printed}": would fall by 0.5, from 1 over 4 samples to 0.5 over 4 samples`]);
    assertSafeLines(refusal.notes.map((note) => `note: ${note}`));
  });
}

test('replaceRefusal changes neither baseline it is given', () => {
  const previous = deepFreeze(baselineFrom('promptfoo', 'evals-baseline.json'));
  const next = deepFreeze(record(run('promptfoo', 'run-worse.json'), clock, 0, previous));
  assert.notEqual(replaceRefusal(path, previous, next, false), null);
});
