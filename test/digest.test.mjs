import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { canonicalJson, caseDigest } from '../src/digest.mjs';

const sha12 = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12);

test('canonicalJson sorts object keys at every depth, keeps array order and writes scalars as JSON.stringify does', () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: 1 }, 3] }), '{"a":[{"c":1,"d":2},3],"b":1}');
  assert.equal(canonicalJson([3, 1, 2]), '[3,1,2]');
  assert.equal(canonicalJson('a "quoted"\nline'), JSON.stringify('a "quoted"\nline'));
  assert.equal(canonicalJson(1.0), '1');
  assert.equal(canonicalJson(null), 'null');
  assert.equal(canonicalJson(true), 'true');
  assert.equal(canonicalJson({}), '{}');
  assert.equal(canonicalJson([]), '[]');
  assert.equal(canonicalJson('café ☕'), '"café ☕"');
});

test('canonicalJson does not depend on the order keys were written in', () => {
  assert.equal(canonicalJson({ question: 'q', capital: 'c' }), canonicalJson({ capital: 'c', question: 'q' }));
});

test('caseDigest is the first 12 hexadecimal characters of the SHA-256 of the sorted canonical identities joined with U+0001', () => {
  const identities = [{ question: 'Second', capital: 'B' }, { question: 'First', capital: 'A' }];
  const expected = sha12(['{"capital":"A","question":"First"}', '{"capital":"B","question":"Second"}'].join('\u0001'));
  assert.equal(caseDigest(identities), expected);
  assert.match(caseDigest(identities), /^[0-9a-f]{12}$/);
});

test('caseDigest does not depend on the order of the cases', () => {
  const identities = [{ n: 1 }, { n: 2 }, { n: 3 }];
  assert.equal(caseDigest(identities), caseDigest([identities[2], identities[0], identities[1]]));
});

test('caseDigest tells a swapped case, a removed case and a reworded case apart', () => {
  const four = [{ q: 'France' }, { q: 'Japan' }, { q: 'Egypt' }, { q: 'Canada' }];
  const digests = new Set([
    caseDigest(four),
    caseDigest([...four.slice(0, 3), { q: 'Peru' }]),
    caseDigest(four.slice(0, 3)),
    caseDigest([...four.slice(0, 3), { q: 'canada' }]),
  ]);
  assert.equal(digests.size, 4);
});

test('caseDigest joins with U+0001, so two identities never equal one identity that holds both texts', () => {
  assert.notEqual(caseDigest(['a', 'b']), caseDigest(['a\u0001b']));
  assert.equal(caseDigest(['a', 'b']), sha12('"a"\u0001"b"'));
});

test('caseDigest of no cases is the digest of the empty text', () => {
  assert.equal(caseDigest([]), sha12(''));
  assert.equal(caseDigest([]), 'e3b0c44298fc');
});
