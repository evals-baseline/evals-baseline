import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare } from '../src/compare.mjs';
import { promptfooThreeCasesDigest } from './support/digests.mjs';
import { baselineMetric, deepFreeze, makeBaseline, makeRun, runMetric } from './support/compare-fixtures.mjs';
import { fieldsOf, findingFields, noteFields, variantOf } from './support/model.mjs';

const hostileKey = (name) => `${name}"\\\n::x`;

function everythingFound(keyOf = (name) => name) {
  const baseline = makeBaseline([
    baselineMetric(keyOf('below'), 0.92, 4, 0.02),
    baselineMetric(keyOf('missing'), 1),
    baselineMetric(keyOf('unreadable'), 0.5),
    baselineMetric(keyOf('grown'), 1),
    baselineMetric(keyOf('fewer'), 1, 4),
  ]);
  const run = makeRun([runMetric(keyOf('below'), 0.5, 3), runMetric(keyOf('grown'), 1, 6), runMetric(keyOf('fewer'), 1, 2), runMetric(keyOf('extra'), 1)], {
    cases: { count: 3, digest: promptfooThreeCasesDigest },
    toolVersion: '0.126.0',
    errors: ['"agent": 1 errored test(s) in this run (promptfoo testErrorCount)'],
    refused: [
      { key: keyOf('unreadable'), reason: 'why' },
      { key: keyOf('weighted'), reason: 'weights' },
    ],
  });
  return compare(deepFreeze(baseline), deepFreeze(run));
}

const otherToolFound = () =>
  compare(
    makeBaseline([baselineMetric('a', 1)], { source: { tool: 'deepeval', toolVersion: null, shape: 'deepeval-test-run' } }),
    makeRun([runMetric('a', 1)], { name: 'run"\\.json' }),
  );

test('a comparison that finds everything holds a record of every variant a comparison can produce, with the fields that variant is pinned to hold', () => {
  const { findings, notes } = everythingFound();
  assert.deepEqual([...new Set(findings.map(variantOf))].sort(), ['below-baseline', 'cases-changed', 'missing-metric', 'sample-count', 'unreadable-metric']);
  assert.deepEqual([...new Set(notes.map(variantOf))].sort(), Object.keys(noteFields).sort());
  for (const record of findings) {
    assert.deepEqual(fieldsOf(record), findingFields[variantOf(record)], variantOf(record));
  }
  for (const record of notes) {
    assert.deepEqual(fieldsOf(record), noteFields[variantOf(record)], variantOf(record));
  }
});

test('a run of the other tool is one record with the fields that bad-run is pinned to hold when the other tool is the cause', () => {
  const { findings, notes } = otherToolFound();
  assert.equal(findings.length, 1);
  assert.equal(variantOf(findings[0]), 'bad-run/other-tool');
  assert.deepEqual(fieldsOf(findings[0]), findingFields['bad-run/other-tool']);
  assert.deepEqual(notes, []);
});

test('every record is plain data: it comes back equal from JSON, so a format that is not text can carry it as it is', () => {
  for (const result of [everythingFound(), otherToolFound()]) {
    for (const record of [...result.findings, ...result.notes]) {
      assert.deepEqual(JSON.parse(JSON.stringify(record)), record, variantOf(record));
    }
  }
});

test('the values, the tolerance and the drop are held as whole millionths, the numbers the comparison decided on', () => {
  const { findings } = everythingFound();
  const below = findings.find((finding) => finding.id === 'below-baseline');
  assert.deepEqual(below.baseline, { value: 920000, samples: 4, tolerance: 20000 });
  assert.deepEqual(below.run, { value: 500000, samples: 3 });
  assert.equal(below.drop, 420000);
  const missing = findings.find((finding) => finding.id === 'missing-metric');
  assert.deepEqual(missing.baseline, { value: 1000000, samples: 4 });
});

test('the drop is the baseline value less the run value, and it is more than the tolerance, for every below-baseline finding over a spread of values', () => {
  let seen = 0;
  for (const run of [0, 0.1, 0.25, 0.5, 0.899999, 0.9, 0.900001, 0.919999, -1, 1 / 3, 6 / 7]) {
    for (const tolerance of [0, 0.000001, 0.02, 0.5]) {
      const { findings } = compare(makeBaseline([baselineMetric('m', 0.92, 4, tolerance)]), makeRun([runMetric('m', run)]));
      for (const finding of findings.filter((candidate) => candidate.id === 'below-baseline')) {
        seen += 1;
        assert.equal(Number.isInteger(finding.drop) && Number.isInteger(finding.baseline.value) && Number.isInteger(finding.run.value), true);
        assert.equal(finding.drop, finding.baseline.value - finding.run.value);
        assert.equal(finding.drop > finding.baseline.tolerance, true);
      }
    }
  }
  assert.equal(seen > 20, true);
});

test('a key is held exactly as the file spelt it, with the quote, the backslash and the newline in it, in every finding and note that has one', () => {
  const { findings, notes } = everythingFound(hostileKey);
  const keys = [...findings, ...notes].flatMap((record) => record.key ?? record.keys ?? []);
  assert.deepEqual([...new Set(keys)].sort(), ['below', 'extra', 'fewer', 'grown', 'missing', 'unreadable', 'weighted'].map(hostileKey).sort());
  assert.equal(keys.every((key) => key.includes('"\\\n::x') && !key.startsWith('"')), true);
});

test('the file of a bad-run finding is held exactly as it was named', () => {
  assert.equal(otherToolFound().findings[0].file, 'run"\\.json');
});
