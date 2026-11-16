import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBaseline } from '../src/read-baseline.mjs';
import { accuracyKey, edited, refusal } from './support/read-baseline.mjs';

test('a recordedAt with anything before or after the instant, a trailing newline included, is refused', () => {
  const instant = '2026-09-02T09:00:00.000Z';
  assert.equal(readBaseline(edited((d) => (d.recordedAt = instant)), 'b.json').recordedAt, instant);
  for (const padded of [`x${instant}`, `${instant}x`, `${instant}\n`, `\n${instant}`, ` ${instant}`, `${instant} `, `12${instant}`, `${instant}9`]) {
    assert.equal(refusal(edited((d) => (d.recordedAt = padded)), 'b.json').includes('recordedAt'), true, JSON.stringify(padded));
  }
});

test('a cases digest is read only when it is exactly twelve lowercase hexadecimal characters', () => {
  const digest = 'd505092de5bc';
  assert.equal(readBaseline(edited((d) => (d.cases.digest = digest)), 'b.json').cases.digest, digest);
  for (const wrong of [`a${digest}`, `${digest}a`, `${digest}\n`, `\n${digest}`, ` ${digest}`, `${digest} `, digest.slice(1), digest.toUpperCase(), 'g'.repeat(12), '']) {
    assert.equal(refusal(edited((d) => (d.cases.digest = wrong)), 'b.json').includes('cases.digest'), true, JSON.stringify(wrong));
  }
});

test('a leap year has a twenty-ninth of February and no thirtieth', () => {
  for (const day of ['2024-02-30', '2000-02-30', '2024-02-31', '2026-02-30', '2026-02-31']) {
    const text = edited((document) => (document.recordedAt = `${day}T00:00:00.000Z`));
    assert.equal(refusal(text, 'b.json').includes('recordedAt'), true, day);
  }
});

test('the smallest positive case count and sample count are read', () => {
  const text = edited((document) => {
    document.cases.count = 1;
    document.metrics[accuracyKey].samples = 1;
  });
  const baseline = readBaseline(text, 'b.json');
  assert.equal(baseline.cases.count, 1);
  assert.equal(baseline.metrics.find((metric) => metric.key === accuracyKey).samples, 1);
});
