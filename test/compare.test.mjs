import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare } from '../src/compare.mjs';
import { describeFinding, describeNote } from '../src/describe.mjs';
import { promptfooDigest, promptfooSwappedDigest, promptfooThreeCasesDigest } from './support/digests.mjs';
import {
  accuracy,
  baselineMetric,
  deepFreeze,
  format,
  makeBaseline,
  makeRun,
  runMetric,
  twoMetricBaseline,
  twoMetricRun,
} from './support/compare-fixtures.mjs';

const digestFour = promptfooDigest;

test('a run equal to its baseline has no findings and no notes', () => {
  assert.deepEqual(compare(twoMetricBaseline(), twoMetricRun()), { findings: [], notes: [] });
});

test('rule 1: a metric the baseline names and the run lacks is a missing-metric finding with its value and sample count', () => {
  const result = compare(twoMetricBaseline(), makeRun([runMetric(accuracy, 1)]));
  assert.deepEqual(result.findings, [{ id: 'missing-metric', key: format, baseline: { value: 1000000, samples: 4 } }]);
  assert.deepEqual(result.findings.map(describeFinding), [
    'missing-metric "agent :: format": the baseline names it (1 over 4 samples) and this run has no such metric',
  ]);
  assert.deepEqual(result.notes, []);
});

test('rule 1: the text spells the baseline value in millionths and a single sample in the singular', () => {
  const baseline = makeBaseline([baselineMetric('m', 0.92, 1)]);
  const { findings } = compare(baseline, makeRun([]));
  assert.deepEqual(findings, [{ id: 'missing-metric', key: 'm', baseline: { value: 920000, samples: 1 } }]);
  assert.deepEqual(findings.map(describeFinding), ['missing-metric "m": the baseline names it (0.92 over 1 sample) and this run has no such metric']);
});

test('rule 1: a metric the reader refused is unreadable-metric with the reader reason, and rules 2 and 4 are not evaluated for it', () => {
  const baseline = makeBaseline([baselineMetric('Failure rate', 0, 4)], { source: { tool: 'deepeval', toolVersion: null, shape: 'deepeval-test-run' } });
  const run = makeRun([], {
    tool: 'deepeval',
    toolVersion: null,
    shape: 'deepeval-test-run',
    refused: [{ key: 'Failure rate', reason: 'the reader refused it' }],
  });
  const result = compare(baseline, run);
  assert.deepEqual(result.findings, [{ id: 'unreadable-metric', key: 'Failure rate', reason: 'the reader refused it' }]);
  assert.deepEqual(result.notes, []);
});

test('rule 2: the boundary table of the specification, baseline 0.92 and tolerance 0.02', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 0.92, 4, 0.02)]);
  const table = [
    [0.95, false],
    [0.92, false],
    [0.9, false],
    [0.900001, false],
    [0.899999, true],
    [0.6, true],
  ];
  for (const [value, isFinding] of table) {
    const result = compare(baseline, makeRun([runMetric(accuracy, value)]));
    assert.equal(result.findings.length, isFinding ? 1 : 0, `run value ${value}`);
  }
});

test('rule 2: the finding holds the run value and the baseline value, each with its sample count, the drop and the tolerance, all in millionths', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 0.92, 4, 0.02)]);
  const { findings } = compare(baseline, makeRun([runMetric(accuracy, 0.899999)]));
  assert.deepEqual(findings, [
    {
      id: 'below-baseline',
      key: accuracy,
      baseline: { value: 920000, samples: 4, tolerance: 20000 },
      run: { value: 899999, samples: 4 },
      drop: 20001,
    },
  ]);
  assert.deepEqual(findings.map(describeFinding), [
    'below-baseline "agent :: accuracy": 0.899999 over 4 samples is below the baseline 0.92 over 4 samples by 0.020001, more than the tolerance 0.02',
  ]);
  assert.equal(
    describeFinding(compare(baseline, makeRun([runMetric(accuracy, 0.6)])).findings[0]),
    'below-baseline "agent :: accuracy": 0.6 over 4 samples is below the baseline 0.92 over 4 samples by 0.32, more than the tolerance 0.02',
  );
});

test('rule 2: the line names the sample count of each side whether or not they are equal, and spells one sample in the singular', () => {
  const lineFor = (baseline, run) => describeFinding(compare(baseline, run).findings[0]);
  const seven = makeBaseline([baselineMetric(accuracy, 1, 7)]);
  assert.equal(
    lineFor(seven, makeRun([runMetric(accuracy, 6 / 7, 7)])),
    'below-baseline "agent :: accuracy": 0.857143 over 7 samples is below the baseline 1 over 7 samples by 0.142857, more than the tolerance 0',
  );
  assert.equal(
    lineFor(seven, makeRun([runMetric(accuracy, 0.5, 3)])),
    'below-baseline "agent :: accuracy": 0.5 over 3 samples is below the baseline 1 over 7 samples by 0.5, more than the tolerance 0',
  );
  assert.equal(
    lineFor(seven, makeRun([runMetric(accuracy, 0.5, 12)])),
    'below-baseline "agent :: accuracy": 0.5 over 12 samples is below the baseline 1 over 7 samples by 0.5, more than the tolerance 0',
  );
  const single = makeBaseline([baselineMetric(accuracy, 1, 1)]);
  assert.equal(
    lineFor(single, makeRun([runMetric(accuracy, 0, 1)])),
    'below-baseline "agent :: accuracy": 0 over 1 sample is below the baseline 1 over 1 sample by 1, more than the tolerance 0',
  );
});

test('rule 2: a tolerance of 0 makes any drop a finding, and a value above the baseline never is', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1)]);
  assert.deepEqual(compare(baseline, makeRun([runMetric(accuracy, 0.75)])).findings, [
    { id: 'below-baseline', key: accuracy, baseline: { value: 1000000, samples: 4, tolerance: 0 }, run: { value: 750000, samples: 4 }, drop: 250000 },
  ]);
  assert.deepEqual(compare(baseline, makeRun([runMetric(accuracy, 0.999999)])).findings.length, 1);
  assert.deepEqual(compare(makeBaseline([baselineMetric(accuracy, 0.5)]), makeRun([runMetric(accuracy, 1)])).findings, []);
});

test('rule 2: values on any scale are compared, negative ones included', () => {
  const baseline = makeBaseline([baselineMetric('score', -1.5, 4, 0.1)]);
  assert.deepEqual(compare(baseline, makeRun([runMetric('score', -1.6)])).findings, []);
  assert.deepEqual(
    describeFinding(compare(baseline, makeRun([runMetric('score', -1.600001)])).findings[0]),
    'below-baseline "score": -1.600001 over 4 samples is below the baseline -1.5 over 4 samples by 0.100001, more than the tolerance 0.1',
  );
});

test('rule 2: a drop smaller than one millionth is no drop', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 0.5)]);
  assert.deepEqual(compare(baseline, makeRun([runMetric(accuracy, 0.4999999)])).findings, []);
});

test('rule 3: metrics only in the run are not compared and are listed in one note, in sorted order', () => {
  const run = makeRun([runMetric(accuracy, 1), runMetric('agent :: extra', 0.5), runMetric(format, 1), runMetric('agent :: zz', 0)]);
  const result = compare(twoMetricBaseline(), run);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.notes, [{ kind: 'metrics-only-in-run', keys: ['agent :: extra', 'agent :: zz'] }]);
  assert.deepEqual(result.notes.map(describeNote), ['2 metric(s) only in this run, not compared (rule 3): "agent :: extra", "agent :: zz"']);
});

test('rule 3: the keys only in the run are listed in sorted order whatever order the run lists them in', () => {
  const run = makeRun([runMetric('zz', 1), runMetric(accuracy, 1), runMetric('extra', 1), runMetric(format, 1), runMetric('mid', 1)]);
  assert.deepEqual(compare(twoMetricBaseline(), run).notes, [{ kind: 'metrics-only-in-run', keys: ['extra', 'mid', 'zz'] }]);
});

test('rule 3: the note holds every key only in the run, and its line lists at most ten, then how many more', () => {
  const extras = Array.from({ length: 13 }, (_, index) => runMetric(`extra-${String.fromCharCode(97 + index)}`, 1));
  const result = compare(twoMetricBaseline(), makeRun([runMetric(accuracy, 1), ...extras, runMetric(format, 1)]));
  assert.deepEqual(result.notes, [{ kind: 'metrics-only-in-run', keys: extras.map((extra) => extra.key) }]);
  assert.deepEqual(result.notes.map(describeNote), [
    '13 metric(s) only in this run, not compared (rule 3): "extra-a", "extra-b", "extra-c", "extra-d", "extra-e", "extra-f", "extra-g", "extra-h", "extra-i", "extra-j", and 3 more',
  ]);
});

test('rule 3: a metric present only in the run produces no finding however its value compares', () => {
  const run = makeRun([runMetric(accuracy, 1), runMetric(format, 1), runMetric('brand new', 0, 1)]);
  assert.deepEqual(compare(twoMetricBaseline(), run).findings, []);
});

test('rule 4: fewer samples than the baseline holds is a sample-count finding', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1, 4), baselineMetric(format, 1, 2)]);
  const result = compare(baseline, makeRun([runMetric(accuracy, 1, 3), runMetric(format, 1, 1)]));
  assert.deepEqual(result.findings, [
    { id: 'sample-count', key: accuracy, baseline: { samples: 4 }, run: { samples: 3 } },
    { id: 'sample-count', key: format, baseline: { samples: 2 }, run: { samples: 1 } },
  ]);
  assert.deepEqual(result.findings.map(describeFinding), [
    'sample-count "agent :: accuracy": the baseline holds 4 samples and this run holds 3',
    'sample-count "agent :: format": the baseline holds 2 samples and this run holds 1',
  ]);
});

test('rule 4: as many samples as the baseline holds, or more, is no finding', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1, 4), baselineMetric(format, 1, 1)]);
  assert.deepEqual(compare(baseline, makeRun([runMetric(accuracy, 1, 4), runMetric(format, 1, 1)])).findings, []);
  assert.deepEqual(compare(baseline, makeRun([runMetric(accuracy, 1, 5), runMetric(format, 1, 2)])).findings, []);
  assert.deepEqual(compare(baseline, makeRun([runMetric(accuracy, 1, 400), runMetric(format, 1, 100)])).findings, []);
});

test('rule 4: a rise in samples does not hide a fall of the value, which is still a finding of its own', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1)]);
  const result = compare(baseline, makeRun([runMetric(accuracy, 0.75, 8)]));
  assert.deepEqual(result.findings, [
    { id: 'below-baseline', key: accuracy, baseline: { value: 1000000, samples: 4, tolerance: 0 }, run: { value: 750000, samples: 8 }, drop: 250000 },
  ]);
});

test('rules 2 and 4 are independent: one key can produce both, rule 2 first', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1)]);
  const result = compare(baseline, makeRun([runMetric(accuracy, 0.5, 3)]));
  assert.deepEqual(
    result.findings.map((finding) => finding.id),
    ['below-baseline', 'sample-count'],
  );
});

test('the binding check: a different case digest is a cases-changed finding with both counts and both digests, and it has no key', () => {
  const run = makeRun([runMetric(accuracy, 1), runMetric(format, 1)], { cases: { count: 3, digest: promptfooThreeCasesDigest } });
  const { findings } = compare(twoMetricBaseline(), run);
  assert.deepEqual(findings, [
    { id: 'cases-changed', baseline: { count: 4, digest: promptfooDigest }, run: { count: 3, digest: promptfooThreeCasesDigest } },
  ]);
  assert.deepEqual(findings.map(describeFinding), [
    `cases-changed: the baseline was recorded from 4 cases (digest ${promptfooDigest}); this run holds 3 cases (digest ${promptfooThreeCasesDigest}); re-record if the change is intended`,
  ]);
});

test('the binding check: the same count with another digest is a swap and is reported alone', () => {
  const run = makeRun([runMetric(accuracy, 1), runMetric(format, 1)], { cases: { count: 4, digest: promptfooSwappedDigest } });
  const result = compare(twoMetricBaseline(), run);
  assert.deepEqual(
    result.findings.map((finding) => finding.id),
    ['cases-changed'],
  );
});

test('the binding check: a count that differs under an equal digest is not a finding, because only the digest binds', () => {
  const run = makeRun([runMetric(accuracy, 1), runMetric(format, 1)], { cases: { count: 9, digest: digestFour } });
  assert.deepEqual(compare(twoMetricBaseline(), run).findings, []);
});

test('the binding check: a single case is spelt in the singular', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1)], { cases: { count: 1, digest: 'aaaaaaaaaaaa' } });
  const run = makeRun([runMetric(accuracy, 1)], { cases: { count: 1, digest: 'bbbbbbbbbbbb' } });
  assert.match(describeFinding(compare(baseline, run).findings[0]), /^cases-changed: the baseline was recorded from 1 case \(digest aaaaaaaaaaaa\); this run holds 1 case \(digest bbbbbbbbbbbb\)/);
});

test('findings are ordered: cases-changed first, then by key, and for one key rule 1, rule 2, rule 4', () => {
  const baseline = makeBaseline([baselineMetric('a', 1), baselineMetric('b', 1), baselineMetric('c', 1), baselineMetric('d', 1)]);
  const run = makeRun([runMetric('a', 0.5, 3), runMetric('c', 1, 2), runMetric('d', 0.5)], { cases: { count: 3, digest: promptfooThreeCasesDigest } });
  assert.deepEqual(
    compare(baseline, run).findings.map((finding) => [finding.id, finding.key]),
    [
      ['cases-changed', undefined],
      ['below-baseline', 'a'],
      ['sample-count', 'a'],
      ['missing-metric', 'b'],
      ['sample-count', 'c'],
      ['below-baseline', 'd'],
    ],
  );
});

test('findings are in key order whatever order the baseline lists its metrics in', () => {
  const baseline = makeBaseline([baselineMetric('c', 1), baselineMetric('a', 1), baselineMetric('b', 1)]);
  const result = compare(baseline, makeRun([]));
  assert.deepEqual(
    result.findings.map((finding) => [finding.id, finding.key]),
    [
      ['missing-metric', 'a'],
      ['missing-metric', 'b'],
      ['missing-metric', 'c'],
    ],
  );
});

test('a run from the other tool is one bad-run finding naming both tools and both shapes, and nothing is compared', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1)], { source: { tool: 'deepeval', toolVersion: null, shape: 'deepeval-test-run' } });
  const run = makeRun([], { name: '../pf/run-good.json', errors: ['"agent": 1 errored test(s) in this run (promptfoo testErrorCount)'] });
  const result = compare(baseline, run);
  assert.deepEqual(result, {
    findings: [
      {
        id: 'bad-run',
        file: '../pf/run-good.json',
        cause: 'other-tool',
        baseline: { tool: 'deepeval', shape: 'deepeval-test-run' },
        run: { tool: 'promptfoo', shape: 'promptfoo-results-3' },
      },
    ],
    notes: [],
  });
  assert.deepEqual(result.findings.map(describeFinding), [
    'bad-run: "../pf/run-good.json": the baseline was recorded from deepeval (deepeval-test-run) and this file is promptfoo (promptfoo-results-3)',
  ]);
});

test('compare is pure: it changes neither input and gives equal results when called twice', () => {
  const baseline = deepFreeze(makeBaseline([baselineMetric(accuracy, 0.92, 4, 0.02), baselineMetric(format, 1)]));
  const run = deepFreeze(
    makeRun([runMetric(accuracy, 0.5, 3), runMetric('extra', 1)], { cases: { count: 3, digest: promptfooThreeCasesDigest }, errors: ['e'], refused: [{ key: 'r', reason: 'why' }] }),
  );
  const first = compare(baseline, run);
  const second = compare(baseline, run);
  assert.deepEqual(first, second);
});
