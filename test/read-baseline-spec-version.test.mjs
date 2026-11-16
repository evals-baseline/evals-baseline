import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBaseline } from '../src/read-baseline.mjs';
import { edited, refusal } from './support/read-baseline.mjs';

const malformedSpecification = (got) =>
  `"b.json": spec must be MAJOR.MINOR with no third number and no leading zeros, such as "1.0", got ${got}`;

const refusedWith = (cases) => {
  for (const [spec, got] of cases) {
    assert.equal(refusal(edited((d) => (d.spec = spec)), 'b.json'), malformedSpecification(got), JSON.stringify(spec));
  }
};

const refusedAsMalformed = (specs) => refusedWith(specs.map((spec) => [spec, `"${spec}"`]));

test('a baseline of specification 1.0, the one this implementation reads, is read', () => {
  assert.equal(readBaseline(edited((d) => (d.spec = '1.0')), 'b.json').spec, '1.0');
});

test('a baseline of a newer minor of the same major is refused, naming both versions, with the minor compared as a number', () => {
  for (const spec of ['1.1', '1.9', '1.10']) {
    assert.equal(
      refusal(edited((d) => (d.spec = spec)), 'newer.json'),
      `"newer.json": specification ${spec} is newer than 1.0, the newest this implementation reads`,
      spec,
    );
  }
});

test('a baseline of another major is refused, naming both versions, whatever its minor is', () => {
  for (const spec of ['0.0', '0.9', '2.0', '10.0', '11.20']) {
    assert.equal(
      refusal(edited((d) => (d.spec = spec)), 'other.json'),
      `"other.json": specification ${spec} is not read by this implementation, which reads 1.x up to 1.0`,
      spec,
    );
  }
});

test('a spec with a third number is malformed, and is not judged newer or another major', () => {
  refusedAsMalformed(['1.0.0', '1.0.7', '1.2.3', '2.0.0', '10.0.0', '1.0.0.0']);
});

test('a spec with a leading zero in either number is malformed', () => {
  refusedAsMalformed(['01.0', '1.00', '01.00', '00.0', '0.00', '1.000']);
});

test('a spec that is not exactly two numerals joined by one dot is malformed', () => {
  refusedAsMalformed(['1', '1.', '.1', '1,0', '1..0', 'v1.0', '1.x', '', ' 1.0', '1.0 ', '+1.0', '-1.0', '1.0e0', '100', '1 0', '1.0-1']);
});

test('a spec that is not a JSON string is malformed, and is spelt as JSON text', () => {
  refusedWith([
    [10, '10'],
    [1.0, '1'],
    [1.5, '1.5'],
    [null, 'null'],
    [true, 'true'],
    [false, 'false'],
    [['1.0'], '"[\\u00221.0\\u0022]"'],
    [{ major: 1 }, '"{\\u0022major\\u0022:1}"'],
    [[], '"[]"'],
    [{}, '"{}"'],
  ]);
});

test('a spec followed or preceded by a line break is malformed: the end of the pattern is the end of the text', () => {
  refusedWith([
    ['1.0\n', '"1.0\\u000a"'],
    ['1.0\r\n', '"1.0\\u000d\\u000a"'],
    ['1.0\n\n', '"1.0\\u000a\\u000a"'],
    ['\n1.0', '"\\u000a1.0"'],
  ]);
});

test('a spec written with a decimal digit other than 0 to 9 is malformed: only the ASCII digits are digits', () => {
  refusedAsMalformed(['\uFF11.\uFF10', '\uFF11.0', '1.\uFF10', '\u0661.\u0660', '1\uFF10.0', '1.1\uFF10', '1\u0660.\u0661']);
});

test('a malformed spec is refused as malformed before any version is compared and before any key is checked', () => {
  const text = edited((document) => {
    document.spec = '2.0.0';
    document.futureKey = true;
    delete document.cases;
  });
  assert.equal(refusal(text, 'b.json'), malformedSpecification('"2.0.0"'));
});
