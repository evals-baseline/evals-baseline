import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare } from '../src/compare.mjs';
import { describeNote } from '../src/describe.mjs';
import { accuracy, baselineMetric, format, makeBaseline, makeRun, runMetric, twoMetricBaseline, twoMetricRun } from './support/compare-fixtures.mjs';

const erroredTest = '"agent": 1 errored test(s) in this run (promptfoo testErrorCount)';

test('notes: samples the tool counted as errors are carried over from the run', () => {
  const run = makeRun([runMetric(accuracy, 1, 3), runMetric(format, 1, 3)], { errors: [erroredTest] });
  assert.deepEqual(compare(twoMetricBaseline(), run).notes, [{ kind: 'run-error', text: erroredTest }]);
  assert.deepEqual(compare(twoMetricBaseline(), run).notes.map(describeNote), [erroredTest]);
});

test('notes: a metric the reader refused that the baseline does not name is a note and not a finding, as 2.5 lists it', () => {
  const run = makeRun([runMetric(accuracy, 1), runMetric(format, 1)], {
    refused: [
      { key: 'Failure rate', reason: 'the reader refused it' },
      { key: 'Brevity', reason: 'another reason' },
    ],
  });
  const result = compare(twoMetricBaseline(), run);
  assert.deepEqual(result, {
    findings: [],
    notes: [
      { kind: 'refused-metric', key: 'Brevity', reason: 'another reason' },
      { kind: 'refused-metric', key: 'Failure rate', reason: 'the reader refused it' },
    ],
  });
  assert.deepEqual(result.notes.map(describeNote), ['"Brevity" cannot be read: another reason', '"Failure rate" cannot be read: the reader refused it']);
});

test('notes: a metric the reader refused that the baseline does name is the finding unreadable-metric and is not also a note', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1), baselineMetric('Failure rate', 0)]);
  const run = makeRun([runMetric(accuracy, 1)], { refused: [{ key: 'Failure rate', reason: 'the reader refused it' }] });
  assert.deepEqual(compare(baseline, run), {
    findings: [{ id: 'unreadable-metric', key: 'Failure rate', reason: 'the reader refused it' }],
    notes: [],
  });
});

test('notes: a tool version that differs from the baseline is a note, and an unknown version on either side is not', () => {
  const different = makeRun([runMetric(accuracy, 1), runMetric(format, 1)], { toolVersion: '0.126.0' });
  const { notes } = compare(twoMetricBaseline(), different);
  assert.deepEqual(notes, [{ kind: 'tool-version-changed', tool: 'promptfoo', baseline: { toolVersion: '0.125.1' }, run: { toolVersion: '0.126.0' } }]);
  assert.deepEqual(notes.map(describeNote), ['the baseline was recorded by promptfoo "0.125.1"; this run was written by "0.126.0"']);
  const unknownRun = makeRun([runMetric(accuracy, 1), runMetric(format, 1)], { toolVersion: null });
  assert.deepEqual(compare(twoMetricBaseline(), unknownRun).notes, []);
  const unknownBaseline = makeBaseline([baselineMetric(accuracy, 1), baselineMetric(format, 1)], {
    source: { tool: 'promptfoo', toolVersion: null, shape: 'promptfoo-results-3' },
  });
  assert.deepEqual(compare(unknownBaseline, twoMetricRun()).notes, []);
});

test('notes are ordered: rule 3, then rises in samples, then errors, then refused metrics, then the version', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1), baselineMetric(format, 1), baselineMetric('grown', 1)]);
  const run = makeRun([runMetric(accuracy, 1, 3), runMetric(format, 1, 3), runMetric('extra', 1), runMetric('grown', 1, 6)], {
    toolVersion: '0.126.0',
    errors: [erroredTest],
    refused: [{ key: 'weighted', reason: 'why' }],
  });
  const { notes } = compare(baseline, run);
  assert.deepEqual(
    notes.map((note) => note.kind),
    ['metrics-only-in-run', 'more-samples', 'run-error', 'refused-metric', 'tool-version-changed'],
  );
  assert.deepEqual(notes.map(describeNote), [
    '1 metric(s) only in this run, not compared (rule 3): "extra"',
    '"grown": the baseline holds 4 samples and this run holds 6; more samples than the baseline are never a finding',
    erroredTest,
    '"weighted" cannot be read: why',
    'the baseline was recorded by promptfoo "0.125.1"; this run was written by "0.126.0"',
  ]);
});

test('notes: a metric with more samples than the baseline is a note and never a finding, and one sample is spelt in the singular', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1, 4), baselineMetric(format, 1, 1)]);
  const run = makeRun([runMetric(accuracy, 1, 8), runMetric(format, 1, 2)]);
  const result = compare(baseline, run);
  assert.deepEqual(result, {
    findings: [],
    notes: [
      { kind: 'more-samples', key: accuracy, baseline: { samples: 4 }, run: { samples: 8 } },
      { kind: 'more-samples', key: format, baseline: { samples: 1 }, run: { samples: 2 } },
    ],
  });
  assert.deepEqual(result.notes.map(describeNote), [
    '"agent :: accuracy": the baseline holds 4 samples and this run holds 8; more samples than the baseline are never a finding',
    '"agent :: format": the baseline holds 1 sample and this run holds 2; more samples than the baseline are never a finding',
  ]);
});

test('notes: the rise notes are in key order whatever order the baseline lists its metrics in', () => {
  const baseline = makeBaseline([baselineMetric('c', 1), baselineMetric('a', 1), baselineMetric('b', 1)]);
  const run = makeRun([runMetric('b', 1, 5), runMetric('c', 1, 5), runMetric('a', 1, 5)]);
  assert.deepEqual(
    compare(baseline, run).notes.map((note) => note.key),
    ['a', 'b', 'c'],
  );
});

test('notes: there is a rise note for a rise alone, not for equal samples, fewer samples, a metric the run lacks or a metric the reader refused', () => {
  const baseline = makeBaseline(['equal', 'fewer', 'absent', 'refused', 'grown'].map((key) => baselineMetric(key, 1)));
  const run = makeRun([runMetric('equal', 1, 4), runMetric('fewer', 1, 3), runMetric('grown', 1, 5)], { refused: [{ key: 'refused', reason: 'why' }] });
  assert.deepEqual(
    compare(baseline, run).notes.filter((note) => note.kind === 'more-samples'),
    [{ kind: 'more-samples', key: 'grown', baseline: { samples: 4 }, run: { samples: 5 } }],
  );
});

test('notes: a rise in samples is noted even when the value fell, and the fall is the only finding', () => {
  const run = makeRun([runMetric(accuracy, 0.75, 8), runMetric(format, 1)]);
  assert.deepEqual(compare(twoMetricBaseline(), run), {
    findings: [
      { id: 'below-baseline', key: accuracy, baseline: { value: 1000000, samples: 4, tolerance: 0 }, run: { value: 750000, samples: 8 }, drop: 250000 },
    ],
    notes: [{ kind: 'more-samples', key: accuracy, baseline: { samples: 4 }, run: { samples: 8 } }],
  });
});

test('notes: the key of a rise note is held as the file spelt it, and its line writes a double quote and a backslash so that the quoted span ends where the key ends', () => {
  const key = 'k"\\';
  const { notes } = compare(makeBaseline([baselineMetric(key, 1)]), makeRun([runMetric(key, 1, 8)]));
  assert.deepEqual(notes, [{ kind: 'more-samples', key, baseline: { samples: 4 }, run: { samples: 8 } }]);
  assert.deepEqual(notes.map(describeNote), [
    '"k\\u0022\\\\": the baseline holds 4 samples and this run holds 8; more samples than the baseline are never a finding',
  ]);
});
