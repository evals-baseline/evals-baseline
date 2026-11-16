import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { jsonSafe, printable } from '../src/printable.mjs';
import { makeScratch, plantMutation, readModule } from './support/mutate.mjs';
import { drawingNoInk, runtimePrints } from './support/printable-oracles.mjs';
import { concatenatedModules } from './support/source.mjs';

const scratch = makeScratch();
after(() => rmSync(scratch, { recursive: true, force: true }));

const unicode = (codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
const escapeOf = (codePoint) => (codePoint > 0xffff ? `\\u{${codePoint.toString(16)}}` : `\\u${codePoint.toString(16).padStart(4, '0')}`);
const jsonEscapeOf = (codePoint) =>
  String.fromCodePoint(codePoint)
    .split('')
    .map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .join('');
const surrounded = (codePoint) => `a${String.fromCodePoint(codePoint)}b`;
const escapedBetween = (codePoint) => `a${escapeOf(codePoint)}b`;

const printedAtUnicode15Point1 = {
  count: 149351,
  digest: 'f12bd6aa06f5a47f7f260e82de4d40dbc02643db96c51daf38aee353b0cebda8',
};

const assignedAtUnicode15Point1 = [
  { codePoint: 0x2ffc, name: 'IDEOGRAPHIC DESCRIPTION CHARACTER SURROUND FROM RIGHT' },
  { codePoint: 0x31ef, name: 'IDEOGRAPHIC DESCRIPTION CHARACTER SUBTRACTION' },
  { codePoint: 0x2ebf0, name: 'the first CJK ideograph of Extension I' },
  { codePoint: 0x2ee5d, name: 'the last CJK ideograph of Extension I' },
];

const assignedAfterUnicode15Point1 = [
  { edition: '16.0', codePoint: 0x1c89, name: 'CYRILLIC CAPITAL LETTER TJE' },
  { edition: '16.0', codePoint: 0x10d40, name: 'GARAY DIGIT ZERO' },
  { edition: '16.0', codePoint: 0x105c0, name: 'TODHRI LETTER A' },
  { edition: '16.0', codePoint: 0x0897, name: 'ARABIC PEPET' },
  { edition: '16.0', codePoint: 0x1fae9, name: 'FACE WITH BAGS UNDER EYES' },
  { edition: '17.0', codePoint: 0x20c1, name: 'SAUDI RIYAL SIGN' },
  { edition: '17.0', codePoint: 0xa7ce, name: 'LATIN CAPITAL LETTER PHARYNGEAL VOICED FRICATIVE' },
  { edition: '17.0', codePoint: 0x088f, name: 'ARABIC LETTER NOON WITH RING ABOVE' },
  { edition: '17.0', codePoint: 0x1acf, name: 'COMBINING DOUBLE CARON' },
  { edition: '17.0', codePoint: 0x1fac8, name: 'HAIRY CREATURE' },
  { edition: '18.0', codePoint: 0x0558, name: 'MODIFIER LETTER ARMENIAN SMALL EH' },
  { edition: '18.0', codePoint: 0xa7dd, name: 'LATIN CAPITAL LETTER CLOSED OMEGA' },
  { edition: '18.0', codePoint: 0x20c2, name: 'RUFIYAA SIGN' },
  { edition: '18.0', codePoint: 0x2e60, name: 'WIGGLY EXCLAMATION MARK' },
  { edition: '18.0', codePoint: 0x3fc3f, name: 'SEAL CHARACTER' },
];

const everyCodePoint = Array.from({ length: 0x110000 }, (_, codePoint) => codePoint);

function printedAsTheyAre(print) {
  const answers = new Uint8Array(0x110000);
  for (const codePoint of everyCodePoint) {
    const character = String.fromCodePoint(codePoint);
    answers[codePoint] = print(character) === character ? 1 : 0;
  }
  return answers;
}

const digestOf = (answers) => createHash('sha256').update(answers).digest('hex');
const countOf = (answers) => answers.reduce((total, bit) => total + bit, 0);

function problemsWith(print, source) {
  const problems = [];
  if (/\\[pP]\{/.test(source)) {
    problems.push('the source asks the runtime about a Unicode property');
  }
  for (const { codePoint } of assignedAfterUnicode15Point1) {
    if (print(surrounded(codePoint)) !== escapedBetween(codePoint)) {
      problems.push(`${unicode(codePoint)} is printed as it is`);
    }
  }
  for (const { codePoint } of assignedAtUnicode15Point1) {
    if (print(surrounded(codePoint)) !== surrounded(codePoint)) {
      problems.push(`${unicode(codePoint)} is replaced`);
    }
  }
  const answers = printedAsTheyAre(print);
  if (countOf(answers) !== printedAtUnicode15Point1.count || digestOf(answers) !== printedAtUnicode15Point1.digest) {
    problems.push(`${countOf(answers)} code points are printed as they are, with digest ${digestOf(answers)}`);
  }
  return problems;
}

async function problemsAfter(id, edits) {
  const directory = plantMutation(scratch, { id, module: 'printable', edits });
  const loaded = await import(pathToFileURL(join(directory, 'printable.mjs')).href);
  return problemsWith(loaded.printable, readFileSync(join(directory, 'printable.mjs'), 'utf8'));
}

const startOfTable = 'const printedRanges = [\n';
const unprintableLine = /^const unprintable = .*$/m.exec(readModule('printable'))?.[0];
const propertyRule = 'const unprintable = /[^\\p{L}\\p{M}\\p{N}\\p{P}\\p{S}\\u0020]|\\p{Default_Ignorable_Code_Point}|(?<=##)\\[/gu;';

test('acc\\u0558uracy is printed with its escape and written with its JSON escape on every runtime, because Unicode 15.1 has not assigned U+0558', () => {
  assert.equal(printable('acc\u0558uracy'), 'acc\\u0558uracy');
  assert.equal(jsonSafe('acc\u0558uracy'), 'acc\\u0558uracy');
});

test('a code point that Unicode assigned after 15.1 is replaced in a printed line and in a written baseline, whichever edition the runtime carries', () => {
  for (const { edition, codePoint, name } of assignedAfterUnicode15Point1) {
    const where = `${unicode(codePoint)} ${name}, assigned in ${edition}`;
    assert.equal(printable(surrounded(codePoint)), escapedBetween(codePoint), where);
    assert.equal(jsonSafe(surrounded(codePoint)), `a${jsonEscapeOf(codePoint)}b`, where);
  }
});

test('a code point that Unicode 15.1 itself assigned is printed as it is, in a printed line and in a written baseline', () => {
  for (const { codePoint, name } of assignedAtUnicode15Point1) {
    assert.equal(printable(surrounded(codePoint)), surrounded(codePoint), `${unicode(codePoint)} ${name}`);
    assert.equal(jsonSafe(surrounded(codePoint)), surrounded(codePoint), `${unicode(codePoint)} ${name}`);
  }
});

test('no module of src asks the runtime what a character is, so no Unicode property escape stands in any of them', () => {
  for (const name of [...concatenatedModules, 'cli']) {
    assert.equal(/\\[pP]\{/.test(readModule(name)), false, name);
  }
});

test(`the code points printed as they are number ${printedAtUnicode15Point1.count}, and the digest of the answer for each code point from U+0000 to U+10FFFF is the one recorded for Unicode 15.1 without the seven blank ones`, () => {
  const answers = printedAsTheyAre(printable);
  assert.equal(countOf(answers), printedAtUnicode15Point1.count);
  assert.equal(digestOf(answers), printedAtUnicode15Point1.digest);
});

test(
  'on a runtime that carries Unicode 15.1, the module prints as they are exactly the code points that this runtime prints as they are, less the seven blank ones',
  { skip: process.versions.unicode !== '15.1' && `this runtime carries Unicode ${process.versions.unicode}, so its own tables cannot give the answer for 15.1` },
  () => {
    const blank = new Set(drawingNoInk.map(({ codePoint }) => codePoint));
    for (const codePoint of everyCodePoint) {
      const character = String.fromCodePoint(codePoint);
      assert.equal(printable(character) === character, runtimePrints(codePoint) && !blank.has(codePoint), unicode(codePoint));
    }
  },
);

test('the check that guards the edition stays quiet on the module', () => {
  assert.notEqual(unprintableLine, undefined);
  assert.deepEqual(problemsWith(printable, readModule('printable')), []);
});

test('the check fails when the old rule, which asks the runtime for the Unicode properties, is planted back', async () => {
  const problems = await problemsAfter('edition-property-rule', [[unprintableLine, propertyRule]]);
  assert.equal(problems.includes('the source asks the runtime about a Unicode property'), true);
  assert.equal(problems.some((problem) => problem.includes('digest')), true);
});

test('the check fails when a code point of a later edition is planted into the table', async () => {
  const problems = await problemsAfter('edition-later-code-point', [[startOfTable, `${startOfTable}  0x558, 0x558,\n`]]);
  assert.deepEqual(problems.slice(0, 1), ['U+0558 is printed as it is']);
  assert.equal(problems.some((problem) => problem.includes('digest')), true);
});

test('the check fails when a range of Unicode 15.1 is lost from the table', async () => {
  const problems = await problemsAfter('edition-lost-range', [['0x2ebf0, 0x2ee5d,', '']]);
  assert.equal(problems.includes('U+2EBF0 is replaced'), true);
  assert.equal(problems.some((problem) => problem.includes('digest')), true);
});

test('the check fails on the digest alone when a range runs one code point past the last one that Unicode 15.1 assigned', async () => {
  const problems = await problemsAfter('edition-range-too-long', [['0x2ebf0, 0x2ee5d,', '0x2ebf0, 0x2ee5e,']]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /code points are printed as they are, with digest /);
});
