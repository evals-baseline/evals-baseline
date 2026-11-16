import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { compare } from '../src/compare.mjs';
import { describeFinding } from '../src/describe.mjs';
import { accuracy, baselineMetric, makeBaseline, makeRun, runMetric } from './support/compare-fixtures.mjs';
import { makeScratch, plantMutation } from './support/mutate.mjs';

const smallestMeasuredNoiseFloor = 8400;

const fall = (tolerance, drop, samples = 150) => ({
  id: 'below-baseline',
  key: accuracy,
  baseline: { value: 1000000, samples, tolerance },
  run: { value: 1000000 - drop, samples },
  drop,
});

const unsetToleranceLine = (run, drop) =>
  `below-baseline "agent :: accuracy": ${run} over 150 samples is below the baseline 1 over 150 samples by ${drop}. ` +
  'The tolerance is 0, so every fall is reported, and a fall this small is one that two runs of unchanged code can show. ' +
  'The tolerance is probably unset; the model is probably not worse. ' +
  'Rerun the suite with nothing changed, see how far each metric moves, and set this tolerance in the baseline to match ' +
  '(see the README section on setting tolerances from your own noise). ' +
  'If 0 is on purpose, treat this as a real fall.';

const exceededLine = (run, drop, tolerance) =>
  `below-baseline "agent :: accuracy": ${run} over 150 samples is below the baseline 1 over 150 samples by ${drop}, more than the tolerance ${tolerance}`;

test('a fall of 0.005 at a tolerance of 0 says the tolerance is unset, and what to do', () => {
  assert.equal(describeFinding(fall(0, 5000)), unsetToleranceLine('0.995', '0.005'));
});

test('the line keeps its id and key and still has the sample counts and the drop', () => {
  const line = describeFinding(fall(0, 1));
  assert.equal(line.startsWith('below-baseline "agent :: accuracy": 0.999999 over 150 samples is below the baseline 1 over 150 samples by 0.000001. '), true);
});

test('the boundary is the smallest measured floor: one millionth under it says unset, the floor itself prints the plain line', () => {
  assert.equal(describeFinding(fall(0, smallestMeasuredNoiseFloor - 1)), unsetToleranceLine('0.991601', '0.008399'));
  assert.equal(describeFinding(fall(0, smallestMeasuredNoiseFloor)), exceededLine('0.9916', '0.0084', '0'));
});

test('a fall well above every measured floor prints the plain line, so a real fall is never called noise', () => {
  assert.equal(describeFinding(fall(0, 250000)), exceededLine('0.75', '0.25', '0'));
});

test('a tolerance that someone set is never called unset, however small the fall', () => {
  assert.equal(describeFinding(fall(1, 2)), exceededLine('0.999998', '0.000002', '0.000001'));
  assert.equal(describeFinding(fall(5000, 5001)), exceededLine('0.994999', '0.005001', '0.005'));
});

test('only below-baseline findings carry the sentence', () => {
  const sample = { id: 'sample-count', key: accuracy, baseline: { samples: 4 }, run: { samples: 3 } };
  assert.equal(describeFinding(sample), 'sample-count "agent :: accuracy": the baseline holds 4 samples and this run holds 3');
});

test('end to end: compare a baseline with tolerance 0 against a run one sample lower, and the printed line says unset', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1, 150, 0)]);
  const { findings } = compare(baseline, makeRun([runMetric(accuracy, 149 / 150, 150)]));
  assert.equal(findings.length, 1);
  assert.equal(describeFinding(findings[0]).includes('The tolerance is probably unset; the model is probably not worse.'), true);
});

test('end to end: a one-sample fall over 4 samples is 0.25, far above the floor, so the plain line is printed', () => {
  const baseline = makeBaseline([baselineMetric(accuracy, 1, 4, 0)]);
  const { findings } = compare(baseline, makeRun([runMetric(accuracy, 0.75, 4)]));
  assert.equal(describeFinding(findings[0]).includes('probably unset'), false);
});

const probes = [fall(0, 1), fall(0, smallestMeasuredNoiseFloor - 1), fall(0, smallestMeasuredNoiseFloor), fall(0, 250000), fall(1, 2), fall(5000, 5001)];
const printedBy = (compose) => probes.map(compose);

const plantedGuards = {
  'the boundary widened to include the floor': ['drop < smallestMeasuredNoiseFloor', 'drop <= smallestMeasuredNoiseFloor'],
  'the floor raised to the largest measured three sigma': ['quantise(0.0084)', 'quantise(0.033)'],
  'the tolerance condition removed': ["baseline.tolerance === 0 && ", ''],
  'the tolerance condition loosened to any set tolerance': ['baseline.tolerance === 0', 'baseline.tolerance >= 0'],
  'the size condition removed': [' && drop < smallestMeasuredNoiseFloor', ''],
  'the sentence swapped for the plain one': ["'below-baseline-inside-noise' : finding.id", 'finding.id : finding.id'],
};

const scratch = makeScratch();
after(() => rmSync(scratch, { recursive: true, force: true }));

for (const [name, edit] of Object.entries(plantedGuards)) {
  test(`the guard can fail: ${name} changes what is printed for the probes`, async () => {
    const directory = plantMutation(scratch, { id: name.replaceAll(' ', '-'), module: 'describe', edits: [edit] });
    const planted = await import(pathToFileURL(join(directory, 'describe.mjs')).href);
    assert.notDeepEqual(printedBy(planted.describeFinding), printedBy(describeFinding));
  });
}
