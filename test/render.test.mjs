import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { packageVersion, render, renderRecordRefusal } from '../src/render.mjs';
import { deepevalDigest, promptfooDigest } from './support/digests.mjs';
import { repositoryRoot } from './support/fixtures.mjs';
import {
  banner,
  belowBaseline,
  belowBaselineLine,
  casesChanged,
  casesChangedLine,
  checked,
  dateLine,
  deepFreeze,
  header,
  promptfooBaseline,
  runError,
  sampleCount,
  today,
} from './support/render.mjs';

test('the package version is the one package.json declares', () => {
  assert.equal(packageVersion, JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')).version);
});

test('a check with nothing to report prints the header, the date line and the no-findings summary, and exits 0', () => {
  const output = render(checked(), false, today);
  assert.deepEqual(output.lines, [header, dateLine, 'evals-baseline: no findings']);
  assert.equal(output.code, 0);
  assert.deepEqual(output.findings, []);
  assert.deepEqual(output.failing, []);
});

test('the no-findings summary and the exit code do not change under --strict', () => {
  const output = render(checked(), true, today);
  assert.deepEqual(output.lines, [header, dateLine, 'evals-baseline: no findings']);
  assert.equal(output.code, 0);
});

test('one finding by default is a warning: the finding line, then a summary that says exit 0 and how to get exit 1', () => {
  const output = render(checked({ findings: [belowBaseline] }), false, today);
  assert.deepEqual(output.lines, [header, dateLine, belowBaselineLine, 'evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)']);
  assert.equal(output.code, 0);
  assert.deepEqual(output.findings, [belowBaselineLine]);
  assert.deepEqual(output.failing, [belowBaselineLine]);
});

test('the same finding under --strict prints the same line, a summary that says exit 1, and exits 1', () => {
  const output = render(checked({ findings: [belowBaseline] }), true, today);
  assert.deepEqual(output.lines, [header, dateLine, belowBaselineLine, 'evals-baseline: 1 finding; exit 1 (--strict)']);
  assert.equal(output.code, 1);
  assert.deepEqual(output.findings, [belowBaselineLine]);
  assert.deepEqual(output.failing, [belowBaselineLine]);
});

test('findings are counted in the plural, and the lines keep the order the comparison gave them', () => {
  const findings = [casesChanged, sampleCount('agent :: accuracy'), sampleCount('agent :: format')];
  const lines = [
    casesChangedLine,
    'sample-count "agent :: accuracy": the baseline holds 4 samples and this run holds 3',
    'sample-count "agent :: format": the baseline holds 4 samples and this run holds 3',
  ];
  const warned = render(checked({ findings }), false, today);
  assert.deepEqual(warned.lines, [header, dateLine, ...lines, 'evals-baseline: 3 findings; warning only, exit 0 (pass --strict to exit 1)']);
  assert.equal(warned.code, 0);
  const strict = render(checked({ findings }), true, today);
  assert.deepEqual(strict.lines, [header, dateLine, ...lines, 'evals-baseline: 3 findings; exit 1 (--strict)']);
  assert.equal(strict.code, 1);
  assert.deepEqual(strict.findings, lines);
  assert.deepEqual(strict.failing, lines.slice(1));
});

test('cases-changed is printed and counted but never makes --strict exit 1, and its summary says so', () => {
  const summary = 'evals-baseline: 1 finding; warning only, exit 0 (cases-changed never fails --strict)';
  for (const strict of [false, true]) {
    const output = render(checked({ findings: [casesChanged] }), strict, today);
    assert.deepEqual(output.lines, [header, dateLine, casesChangedLine, summary]);
    assert.equal(output.code, 0);
    assert.deepEqual(output.findings, [casesChangedLine]);
    assert.deepEqual(output.failing, []);
  }
});

test('notes follow the findings, each starting with "note: ", and are not counted', () => {
  const output = render(
    checked({ findings: [sampleCount('agent :: accuracy')], notes: [runError('agent: 1 errored test(s) in this run (promptfoo testErrorCount)'), runError('another note')] }),
    false,
    today,
  );
  assert.deepEqual(output.lines, [
    header,
    dateLine,
    'sample-count "agent :: accuracy": the baseline holds 4 samples and this run holds 3',
    'note: agent: 1 errored test(s) in this run (promptfoo testErrorCount)',
    'note: another note',
    'evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)',
  ]);
  assert.equal(output.findings.length, 1);
});

test('notes alone leave the summary at no findings', () => {
  const output = render(checked({ notes: [{ kind: 'metrics-only-in-run', keys: ['agent :: extra'] }] }), true, today);
  assert.deepEqual(output.lines, [
    header,
    dateLine,
    'note: 1 metric(s) only in this run, not compared (rule 3): "agent :: extra"',
    'evals-baseline: no findings',
  ]);
  assert.equal(output.code, 0);
});

test('a baseline that was not read prints a header with the path alone, no date line, and the finding it was reported as', () => {
  const missing = { id: 'no-baseline', file: 'does-not-exist.json' };
  const output = render({ baselinePath: 'does-not-exist.json', baseline: null, findings: [missing], notes: [] }, false, today);
  assert.deepEqual(output.lines, [
    `${banner} check "does-not-exist.json"`,
    'no-baseline: no baseline at "does-not-exist.json"; nothing was compared; record one with: evals-baseline record <run-file>',
    'evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 3)',
  ]);
  assert.equal(render({ baselinePath: 'does-not-exist.json', baseline: null, findings: [missing], notes: [] }, true, today).code, 3);
});

test('a baseline whose tool wrote no version is headed "version unknown"', () => {
  const baseline = promptfooBaseline({
    source: { tool: 'deepeval', toolVersion: null, shape: 'deepeval-test-run' },
    cases: { count: 4, digest: deepevalDigest },
  });
  assert.equal(render(checked({ baseline }), false, today).lines[0], `${banner} check "evals-baseline.json": deepeval version unknown, 2 metrics, 4 cases`);
});

test('the header counts one metric and one case in the singular', () => {
  const baseline = promptfooBaseline({ cases: { count: 1, digest: promptfooDigest }, metrics: [{ key: 'm', value: 1, samples: 4, tolerance: 0 }] });
  assert.equal(render(checked({ baseline }), false, today).lines[0], `${banner} check "evals-baseline.json": promptfoo "0.125.1", 1 metric, 1 case`);
});

test('the date line counts days from the recorded date to the day of the check', () => {
  const dateFor = (recordedAt, checkDay) => render(checked({ baseline: promptfooBaseline({ recordedAt }) }), false, checkDay).lines[1];
  assert.equal(dateFor('2026-09-02T09:00:00.000Z', '2026-11-11'), 'date: baseline recorded 2026-09-02, 70 days before this check on 2026-11-11');
  assert.equal(dateFor('2026-09-02T09:00:00.000Z', '2027-11-11'), 'date: baseline recorded 2026-09-02, 435 days before this check on 2027-11-11');
  assert.equal(dateFor('2026-11-10T23:59:59.999Z', '2026-11-11'), 'date: baseline recorded 2026-11-10, 1 day before this check on 2026-11-11');
  assert.equal(dateFor('2026-11-11T00:00:00.000Z', '2026-11-11'), 'date: baseline recorded 2026-11-11, the same day as this check on 2026-11-11');
  assert.equal(dateFor('2026-11-12T00:00:00.000Z', '2026-11-11'), 'date: baseline recorded 2026-11-12, 1 day after this check on 2026-11-11');
  assert.equal(dateFor('2026-11-13T08:00:00.000Z', '2026-11-11'), 'date: baseline recorded 2026-11-13, 2 days after this check on 2026-11-11');
});

test('the date line agrees with Date.UTC for every pair of days around leap days, century years, month ends and year ends', () => {
  const days = [
    '1999-12-31', '2000-01-01', '2000-02-28', '2000-02-29', '2000-03-01', '2024-02-28', '2024-02-29', '2024-03-01',
    '2025-02-28', '2025-03-01', '2026-01-31', '2026-02-01', '2026-12-31', '2027-01-01', '2100-02-28', '2100-03-01',
    '1900-02-28', '1900-03-01', '0400-02-29', '0400-03-01', '9999-12-31',
  ];
  const utc = (day) => new Date(`${day}T00:00:00.000Z`).getTime();
  for (const recorded of days) {
    for (const checkDay of days) {
      const apart = Math.round((utc(checkDay) - utc(recorded)) / 86400000);
      let expected = 'the same day as';
      if (apart > 0) {
        expected = `${apart} ${apart === 1 ? 'day' : 'days'} before`;
      } else if (apart < 0) {
        expected = `${-apart} ${apart === -1 ? 'day' : 'days'} after`;
      }
      const line = render(checked({ baseline: promptfooBaseline({ recordedAt: `${recorded}T10:20:30.400Z` }) }), false, checkDay).lines[1];
      assert.equal(line, `date: baseline recorded ${recorded}, ${expected} this check on ${checkDay}`);
    }
  }
});

test('specimen S7: the same baseline and run rendered a year apart give the same exit code, findings and summary, and only the date line differs', () => {
  const result = checked({ findings: [belowBaseline], notes: [runError('a note')] });
  for (const strict of [false, true]) {
    const early = render(result, strict, '2026-11-11');
    const late = render(result, strict, '2027-11-11');
    assert.equal(early.code, late.code);
    assert.deepEqual(early.findings, late.findings);
    assert.deepEqual(early.failing, late.failing);
    assert.equal(early.lines.length, late.lines.length);
    const differing = early.lines.map((line, index) => index).filter((index) => early.lines[index] !== late.lines[index]);
    assert.deepEqual(differing, [1]);
    assert.match(early.lines[1], /^date: baseline recorded 2026-09-02, 70 days before this check on 2026-11-11$/);
    assert.match(late.lines[1], /^date: baseline recorded 2026-09-02, 435 days before this check on 2027-11-11$/);
  }
});

test('render changes nothing it was given', () => {
  const frozen = deepFreeze(checked({ findings: [casesChanged, belowBaseline], notes: [runError('a note')] }));
  const first = render(frozen, true, today);
  const second = render(frozen, true, today);
  assert.deepEqual(first, second);
});

test('a record refusal prints the notes it is given as note lines after the held tolerances', () => {
  const lines = renderRecordRefusal(
    'the reason',
    [{ key: 'agent :: format', reason: 'it has no samples' }],
    [{ key: 'agent :: accuracy', tolerance: 0.3 }],
    ['"agent :: accuracy": would fall by 0.25, from 1 over 4 samples to 0.75 over 4 samples'],
  );
  assert.deepEqual(lines, [
    `${banner} record: refused: the reason; nothing written`,
    'note: "agent :: format" not recorded: it has no samples',
    'note: "agent :: accuracy": the baseline holds the tolerance 0.3',
    'note: "agent :: accuracy": would fall by 0.25, from 1 over 4 samples to 0.75 over 4 samples',
  ]);
});

test('a record refusal given no notes prints the reason line and nothing else', () => {
  assert.deepEqual(renderRecordRefusal('the reason', []), [`${banner} record: refused: the reason; nothing written`]);
});
