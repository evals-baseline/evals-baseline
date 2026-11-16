import assert from 'node:assert/strict';
import { test } from 'node:test';
import { count, formatQuantised, isQuantisable, largestQuantisable, listKeys, quantise, roundToMillionths } from '../src/quantise.mjs';

const millionthsPerOne = 1000000;
const spacingOfNumbersNearTheBound = 2 ** -21;
const halfAMillionth = 0.5 / millionthsPerOne;
const spacingOfNumbersNearHalfAMillionth = 2 ** -73;
const formerLargestQuantisable = 9000000000;
const sweepSeed = 20260911;

function seededUnitInterval(seed) {
  let state = seed >>> 0;
  const next32 = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return (mixed ^ (mixed >>> 14)) >>> 0;
  };
  return () => ((next32() >>> 11) * 2 ** 32 + next32()) / 2 ** 53;
}

const within = (bound, random) => (2 * random() - 1) * bound;

const uniformValues = (bound, random) => Array.from({ length: 100000 }, () => within(bound, random));

const dyadicValues = (bound, random) =>
  Array.from({ length: 50000 }, () => {
    const exponent = Math.floor(random() * 22);
    return Math.round(within(bound, random) * 2 ** exponent) / 2 ** exponent;
  });

const halfwayValues = (bound, random) =>
  Array.from({ length: 50000 }, () => (Math.floor(within(bound, random) * millionthsPerOne) + 0.5) / millionthsPerOne);

function decimalsJustBelowTheBound(bound) {
  const boundInMillionths = bound * millionthsPerOne;
  const values = [];
  for (let below = 0; below < 25000; below += 1) {
    values.push((boundInMillionths - below) / millionthsPerOne, (below - boundInMillionths) / millionthsPerOne);
  }
  return values;
}

function neighboursOfTheBound(bound) {
  const values = [];
  for (let steps = 0; steps < 1000; steps += 1) {
    values.push(bound - steps * spacingOfNumbersNearTheBound, steps * spacingOfNumbersNearTheBound - bound);
  }
  return values;
}

function neighboursOfHalfAMillionth() {
  const values = [];
  for (let steps = -1000; steps <= 1000; steps += 1) {
    const neighbour = halfAMillionth + steps * spacingOfNumbersNearHalfAMillionth;
    values.push(neighbour, -neighbour);
  }
  return values;
}

const sweepValues = (bound, random) => [
  ...uniformValues(bound, random),
  ...dyadicValues(bound, random),
  ...halfwayValues(bound, random),
  ...decimalsJustBelowTheBound(bound),
  ...neighboursOfTheBound(bound),
  ...neighboursOfHalfAMillionth(),
];

const sweep = sweepValues(largestQuantisable, seededUnitInterval(sweepSeed));
const firstFailures = (values, fails) => values.filter(fails).slice(0, 5);
const breaksTheRoundTrip = (value) => quantise(roundToMillionths(value)) !== quantise(value);
const differsFromHalfUp = (value) => {
  const scaled = value * millionthsPerOne;
  return Math.round(scaled) !== Math.floor(scaled + 0.5);
};
const breaksTheExactDifference = (value, index, values) => {
  const other = values[(index + 1) % values.length];
  return BigInt(quantise(value) - quantise(other)) !== BigInt(quantise(value)) - BigInt(quantise(other));
};

test('plain subtraction puts a run exactly on its tolerance beyond it; the quantised difference does not', () => {
  assert.equal(0.92 - 0.9, 0.020000000000000018);
  assert.equal(0.92 - 0.9 > 0.02, true);
  assert.equal(quantise(0.92) - quantise(0.9), 20000);
  assert.equal(quantise(0.02), 20000);
  assert.equal(quantise(0.92) - quantise(0.9) > quantise(0.02), false);
});

test('quantise rounds to millionths and keeps the sign', () => {
  assert.equal(quantise(0.900001), 900001);
  assert.equal(quantise(0.899999), 899999);
  assert.equal(quantise(1), 1000000);
  assert.equal(quantise(0), 0);
  assert.equal(quantise(-0.25), -250000);
  assert.equal(quantise(0.0000004), 0);
  assert.equal(quantise(0.0000006), 1);
  assert.equal(quantise(2.5), 2500000);
});

test('formatQuantised prints millionths with trailing zeros removed', () => {
  const table = [
    [250000, '0.25'],
    [1000000, '1'],
    [0, '0'],
    [20001, '0.020001'],
    [1, '0.000001'],
    [-250000, '-0.25'],
    [920000, '0.92'],
    [1234567890, '1234.56789'],
    [3000000, '3'],
    [-1, '-0.000001'],
  ];
  for (const [micro, text] of table) {
    assert.equal(formatQuantised(micro), text, `formatQuantised(${micro})`);
  }
});

test('formatQuantised round-trips every value quantise produces from a short decimal', () => {
  for (const text of ['0', '0.5', '0.75', '0.92', '0.899999', '0.020001', '1', '12.5', '0.000001']) {
    assert.equal(formatQuantised(quantise(Number(text))), text);
  }
});

test('formatQuantised prints the ends of the range and the largest possible drop without losing a millionth', () => {
  assert.equal(formatQuantised(quantise(largestQuantisable)), '4000000000');
  assert.equal(formatQuantised(quantise(-largestQuantisable)), '-4000000000');
  assert.equal(formatQuantised(quantise(3999999999.999999)), '3999999999.999999');
  assert.equal(formatQuantised(quantise(largestQuantisable) - quantise(-largestQuantisable)), '8000000000');
});

test('isQuantisable accepts finite numbers whose millionths are exact integers and refuses the rest', () => {
  assert.equal(isQuantisable(0), true);
  assert.equal(isQuantisable(1), true);
  assert.equal(isQuantisable(-1), true);
  assert.equal(isQuantisable(4_000_000_000), true);
  assert.equal(isQuantisable(-4_000_000_000), true);
  assert.equal(isQuantisable(3999999999.999999), true);
  assert.equal(isQuantisable(4000000000.000001), false);
  assert.equal(isQuantisable(-4000000000.000001), false);
  assert.equal(isQuantisable(4_000_000_001), false);
  assert.equal(isQuantisable(4_100_000_000), false);
  assert.equal(isQuantisable(9_000_000_000), false);
  assert.equal(isQuantisable(1e21), false);
  assert.equal(isQuantisable(Number.POSITIVE_INFINITY), false);
  assert.equal(isQuantisable(Number.NaN), false);
  assert.equal(isQuantisable('1'), false);
  assert.equal(isQuantisable(null), false);
});

test('the largest quantisable magnitude is 4000000000, so its millionths, 4e15, stay below 2^52', () => {
  assert.equal(largestQuantisable, 4000000000);
  assert.equal(largestQuantisable * millionthsPerOne, 4e15);
  assert.equal(largestQuantisable * millionthsPerOne < 2 ** 52, true);
});

test('the quantised values at the two ends of the range are exact integers below 2^52, and their difference, 8e15, is exact below 2^53', () => {
  const top = quantise(largestQuantisable);
  const bottom = quantise(-largestQuantisable);
  assert.equal(top, 4e15);
  assert.equal(bottom, -4e15);
  assert.equal(top - bottom, 8e15);
  assert.equal(top - bottom < 2 ** 53, true);
  for (const integer of [top, bottom, top - bottom]) {
    assert.equal(Number.isSafeInteger(integer), true, String(integer));
  }
});

test('the sweep over the range holds at least 200000 values, every one of them quantisable', () => {
  assert.equal(sweep.length >= 200000, true);
  assert.equal(sweep.every(isQuantisable), true);
});

test('quantise(roundToMillionths(x)) equals quantise(x) for every x within the largest quantisable magnitude', () => {
  assert.deepEqual(firstFailures(sweep, breaksTheRoundTrip), []);
});

test('Math.round(y) equals Math.floor(y + 0.5) for every y that x times 1000000 gives within the largest quantisable magnitude', () => {
  assert.deepEqual(firstFailures(sweep, differsFromHalfUp), []);
});

test('the difference of the quantised values of any two x within the largest quantisable magnitude is an exact integer', () => {
  assert.deepEqual(firstFailures(sweep, breaksTheExactDifference), []);
});

test('the same sweep over the former range, 9000000000, breaks the round trip, half-up rounding and exact differences, so it can fail', () => {
  const former = sweepValues(formerLargestQuantisable, seededUnitInterval(sweepSeed));
  for (const breaks of [breaksTheRoundTrip, differsFromHalfUp, breaksTheExactDifference]) {
    assert.equal(firstFailures(former, breaks).length > 0, true, breaks.name);
  }
});

test('count puts the noun in the singular only for one', () => {
  assert.equal(count(1, 'sample'), '1 sample');
  assert.equal(count(0, 'case'), '0 cases');
  assert.equal(count(4, 'finding'), '4 findings');
  assert.equal(count(2, 'day'), '2 days');
});

test('roundToMillionths keeps six decimals and removes float noise', () => {
  assert.equal(roundToMillionths(0.8333333333), 0.833333);
  assert.equal(roundToMillionths(0.9375), 0.9375);
  assert.equal(roundToMillionths(0.1 + 0.2), 0.3);
  assert.equal(roundToMillionths(1), 1);
  assert.equal(roundToMillionths(-0.0000004), 0);
  assert.equal(roundToMillionths(0.2 / 3), 0.066667);
});

test('listKeys joins at most ten keys with a comma and says how many were left out', () => {
  const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'];
  assert.equal(listKeys(['only']), '"only"');
  assert.equal(listKeys(keys.slice(0, 3)), '"a", "b", "c"');
  assert.equal(listKeys(keys.slice(0, 10)), '"a", "b", "c", "d", "e", "f", "g", "h", "i", "j"');
  assert.equal(listKeys(keys.slice(0, 11)), '"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", and 1 more');
  assert.equal(listKeys(keys), '"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", and 3 more');
});
