import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { cli } from '../../src/command.mjs';
import { promptfooFile, promptfooIo } from '../support/command.mjs';
import { makeIo } from '../support/io.mjs';
import { ROOT } from './support.mjs';

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

const withoutDate = (lines) => lines.filter((line) => !line.startsWith('date: '));

const baselineHolding = (tolerance) => {
  const baseline = JSON.parse(promptfooFile('evals-baseline.json'));
  for (const metric of Object.values(baseline.metrics)) {
    metric.tolerance = tolerance;
  }
  return JSON.stringify(baseline, null, 2);
};

const freshPath = () => makeIo({ 'run-good.json': promptfooFile('run-good.json') });

const printed = {
  'the report of a run that fell': withoutDate(cli(['check', 'run-worse.json', '--strict'], promptfooIo('run-worse.json')).stdout),
  'the first record': cli(['record', 'run-good.json', '--tolerance', '0'], freshPath()).stdout,
  'the refusal of a record that gives no tolerance': cli(['record', 'run-good.json'], freshPath()).stdout,
  'the refusal of a tolerance that would change a held one': cli(
    ['record', 'run-good.json', '--tolerance', '0.05'],
    promptfooIo('run-good.json', { 'evals-baseline.json': baselineHolding(0.3) }),
  ).stdout,
  'the note of a run with more samples than the baseline': cli(
    ['check', 'planted/run-more-samples.json'],
    promptfooIo('planted/run-more-samples.json'),
  ).stdout.filter((line) => line.startsWith('note: "agent :: accuracy"')),
};

const notShown = (text) =>
  Object.entries(printed).flatMap(([what, lines]) => lines.filter((line) => !text.includes(line)).map((line) => `${what}: ${line}`));

const planted = (from, to) => {
  assert.equal(readme.split(from).length - 1, 1, `${JSON.stringify(from)} must occur once in the README, or the specimen plants nothing`);
  return readme.replace(from, to);
};

test('every transcript that the README shows of the report, of record and of its refusals is what the tool prints', () => {
  assert.deepEqual(Object.values(printed).map((lines) => lines.length), [3, 1, 1, 3, 1]);
  assert.deepEqual(notShown(readme), []);
});

for (const [name, from, to] of [
  [
    'the report of a run that fell, as it was written before the sample counts were printed',
    'below-baseline "agent :: accuracy": 0.75 over 4 samples is below the baseline 1 over 4 samples by',
    'below-baseline "agent :: accuracy": 0.75 is below the baseline 1 by',
  ],
  [
    'a refusal that counts three metrics where the run has two',
    'record: refused: no tolerance was given for 2 metrics',
    'record: refused: no tolerance was given for 3 metrics',
  ],
  [
    'a held tolerance of 0.2 where the baseline holds 0.3',
    'note: "agent :: format": the baseline holds the tolerance 0.3',
    'note: "agent :: format": the baseline holds the tolerance 0.2',
  ],
  [
    'a rise in samples that the note calls a finding',
    'more samples than the baseline are never a finding`',
    'more samples than the baseline are a finding`',
  ],
]) {
  test(`goes red on a README that shows ${name}`, () => {
    assert.equal(notShown(planted(from, to)).length, 1);
  });
}
