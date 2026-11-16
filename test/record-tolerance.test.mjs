import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBaseline } from '../src/read-baseline.mjs';
import { readRun } from '../src/read-run.mjs';
import { toleranceRefusal } from '../src/record.mjs';
import { readFixtureText } from './support/fixtures.mjs';

const run = (tool, file) => readRun(readFixtureText(tool, file), file);
const baselineFrom = (tool, file) => readBaseline(readFixtureText(tool, file), file);

const withTolerances = (baseline, tolerances) => ({
  ...baseline,
  metrics: baseline.metrics.map((metric) => ({ ...metric, tolerance: tolerances[metric.key] ?? metric.tolerance })),
});

const heldByHand = (tolerances) => withTolerances(baselineFrom('promptfoo', 'evals-baseline.json'), tolerances);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const unsetReason = (metrics) =>
  `no tolerance was given for ${metrics}, and a tolerance of 0 reports a fall of any size; pass --tolerance <n> to set one, or --tolerance 0 to accept 0`;

const conflictReason = (flag, metrics) =>
  `--tolerance ${flag} would change the tolerance of ${metrics} that the baseline already holds, and record keeps those; edit them in the baseline, or leave --tolerance out`;

test('with no tolerance given and no previous baseline, every metric of the run has none, and the refusal counts them', () => {
  const goodRun = run('promptfoo', 'run-good.json');
  assert.deepEqual(toleranceRefusal(goodRun, undefined, null), { reason: unsetReason('2 metrics'), held: [] });
  assert.deepEqual(toleranceRefusal(goodRun, undefined, undefined), { reason: unsetReason('2 metrics'), held: [] });
});

test('a tolerance of 0 that was given is a tolerance given, for a fresh baseline and for a new metric', () => {
  assert.equal(toleranceRefusal(run('promptfoo', 'run-good.json'), 0, null), null);
  assert.equal(toleranceRefusal(run('promptfoo', 'run-extra.json'), 0, heldByHand({ 'agent :: accuracy': 0, 'agent :: format': 0 })), null);
});

test('with no tolerance given, a run whose every metric the previous baseline of the same tool holds is accepted, whatever the held numbers are', () => {
  assert.equal(toleranceRefusal(run('promptfoo', 'run-good.json'), undefined, baselineFrom('promptfoo', 'evals-baseline.json')), null);
  assert.equal(toleranceRefusal(run('promptfoo', 'run-good.json'), undefined, heldByHand({ 'agent :: accuracy': 0.05, 'agent :: format': 0.3 })), null);
});

test('with no tolerance given, only a metric that the previous baseline does not hold counts as unset, and one is spelt in the singular', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  assert.deepEqual(toleranceRefusal(run('promptfoo', 'run-extra.json'), undefined, previous), { reason: unsetReason('1 metric'), held: [] });
  const deepevalPrevious = baselineFrom('deepeval', 'evals-baseline.json');
  assert.deepEqual(toleranceRefusal(run('deepeval', 'run-extra.json'), undefined, deepevalPrevious), { reason: unsetReason('2 metrics'), held: [] });
});

test('the tolerances of a previous baseline of the other tool are not held, so with none given the whole run has none, and a tolerance given is accepted', () => {
  const otherTool = withTolerances(baselineFrom('deepeval', 'evals-baseline.json'), { Accuracy: 0.3, Format: 0.3 });
  const goodRun = run('promptfoo', 'run-good.json');
  assert.deepEqual(toleranceRefusal(goodRun, undefined, otherTool), { reason: unsetReason('2 metrics'), held: [] });
  assert.equal(toleranceRefusal(goodRun, 0.1, otherTool), null);
});

test('a tolerance given that differs from a held one is refused, with each held tolerance named in key order', () => {
  const previous = heldByHand({ 'agent :: accuracy': 0.05, 'agent :: format': 0.01 });
  assert.deepEqual(toleranceRefusal(run('promptfoo', 'run-good.json'), 0.3, previous), {
    reason: conflictReason('0.3', '2 metrics'),
    held: [
      { key: 'agent :: accuracy', tolerance: 0.05 },
      { key: 'agent :: format', tolerance: 0.01 },
    ],
  });
});

test('a held metric whose tolerance equals the one given is no conflict, so only the others are counted, and one is spelt in the singular', () => {
  const previous = heldByHand({ 'agent :: accuracy': 0.3, 'agent :: format': 0.01 });
  assert.deepEqual(toleranceRefusal(run('promptfoo', 'run-good.json'), 0.3, previous), {
    reason: conflictReason('0.3', '1 metric'),
    held: [{ key: 'agent :: format', tolerance: 0.01 }],
  });
});

test('a tolerance given equal to every held one is accepted, and 0 given over held zeros is accepted', () => {
  const previous = heldByHand({ 'agent :: accuracy': 0.02, 'agent :: format': 0.02 });
  assert.equal(toleranceRefusal(run('promptfoo', 'run-good.json'), 0.02, previous), null);
  assert.equal(toleranceRefusal(run('promptfoo', 'run-good.json'), 0, baselineFrom('promptfoo', 'evals-baseline.json')), null);
});

test('given and held tolerances are compared in millionths: a difference below one millionth is no conflict, one millionth is', () => {
  const previous = heldByHand({ 'agent :: accuracy': 0.05, 'agent :: format': 0.05 });
  const goodRun = run('promptfoo', 'run-good.json');
  assert.equal(toleranceRefusal(goodRun, 0.0500001, previous), null);
  assert.equal(toleranceRefusal(goodRun, 0.0499999, previous), null);
  assert.equal(toleranceRefusal(goodRun, 0.050001, previous).held.length, 2);
  assert.equal(toleranceRefusal(goodRun, 0.049999, previous).held.length, 2);
  assert.equal(toleranceRefusal(goodRun, 0, heldByHand({ 'agent :: accuracy': 0.0000004, 'agent :: format': 0 })), null);
});

test('the given tolerance is printed in millionths, as every other number of a report is', () => {
  const previous = heldByHand({ 'agent :: accuracy': 0.05, 'agent :: format': 0.05 });
  assert.equal(toleranceRefusal(run('promptfoo', 'run-good.json'), 0.1234567, previous).reason, conflictReason('0.123457', '2 metrics'));
  assert.equal(toleranceRefusal(run('promptfoo', 'run-good.json'), 3, previous).reason, conflictReason('3', '2 metrics'));
});

test('a metric the previous baseline holds and the run lacks is not counted or named', () => {
  const previous = heldByHand({ 'agent :: accuracy': 0.05, 'agent :: format': 0.05 });
  const onlyAccuracy = run('promptfoo', 'run-nometric.json');
  assert.deepEqual(onlyAccuracy.metrics.map((metric) => metric.key), ['agent :: accuracy']);
  assert.deepEqual(toleranceRefusal(onlyAccuracy, 0.3, previous), {
    reason: conflictReason('0.3', '1 metric'),
    held: [{ key: 'agent :: accuracy', tolerance: 0.05 }],
  });
  assert.equal(toleranceRefusal(onlyAccuracy, 0.05, previous), null);
});

test('a new metric takes the tolerance given and is neither counted nor named in a conflict', () => {
  const allHeld = heldByHand({ 'agent :: accuracy': 0.3, 'agent :: format': 0.3 });
  assert.equal(toleranceRefusal(run('promptfoo', 'run-extra.json'), 0.3, allHeld), null);
  const differing = heldByHand({ 'agent :: accuracy': 0.05, 'agent :: format': 0.05 });
  const refusal = toleranceRefusal(run('promptfoo', 'run-extra.json'), 0.3, differing);
  assert.equal(refusal.reason, conflictReason('0.3', '2 metrics'));
  assert.deepEqual(refusal.held.map((entry) => entry.key), ['agent :: accuracy', 'agent :: format']);
});

test('the held tolerances are listed in key order whatever order the run lists its metrics in', () => {
  const previous = heldByHand({ 'agent :: accuracy': 0.05, 'agent :: format': 0.05 });
  const goodRun = run('promptfoo', 'run-good.json');
  const reversed = { ...goodRun, metrics: [...goodRun.metrics].reverse() };
  assert.deepEqual(toleranceRefusal(reversed, 0.3, previous).held.map((entry) => entry.key), ['agent :: accuracy', 'agent :: format']);
});

test('toleranceRefusal changes neither the run nor the previous baseline', () => {
  const frozenRun = deepFreeze(run('promptfoo', 'run-extra.json'));
  const frozenPrevious = deepFreeze(heldByHand({ 'agent :: accuracy': 0.05, 'agent :: format': 0.05 }));
  assert.notEqual(toleranceRefusal(frozenRun, 0.3, frozenPrevious), null);
  assert.notEqual(toleranceRefusal(frozenRun, undefined, frozenPrevious), null);
});
