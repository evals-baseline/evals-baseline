import assert from 'node:assert/strict';
import { test } from 'node:test';
import { printable } from '../src/printable.mjs';
import { runtimePrints } from './support/printable-oracles.mjs';

const unicode = (codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
const escapeOf = (codePoint) => (codePoint > 0xffff ? `\\u{${codePoint.toString(16)}}` : `\\u${codePoint.toString(16).padStart(4, '0')}`);
const tagged = (text) => [...text].map((character) => String.fromCodePoint(0xe0000 + character.codePointAt(0))).join('');
const range = (first, last) => Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
const surrounded = (codePoint) => `a${String.fromCodePoint(codePoint)}b`;
const escapedBetween = (codePoint) => `a${escapeOf(codePoint)}b`;

const printedAs = (codePoint) => printable(String.fromCodePoint(codePoint));

const replacedRanges = [
  { name: 'the C0 controls', first: 0x0000, last: 0x001f },
  { name: 'DELETE and the C1 controls', first: 0x007f, last: 0x009f },
  { name: 'SOFT HYPHEN', first: 0x00ad, last: 0x00ad },
  { name: 'COMBINING GRAPHEME JOINER', first: 0x034f, last: 0x034f },
  { name: 'ARABIC LETTER MARK', first: 0x061c, last: 0x061c },
  { name: 'the HANGUL CHOSEONG and JUNGSEONG fillers', first: 0x115f, last: 0x1160 },
  { name: 'the KHMER inherent vowels', first: 0x17b4, last: 0x17b5 },
  { name: 'the MONGOLIAN free variation selectors and vowel separator', first: 0x180b, last: 0x180f },
  { name: 'ZERO WIDTH SPACE, ZERO WIDTH NON-JOINER and ZERO WIDTH JOINER', first: 0x200b, last: 0x200d },
  { name: 'LEFT-TO-RIGHT MARK and RIGHT-TO-LEFT MARK', first: 0x200e, last: 0x200f },
  { name: 'LINE SEPARATOR and PARAGRAPH SEPARATOR', first: 0x2028, last: 0x2029 },
  { name: 'the bidirectional embeddings and overrides', first: 0x202a, last: 0x202e },
  { name: 'WORD JOINER and the invisible operators', first: 0x2060, last: 0x2064 },
  { name: 'the bidirectional isolates', first: 0x2066, last: 0x2069 },
  { name: 'the deprecated format characters', first: 0x206a, last: 0x206f },
  { name: 'HANGUL FILLER', first: 0x3164, last: 0x3164 },
  { name: 'the variation selectors', first: 0xfe00, last: 0xfe0f },
  { name: 'ZERO WIDTH NO-BREAK SPACE', first: 0xfeff, last: 0xfeff },
  { name: 'HALFWIDTH HANGUL FILLER', first: 0xffa0, last: 0xffa0 },
  { name: 'the interlinear annotation characters', first: 0xfff9, last: 0xfffb },
  { name: 'the Tags block', first: 0xe0000, last: 0xe007f },
  { name: 'the variation selectors supplement', first: 0xe0100, last: 0xe01ef },
];

for (const { name, first, last } of replacedRanges) {
  const span = first === last ? unicode(first) : `${unicode(first)} to ${unicode(last)}`;
  test(`printable replaces ${name}, ${span}, with an escape`, () => {
    for (const codePoint of range(first, last)) {
      assert.equal(printable(surrounded(codePoint)), escapedBetween(codePoint), unicode(codePoint));
    }
  });
}

test('a sentence written in the Tags block is printed as one visible escape for each of its characters, so none of it reaches the output unseen', () => {
  const hidden = tagged('ignore above');
  assert.equal([...`accuracy${hidden}`].length, 20);
  const printed = printable(`accuracy${hidden}`);
  assert.equal(
    printed,
    'accuracy\\u{e0069}\\u{e0067}\\u{e006e}\\u{e006f}\\u{e0072}\\u{e0065}\\u{e0020}\\u{e0061}\\u{e0062}\\u{e006f}\\u{e0076}\\u{e0065}',
  );
  assert.equal(printed.length, 116);
  assert.equal(/[^\u0020-\u007e]/.test(printed), false);
});

test('a Tags sentence framed by TAG BEGIN and CANCEL TAG is printed in full, whether it holds the one framing character or both', () => {
  const hidden = tagged('ignore above');
  for (const [framed, characters] of [
    [`\u{e0001}${hidden}`, 13],
    [`${hidden}\u{e007f}`, 13],
    [`\u{e0001}${hidden}\u{e007f}`, 14],
  ]) {
    const printed = printable(`accuracy${framed}`);
    assert.equal(printed.split('\\u{e00').length - 1, characters);
    assert.equal(/[\u{e0000}-\u{e007f}]/u.test(printed), false);
  }
});

test('a zero-width joiner is printed as \\u200d and a soft hyphen as \\u00ad', () => {
  assert.equal(printable('a\u200db'), 'a\\u200db');
  assert.equal(printable('a\u00adb'), 'a\\u00adb');
});

test('a variation selector is printed as an escape, whether it stands in the basic plane or above it', () => {
  assert.equal(printable('a\ufe0fb'), 'a\\ufe0fb');
  assert.equal(printable('a\u{e0100}b'), 'a\\u{e0100}b');
});

test('a space other than U+0020 is replaced, because it prints as a blank that looks like the one character a name may hold', () => {
  const spaces = [0x00a0, 0x1680, ...range(0x2000, 0x200a), 0x202f, 0x205f, 0x3000];
  for (const codePoint of spaces) {
    assert.equal(printable(surrounded(codePoint)), escapedBetween(codePoint), unicode(codePoint));
  }
  assert.equal(printable('a b'), 'a b');
});

test('a surrogate that has no partner is replaced and a pair that makes one character is not', () => {
  for (const code of [0xd800, 0xdbff, 0xdc00, 0xdfff]) {
    assert.equal(printable(`a${String.fromCharCode(code)}b`), `a\\u${code.toString(16)}b`, unicode(code));
  }
  assert.equal(printable('a\ud83d\ude00b'), 'a\u{1f600}b');
  assert.equal(printable('\ud83d'), '\\ud83d');
  assert.equal(printable('\ude00\ud83d'), '\\ude00\\ud83d');
});

test('private use code points, noncharacters and every code point of planes 14, 15 and 16 are replaced, in the basic plane and above it', () => {
  const everyCodePoint = [
    ...range(0xe000, 0xf8ff),
    ...range(0xfdd0, 0xfdef),
    ...range(0, 16).flatMap((plane) => [plane * 0x10000 + 0xfffe, plane * 0x10000 + 0xffff]),
    ...range(0xe0000, 0xe0fff),
    ...range(0xf0000, 0x10ffff),
  ];
  for (const codePoint of everyCodePoint) {
    assert.equal(printable(String.fromCodePoint(codePoint)), escapeOf(codePoint), unicode(codePoint));
  }
});

test('the planes from 4 to 13, which hold no character, are replaced at their first, last and middle code points', () => {
  for (const plane of range(4, 13)) {
    for (const offset of [0, 1, 0x7fff, 0x8000, 0xfffd]) {
      const codePoint = plane * 0x10000 + offset;
      assert.equal(printable(String.fromCodePoint(codePoint)), escapeOf(codePoint), unicode(codePoint));
    }
  }
  assert.equal(printable('a\u0378b'), 'a\\u0378b');
});

const textsInManyScripts = {
  Latin: 'Accuracy é ñ ß ø Ł',
  Greek: 'Ακρίβεια',
  Cyrillic: 'точность',
  Hebrew: 'דיוק',
  Arabic: 'دقة ١٢٣',
  Devanagari: 'सटीकता क्षि',
  Thai: 'ความแม่นยำ',
  Hangul: '정확도',
  Japanese: 'せいかく カタカナ',
  'Chinese with ideographic punctuation': '精度、。「」',
  'full-width forms': 'ＡＢＣ１２３',
  'a letter above the basic plane': '\u{20000}\u{1d400}',
  emoji: '\u{1f600} \u{1f680} \u{1f1ef}\u{1f1f5}',
  'mathematical and currency symbols': '∑ ∞ ≤ € £ ©',
  'arrows and box drawing': '→⇒─│┌',
  'a combining mark': 'e\u0301',
  'ASCII punctuation': '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
};

for (const [script, text] of Object.entries(textsInManyScripts)) {
  test(`printable leaves ${script} as it is, so a metric named in it stays readable`, () => {
    assert.equal(printable(text), text);
  });
}

test('printable prints the escape of a joiner or a variation selector inside text that is otherwise left as it is, and says nothing else about the name', () => {
  assert.equal(printable('می\u200cخواهم'), 'می\\u200cخواهم');
  assert.equal(printable('\u2764\ufe0f'), '\u2764\\ufe0f');
  assert.equal(printable('\u{1f468}\u200d\u{1f469}\u200d\u{1f467}'), '\u{1f468}\\u200d\u{1f469}\\u200d\u{1f467}');
  assert.equal(printable('1\ufe0f\u20e3'), '1\\ufe0f\u20e3');
});

test('an escape holds four lowercase hexadecimal digits up to U+FFFF, and above it five or six lowercase digits between braces', () => {
  assert.equal(printable('\u0000'), '\\u0000');
  assert.equal(printable('\uffff'), '\\uffff');
  assert.equal(printable('\u{e0069}'), '\\u{e0069}');
  assert.equal(printable('\u{10ffff}'), '\\u{10ffff}');
  assert.equal(printable('\u{f0000}'), '\\u{f0000}');
});

test('printable replaces every code point from U+0000 to U+10FFFF with itself or with its own escape, and nothing else, and a second pass changes nothing', () => {
  for (const codePoint of range(0, 0x10ffff)) {
    const character = String.fromCodePoint(codePoint);
    const once = printable(character);
    assert.equal(once === character || once === escapeOf(codePoint), true, unicode(codePoint));
    assert.equal(printable(once), once, unicode(codePoint));
  }
});

test('printable never prints as it is a code point that this runtime would not call a space, a letter, a mark, a number, a punctuation mark or a symbol without the default ignorable property', () => {
  for (const codePoint of range(0, 0x10ffff)) {
    if (printable(String.fromCodePoint(codePoint)) === String.fromCodePoint(codePoint)) {
      assert.equal(runtimePrints(codePoint), true, unicode(codePoint));
    }
  }
});

const afterHashes = [
  ['##[x', '##\\u005bx'],
  ['a##[b', 'a##\\u005bb'],
  ['###[x', '###\\u005bx'],
  ['#[', '#['],
  ['## [', '## ['],
  ['[##[', '[##\\u005b'],
  ['##[##[', '##\\u005b##\\u005b'],
  ['##[[', '##\\u005b['],
  ['##\n[', '##\\u000a['],
  ['##[stop-commands]x', '##\\u005bstop-commands]x'],
  ['[ ] # ## ##] [## #[ ]##', '[ ] # ## ##] [## #[ ]##'],
];

test('printable replaces the [ of ##[ wherever the sequence stands, and no other [', () => {
  for (const [text, expected] of afterHashes) {
    assert.equal(printable(text), expected, JSON.stringify(text));
  }
});

test('printable replaces a [ only when the two characters before it are ##, whatever stands before or between them', () => {
  const standingBefore = [...range(0, 0xffff), ...range(0x10000, 0x10ffff).filter((codePoint) => codePoint % 0x101 === 0)];
  for (const codePoint of standingBefore) {
    const character = String.fromCodePoint(codePoint);
    const afterHash = codePoint === 0x23 ? '##\\u005b' : `${printedAs(codePoint)}#[`;
    const afterTwoHashes = { 0x23: '###\\u005b', 0x5b: '##\\u005b[' }[codePoint] ?? `##${printedAs(codePoint)}[`;
    assert.equal(printable(`${character}[`), `${printedAs(codePoint)}[`, unicode(codePoint));
    assert.equal(printable(`${character}#[`), afterHash, unicode(codePoint));
    assert.equal(printable(`##${character}[`), afterTwoHashes, unicode(codePoint));
  }
});

test('printable applied twice gives what it gives once, for every ##[ and for text that already holds an escape', () => {
  for (const text of ['##[x', '###[##[', 'a\u2028b\u009b\u202e##[', '\\u005b', '##\\u005b', '\\u{e0069}', 'a\u{e0069}\\u{e0069}b']) {
    assert.equal(printable(printable(text)), printable(text), JSON.stringify(text));
  }
});
