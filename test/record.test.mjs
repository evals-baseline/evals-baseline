import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBaseline, specificationVersion } from '../src/read-baseline.mjs';
import { readRun } from '../src/read-run.mjs';
import { baselineText, isUnchanged, record } from '../src/record.mjs';
import { editedFixture, readFixtureText } from './support/fixtures.mjs';

const recordedClock = new Date('2026-09-02T09:00:00.000Z');
const laterClock = new Date('2026-11-11T12:30:45.123Z');

const run = (tool, file) => readRun(readFixtureText(tool, file), file);
const baselineFrom = (tool, file) => readBaseline(readFixtureText(tool, file), file);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

test('recording the good promptfoo run at the injected clock writes exactly the committed baseline', () => {
  const baseline = record(run('promptfoo', 'run-good.json'), recordedClock, 0, null);
  assert.equal(baselineText(baseline), readFixtureText('promptfoo', 'evals-baseline.json'));
});

test('recording the good DeepEval run at the injected clock writes exactly the committed baseline', () => {
  const baseline = record(run('deepeval', 'run-good.json'), recordedClock, 0, null);
  assert.equal(baselineText(baseline), readFixtureText('deepeval', 'evals-baseline.json'));
});

test('a recorded baseline carries the specification version, the source, the clock to the millisecond, the cases and sorted metrics', () => {
  const baseline = record(run('promptfoo', 'run-extra.json'), laterClock, 0, null);
  assert.equal(baseline.spec, specificationVersion);
  assert.deepEqual(baseline.source, { tool: 'promptfoo', toolVersion: '0.125.1', shape: 'promptfoo-results-3' });
  assert.equal(baseline.recordedAt, '2026-11-11T12:30:45.123Z');
  assert.equal(baseline.cases.count, 4);
  assert.deepEqual(
    baseline.metrics.map((metric) => metric.key),
    ['agent :: accuracy', 'agent :: extra', 'agent :: format'],
  );
});

test('record puts the baseline metrics in key order whatever order the run lists them in', () => {
  const unsorted = { ...run('promptfoo', 'run-good.json') };
  unsorted.metrics = [
    { key: 'c', value: 1, samples: 4 },
    { key: 'a', value: 1, samples: 4 },
    { key: 'b', value: 1, samples: 4 },
  ];
  assert.deepEqual(
    record(unsorted, recordedClock, 0, null).metrics.map((metric) => metric.key),
    ['a', 'b', 'c'],
  );
});

test('every new metric gets the tolerance given to record, and the default is the caller\'s zero', () => {
  const baseline = record(run('promptfoo', 'run-good.json'), recordedClock, 0.02, null);
  assert.deepEqual(
    baseline.metrics.map((metric) => metric.tolerance),
    [0.02, 0.02],
  );
  assert.deepEqual(
    record(run('promptfoo', 'run-good.json'), recordedClock, 0, undefined).metrics.map((metric) => metric.tolerance),
    [0, 0],
  );
});

test('a metric the previous baseline of the same tool already holds keeps its tolerance, and only a new metric takes the given one', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const handTuned = { ...previous, metrics: previous.metrics.map((metric) => ({ ...metric, tolerance: metric.key.endsWith('accuracy') ? 0.05 : 0.01 })) };
  const baseline = record(run('promptfoo', 'run-extra.json'), laterClock, 0.2, handTuned);
  assert.deepEqual(
    baseline.metrics.map((metric) => [metric.key, metric.tolerance]),
    [
      ['agent :: accuracy', 0.05],
      ['agent :: extra', 0.2],
      ['agent :: format', 0.01],
    ],
  );
});

test('the tolerance of a previous baseline from the other tool is not carried, even for an equal key', () => {
  const previous = baselineFrom('deepeval', 'evals-baseline.json');
  const handTuned = { ...previous, metrics: previous.metrics.map((metric) => ({ ...metric, tolerance: 0.3 })) };
  const baseline = record(run('promptfoo', 'run-good.json'), laterClock, 0.1, handTuned);
  assert.deepEqual(
    baseline.metrics.map((metric) => metric.tolerance),
    [0.1, 0.1],
  );
  const sameKeyRun = run('deepeval', 'run-good.json');
  const sameTool = record(sameKeyRun, laterClock, 0.1, handTuned);
  assert.deepEqual(
    sameTool.metrics.map((metric) => metric.tolerance),
    [0.3, 0.3],
  );
});

test('record changes neither the run nor the previous baseline', () => {
  const frozenRun = deepFreeze(run('promptfoo', 'run-good.json'));
  const frozenPrevious = deepFreeze(baselineFrom('promptfoo', 'evals-baseline.json'));
  const baseline = record(frozenRun, laterClock, 0.1, frozenPrevious);
  assert.notEqual(baseline.metrics, frozenRun.metrics);
  assert.notEqual(baseline.cases, frozenRun.cases);
});

test('baselineText writes two-space indentation, a final newline and the key order of the specification', () => {
  const text = baselineText(record(run('promptfoo', 'run-good.json'), recordedClock, 0, null));
  assert.equal(text.endsWith('}\n'), true);
  assert.equal(text.endsWith('\n\n'), false);
  assert.deepEqual(Object.keys(JSON.parse(text)), ['spec', 'source', 'recordedAt', 'cases', 'metrics']);
  assert.match(text, /^\{\n {2}"spec": "1\.0",\n {2}"source": \{\n {4}"tool": "promptfoo",\n/);
  assert.match(text, /\n {4}"agent :: accuracy": \{\n {6}"value": 1,\n {6}"samples": 4,\n {6}"tolerance": 0\n {4}\},\n/);
});

test('baselineText writes metric keys in sorted text order, including keys that JavaScript would reorder as array indices', () => {
  const base = record(run('deepeval', 'run-good.json'), recordedClock, 0, null);
  const metrics = ['2', '10', 'B', 'a', '_', '__proto__'].map((key) => ({ key, value: 0.5, samples: 4, tolerance: 0 }));
  const text = baselineText({ ...base, metrics });
  const written = [...text.matchAll(/^ {4}("(?:[^"\\]|\\.)*"): \{$/gm)].map((match) => JSON.parse(match[1]));
  assert.deepEqual(written, ['10', '2', 'B', '_', '__proto__', 'a']);
});

test('a metric named __proto__ survives recording, writing and reading back as an own key', () => {
  const text = readFixtureText('deepeval', 'run-good.json').replace('"metric": "Format"', '"metric": "__proto__"');
  const base = record(readRun(text, 'run.json'), recordedClock, 0, null);
  assert.deepEqual(
    base.metrics.map((metric) => metric.key),
    ['Accuracy', '__proto__'],
  );
  const written = baselineText(base);
  assert.match(written, /\n {4}"__proto__": \{\n/);
  assert.deepEqual(readBaseline(written, 'evals-baseline.json'), base);
});

test('reading a written baseline gives back the recorded baseline', () => {
  const base = record(run('promptfoo', 'run-extra.json'), laterClock, 0.25, null);
  assert.deepEqual(readBaseline(baselineText(base), 'evals-baseline.json'), base);
  const unknownVersion = record(run('deepeval', 'run-good.json'), laterClock, 0, null);
  assert.equal(unknownVersion.source.toolVersion, null);
  assert.match(baselineText(unknownVersion), /"toolVersion": null,/);
  assert.deepEqual(readBaseline(baselineText(unknownVersion), 'evals-baseline.json'), unknownVersion);
});

test('values are written with the six decimals the reader kept', () => {
  const text = editedFixture('deepeval', 'run-good.json', (document) => {
    document.metricsScores[0].scores = [1, 0.5, 0.5, 1 / 3];
  });
  const base = record(readRun(text, 'run.json'), recordedClock, 0, null);
  assert.equal(base.metrics.find((metric) => metric.key === 'Accuracy').value, 0.583333);
  assert.match(baselineText(base), /"value": 0\.583333,/);
});

test('isUnchanged is true when only the recorded time differs', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const next = record(run('promptfoo', 'run-good-again.json'), laterClock, 0, previous);
  assert.notEqual(next.recordedAt, previous.recordedAt);
  assert.equal(isUnchanged(previous, next), true);
});

test('isUnchanged is true for a hand-set tolerance that record carried over', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const handTuned = { ...previous, metrics: previous.metrics.map((metric) => ({ ...metric, tolerance: 0.02 })) };
  const next = record(run('promptfoo', 'run-good-again.json'), laterClock, 0, handTuned);
  assert.equal(isUnchanged(handTuned, next), true);
});

test('isUnchanged is false when any number, the cases, the source or the metric set changes', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const changed = [
    record(run('promptfoo', 'run-worse.json'), laterClock, 0, previous),
    record(run('promptfoo', 'run-3tests.json'), laterClock, 0, previous),
    record(run('promptfoo', 'run-swapped.json'), laterClock, 0, previous),
    record(run('promptfoo', 'run-extra.json'), laterClock, 0, previous),
    record(run('promptfoo', 'run-nometric.json'), laterClock, 0, previous),
    record(run('promptfoo', 'run-good.json'), laterClock, 0.5, { ...previous, metrics: [previous.metrics[0]] }),
  ];
  for (const next of changed) {
    assert.equal(isUnchanged(previous, next), false);
  }
  const sameNumbers = record(run('promptfoo', 'run-good.json'), laterClock, 0, previous);
  assert.equal(isUnchanged(previous, { ...sameNumbers, source: { ...sameNumbers.source, tool: 'deepeval' } }), false);
  assert.equal(isUnchanged(previous, { ...sameNumbers, spec: '1.0.0' }), false);
});

const withToolVersion = (baseline, toolVersion) => ({ ...baseline, source: { ...baseline.source, toolVersion } });

test('isUnchanged ignores the tool version: a bump, a version that becomes known and a version that is no longer known', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const next = record(run('promptfoo', 'run-good.json'), laterClock, 0, previous);
  assert.equal(previous.source.toolVersion, '0.125.1');
  assert.notEqual(next.recordedAt, previous.recordedAt);
  assert.equal(isUnchanged(previous, withToolVersion(next, '0.126.0')), true);
  assert.equal(isUnchanged(previous, withToolVersion(next, null)), true);
  const unversioned = withToolVersion(previous, null);
  assert.equal(isUnchanged(unversioned, withToolVersion(next, '0.126.0')), true);
  assert.equal(isUnchanged(unversioned, withToolVersion(next, null)), true);
});

test('isUnchanged still sees the tool, the shape, the specification, the case count and digest, and every metric key, value, samples and tolerance', () => {
  const previous = baselineFrom('promptfoo', 'evals-baseline.json');
  const next = record(run('promptfoo', 'run-good.json'), laterClock, 0, previous);
  const [first, second] = next.metrics;
  const changes = {
    tool: { source: { ...next.source, tool: 'deepeval' } },
    shape: { source: { ...next.source, shape: 'deepeval-test-run' } },
    spec: { spec: '1.0.1' },
    'cases.count': { cases: { ...next.cases, count: 5 } },
    'cases.digest': { cases: { ...next.cases, digest: '0123456789ab' } },
    'metric key': { metrics: [{ ...first, key: 'agent :: exactness' }, second] },
    'metric value': { metrics: [{ ...first, value: 0.75 }, second] },
    'metric samples': { metrics: [{ ...first, samples: 3 }, second] },
    'metric tolerance': { metrics: [{ ...first, tolerance: 0.05 }, second] },
  };
  for (const [field, change] of Object.entries(changes)) {
    const changed = { ...next, ...change };
    assert.equal(isUnchanged(previous, changed), false, field);
    assert.equal(isUnchanged(previous, withToolVersion(changed, '0.126.0')), false, `${field}, with a bumped tool version`);
  }
});

test('isUnchanged changes neither baseline it compares', () => {
  const previous = deepFreeze(baselineFrom('promptfoo', 'evals-baseline.json'));
  const next = deepFreeze(record(run('promptfoo', 'run-good-again.json'), laterClock, 0, previous));
  assert.equal(isUnchanged(previous, next), true);
});
