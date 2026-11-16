import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBaseline, specificationVersion } from '../src/read-baseline.mjs';
import { deepevalDigest, promptfooDigest } from './support/digests.mjs';
import { readFixtureText } from './support/fixtures.mjs';
import { accuracyKey, edited, refusal } from './support/read-baseline.mjs';

test('the specification this implementation reads is 1.0', () => {
  assert.equal(specificationVersion, '1.0');
});

test('the committed promptfoo baseline is read into a baseline with its metrics in key order', () => {
  assert.deepEqual(readBaseline(readFixtureText('promptfoo', 'evals-baseline.json'), 'evals-baseline.json'), {
    spec: '1.0',
    source: { tool: 'promptfoo', toolVersion: '0.125.1', shape: 'promptfoo-results-3' },
    recordedAt: '2026-09-02T09:00:00.000Z',
    cases: { count: 4, digest: promptfooDigest },
    metrics: [
      { key: 'agent :: accuracy', value: 1, samples: 4, tolerance: 0 },
      { key: 'agent :: format', value: 1, samples: 4, tolerance: 0 },
    ],
  });
});

test('the committed DeepEval baseline is read, with a null tool version', () => {
  const baseline = readBaseline(readFixtureText('deepeval', 'evals-baseline.json'), 'evals-baseline.json');
  assert.deepEqual(baseline.source, { tool: 'deepeval', toolVersion: null, shape: 'deepeval-test-run' });
  assert.deepEqual(baseline.cases, { count: 4, digest: deepevalDigest });
  assert.deepEqual(
    baseline.metrics.map((metric) => metric.key),
    ['Accuracy', 'Format'],
  );
});

test('metrics come back in key order whatever order the file wrote them in', () => {
  const text = edited((document) => {
    document.metrics = { z: document.metrics[accuracyKey], '10': document.metrics[accuracyKey], '9': document.metrics[accuracyKey], a: document.metrics[accuracyKey] };
  });
  assert.deepEqual(
    readBaseline(text, 'b.json').metrics.map((metric) => metric.key),
    ['10', '9', 'a', 'z'],
  );
});

test('the spec is judged before any key: a newer baseline with keys this version does not know is refused for its version', () => {
  const text = edited((document) => {
    document.spec = '1.5';
    document.futureKey = true;
  });
  assert.equal(refusal(text, 'future.json'), '"future.json": specification 1.5 is newer than 1.0, the newest this implementation reads');
});

test('a baseline that is not JSON, or not an object, is refused', () => {
  assert.equal(refusal('not json', 'text.json'), '"text.json": not JSON');
  assert.equal(refusal('', 'empty.json'), '"empty.json": not JSON');
  for (const text of ['[]', '"x"', '12', 'null', 'true']) {
    assert.equal(refusal(text, 'odd.json'), '"odd.json": not a JSON object');
  }
});

test('a key beyond those the specification defines is refused at every level, naming the first one', () => {
  assert.equal(refusal(edited((d) => (d.extra = 1)), 'b.json'), '"b.json": unknown key "extra" in the baseline');
  assert.equal(refusal(edited((d) => (d.source.extra = 1)), 'b.json'), '"b.json": unknown key "extra" in source');
  assert.equal(refusal(edited((d) => (d.cases.extra = 1)), 'b.json'), '"b.json": unknown key "extra" in cases');
  assert.equal(
    refusal(edited((d) => (d.metrics[accuracyKey].extra = 1)), 'b.json'),
    '"b.json": unknown key "extra" in metrics["agent :: accuracy"]',
  );
});

test('a misspelt tolerance is refused instead of being read as the default', () => {
  const text = edited((document) => {
    const entry = document.metrics[accuracyKey];
    entry.tolerence = entry.tolerance;
    delete entry.tolerance;
  });
  assert.equal(refusal(text, 'typo.json'), '"typo.json": unknown key "tolerence" in metrics["agent :: accuracy"]');
});

test('a key the specification defines that is missing is refused at every level', () => {
  assert.equal(refusal(edited((d) => delete d.cases), 'b.json'), '"b.json": missing key "cases" in the baseline');
  assert.equal(refusal(edited((d) => delete d.source), 'b.json'), '"b.json": missing key "source" in the baseline');
  assert.equal(refusal(edited((d) => delete d.recordedAt), 'b.json'), '"b.json": missing key "recordedAt" in the baseline');
  assert.equal(refusal(edited((d) => delete d.metrics), 'b.json'), '"b.json": missing key "metrics" in the baseline');
  assert.equal(refusal(edited((d) => delete d.spec), 'b.json'), '"b.json": missing key "spec" in the baseline');
  assert.equal(refusal(edited((d) => delete d.source.toolVersion), 'b.json'), '"b.json": missing key "toolVersion" in source');
  assert.equal(refusal(edited((d) => delete d.cases.digest), 'b.json'), '"b.json": missing key "digest" in cases');
  assert.equal(
    refusal(edited((d) => delete d.metrics[accuracyKey].samples), 'b.json'),
    '"b.json": missing key "samples" in metrics["agent :: accuracy"]',
  );
});

test('a level that is not an object is refused', () => {
  assert.equal(refusal(edited((d) => (d.source = 'promptfoo')), 'b.json'), '"b.json": source must be an object');
  assert.equal(refusal(edited((d) => (d.cases = [])), 'b.json'), '"b.json": cases must be an object');
  assert.equal(refusal(edited((d) => (d.metrics = [])), 'b.json'), '"b.json": metrics must be an object');
  assert.equal(refusal(edited((d) => (d.metrics[accuracyKey] = 1)), 'b.json'), '"b.json": metrics["agent :: accuracy"] must be an object');
});

test('a baseline that names no metric is refused because it guards nothing', () => {
  assert.equal(refusal(edited((d) => (d.metrics = {})), 'empty.json'), '"empty.json": metrics names no metric, so the baseline guards nothing');
});

test('a bad value is refused with the field and what it must be', () => {
  const cases = [
    [(d) => (d.source.tool = 'ragas'), 'source.tool must be "promptfoo" or "deepeval"'],
    [(d) => (d.source.toolVersion = 7), 'source.toolVersion must be a string or null'],
    [(d) => (d.source.shape = 'promptfoo-results-2'), 'source.shape must be "promptfoo-results-3" when source.tool is "promptfoo"'],
    [(d) => (d.recordedAt = '2026-09-02'), 'recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z'],
    [(d) => (d.recordedAt = '2026-13-02T09:00:00.000Z'), 'recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z'],
    [(d) => (d.recordedAt = '2026-02-31T09:00:00.000Z'), 'recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z'],
    [(d) => (d.recordedAt = '2025-02-29T09:00:00.000Z'), 'recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z'],
    [(d) => (d.recordedAt = '2026-09-02T09:00:00Z'), 'recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z'],
    [(d) => (d.recordedAt = 20260902), 'recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z'],
    [(d) => (d.cases.count = 0), 'cases.count must be a positive integer'],
    [(d) => (d.cases.count = 2.5), 'cases.count must be a positive integer'],
    [(d) => (d.cases.count = '4'), 'cases.count must be a positive integer'],
    [(d) => (d.cases.digest = 'E6C6ECF167AB'), 'cases.digest must be 12 lowercase hexadecimal characters'],
    [(d) => (d.cases.digest = 'd505092de5b'), 'cases.digest must be 12 lowercase hexadecimal characters'],
    [(d) => (d.metrics[accuracyKey].value = '1'), 'metrics["agent :: accuracy"].value must be a number between -4000000000 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].value = 1e10), 'metrics["agent :: accuracy"].value must be a number between -4000000000 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].value = null), 'metrics["agent :: accuracy"].value must be a number between -4000000000 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].value = 4000000001), 'metrics["agent :: accuracy"].value must be a number between -4000000000 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].value = -4000000001), 'metrics["agent :: accuracy"].value must be a number between -4000000000 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].value = 9000000000), 'metrics["agent :: accuracy"].value must be a number between -4000000000 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].samples = 0), 'metrics["agent :: accuracy"].samples must be a positive integer'],
    [(d) => (d.metrics[accuracyKey].samples = 3.5), 'metrics["agent :: accuracy"].samples must be a positive integer'],
    [(d) => (d.metrics[accuracyKey].tolerance = -0.01), 'metrics["agent :: accuracy"].tolerance must be a number between 0 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].tolerance = '0.02'), 'metrics["agent :: accuracy"].tolerance must be a number between 0 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].tolerance = 1e10), 'metrics["agent :: accuracy"].tolerance must be a number between 0 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].tolerance = 4000000001), 'metrics["agent :: accuracy"].tolerance must be a number between 0 and 4000000000'],
    [(d) => (d.metrics[accuracyKey].tolerance = 9000000000), 'metrics["agent :: accuracy"].tolerance must be a number between 0 and 4000000000'],
  ];
  for (const [edit, problem] of cases) {
    assert.equal(refusal(edited(edit), 'b.json'), `"b.json": ${problem}`, problem);
  }
  assert.equal(
    refusal(edited((d) => (d.source.shape = 'promptfoo-results-3'), 'deepeval'), 'b.json'),
    '"b.json": source.shape must be "deepeval-test-run" when source.tool is "deepeval"',
  );
});

test('a tolerance of zero, a tolerance with decimals and a negative value are accepted where the specification allows them', () => {
  const text = edited((document) => {
    document.metrics[accuracyKey].tolerance = 0.02;
    document.metrics[accuracyKey].value = -1.5;
  });
  assert.deepEqual(readBaseline(text, 'b.json').metrics[0], { key: accuracyKey, value: -1.5, samples: 4, tolerance: 0.02 });
});

test('recordedAt follows the calendar: leap days are accepted only in leap years, and a day beyond the month is refused', () => {
  const accepted = ['2024-02-29', '2000-02-29', '0000-02-29', '2026-02-28', '2026-04-30', '2026-12-31', '2026-01-31'];
  const refused = ['2100-02-29', '1900-02-29', '2026-02-29', '2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31'];
  for (const day of accepted) {
    const text = edited((document) => (document.recordedAt = `${day}T23:59:59.999Z`));
    assert.equal(readBaseline(text, 'b.json').recordedAt, `${day}T23:59:59.999Z`, day);
  }
  for (const day of refused) {
    const text = edited((document) => (document.recordedAt = `${day}T00:00:00.000Z`));
    assert.equal(refusal(text, 'b.json'), '"b.json": recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z', day);
  }
});

test('the first problem is the one named, in the order of the file: top-level keys, then source, then cases, then metrics', () => {
  const text = edited((document) => {
    document.metrics[accuracyKey].tolerance = -1;
    document.cases.count = 0;
    document.source.tool = 'ragas';
  });
  assert.equal(refusal(text, 'b.json'), '"b.json": source.tool must be "promptfoo" or "deepeval"');
});

test('every refusal starts with the name it was given', () => {
  for (const text of ['', '[]', '{}', edited((d) => (d.spec = '9.9'))]) {
    assert.equal(refusal(text, 'given-name.json').startsWith('"given-name.json": '), true);
  }
});

test('a metric called __proto__ is read as an ordinary key', () => {
  const text = readFixtureText('promptfoo', 'evals-baseline.json').replace('"agent :: format"', '"__proto__"');
  assert.deepEqual(
    readBaseline(text, 'b.json').metrics.map((metric) => metric.key),
    ['__proto__', 'agent :: accuracy'],
  );
});

test('a name, a key or a metric key with a quote, a backslash or an invisible character is spelt with escapes in the refusal', () => {
  assert.equal(refusal('not json', 'a"b\\c.json'), '"a\\u0022b\\\\c.json": not JSON');
  assert.equal(refusal(edited((d) => (d['x\u200dy"'] = 1)), 'b.json'), '"b.json": unknown key "x\\u200dy\\u0022" in the baseline');
  const text = edited((document) => {
    document.metrics['m"1\u00ad'] = { value: '1', samples: 4, tolerance: 0 };
  });
  assert.equal(
    refusal(text, 'b.json'),
    '"b.json": metrics["m\\u00221\\u00ad"].value must be a number between -4000000000 and 4000000000',
  );
});
