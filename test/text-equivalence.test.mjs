import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare } from '../src/compare.mjs';
import { describeFinding, describeNote } from '../src/describe.mjs';
import { quantise } from '../src/quantise.mjs';
import { generateComparisons } from './support/generated-comparisons.mjs';
import { legacyCommandLines, legacyCompare, legacyFindingLine } from './support/legacy-compose.mjs';
import { variantOf } from './support/model.mjs';

const seed = 20261115;
const total = 6000;
const corpus = generateComparisons(seed, total);

function disagreements(comparisons, findingLine, noteSentence) {
  const found = [];
  for (const { baseline, run } of comparisons) {
    const before = legacyCompare(baseline, run);
    const after = compare(baseline, run);
    const beforePrinted = [before.findings.map(legacyFindingLine), before.notes];
    const afterPrinted = [after.findings.map(findingLine), after.notes.map(noteSentence)];
    if (JSON.stringify(beforePrinted) !== JSON.stringify(afterPrinted)) {
      found.push({ baseline, run, beforePrinted, afterPrinted });
    }
  }
  return found;
}

test(`over ${total} generated comparisons the findings and the notes print the lines they printed before the model, in the same order`, () => {
  assert.deepEqual(disagreements(corpus, describeFinding, describeNote).slice(0, 1), []);
});

test('the generated comparisons are the same ones every time, so a disagreement can be reproduced from the seed', () => {
  assert.deepEqual(generateComparisons(seed, 25), corpus.slice(0, 25));
  assert.notDeepEqual(generateComparisons(seed + 1, 25), corpus.slice(0, 25));
});

function tallyOf(comparisons) {
  const tally = new Map();
  const bump = (name) => tally.set(name, (tally.get(name) ?? 0) + 1);
  for (const { baseline, run } of comparisons) {
    const { findings, notes } = compare(baseline, run);
    for (const record of [...findings, ...notes]) {
      bump(variantOf(record));
      if (record.kind === 'metrics-only-in-run' && record.keys.length > 10) {
        bump('metrics-only-in-run with more than ten keys');
      }
      if (record.id === 'below-baseline' && record.baseline.tolerance === 0) {
        bump(record.drop < 8400 ? 'a fall inside the noise at a tolerance of 0' : 'a fall beyond the noise at a tolerance of 0');
      }
    }
    for (const expected of baseline.metrics) {
      const actual = run.metrics.find((metric) => metric.key === expected.key);
      if (actual !== undefined) {
        const margin = quantise(expected.tolerance) - (quantise(expected.value) - quantise(actual.value));
        if (margin === 0 || margin === -1) {
          bump(margin === 0 ? 'a drop exactly the tolerance' : 'a drop one millionth beyond the tolerance');
        }
      }
    }
  }
  return tally;
}

test('the generated comparisons reach every variant that a comparison can produce, and both sides of the tolerance boundary, many times, so agreement is not an empty result', () => {
  const tally = tallyOf(corpus);
  const reachable = [
    'missing-metric',
    'unreadable-metric',
    'below-baseline',
    'sample-count',
    'cases-changed',
    'bad-run/other-tool',
    'metrics-only-in-run',
    'metrics-only-in-run with more than ten keys',
    'more-samples',
    'run-error',
    'refused-metric',
    'tool-version-changed',
    'a drop exactly the tolerance',
    'a drop one millionth beyond the tolerance',
    'a fall inside the noise at a tolerance of 0',
    'a fall beyond the noise at a tolerance of 0',
  ];
  assert.deepEqual([...tally.keys()].sort(), [...reachable].sort());
  for (const reached of reachable) {
    assert.equal(tally.get(reached) >= 100, true, `${reached} was reached ${tally.get(reached)} times`);
  }
});

const saboteurs = {
  'a line that loses its quotes': [(finding) => describeFinding(finding).replaceAll('"', ''), describeNote],
  'a line that loses a plural': [(finding) => describeFinding(finding).replaceAll('samples', 'sample'), describeNote],
  'a line that loses its id': [(finding) => describeFinding(finding).slice(finding.id.length), describeNote],
  'a note that loses its rule number': [describeFinding, (note) => describeNote(note).replace('(rule 3)', '(rule 2)')],
  'a note that loses its quotes': [describeFinding, (note) => describeNote(note).replaceAll('"', '')],
};

for (const [name, [findingLine, noteSentence]] of Object.entries(saboteurs)) {
  test(`the check can fail: ${name} is reported against the same comparisons`, () => {
    assert.notDeepEqual(disagreements(corpus, findingLine, noteSentence).slice(0, 1), []);
  });
}

const names = ['run.json', 'p"\\.json', 'a\nb.json', '', '::x', 'tag\u{e0069}', '##[x', '\u202e', 'a\u0085b'];
const codes = ['ENOENT', 'EISDIR', 'EACCES', 'EMFILE'];

test('the findings that the command builds print the lines they printed before the model, for every pair of hostile names and every code', () => {
  let compared = 0;
  for (const file of names) {
    for (const problem of names) {
      for (const failure of codes) {
        const facts = { file, failure, problem, message: problem };
        const records = {
          'no-baseline': { id: 'no-baseline', file },
          'bad-baseline/cannot-read': { id: 'bad-baseline', file, cause: 'cannot-read', failure },
          'bad-baseline/refused': { id: 'bad-baseline', file, cause: 'refused', problem },
          'bad-run/cannot-read': { id: 'bad-run', file, cause: 'cannot-read', failure },
          'bad-run/refused': { id: 'bad-run', file, cause: 'refused', problem },
          'internal-error': { id: 'internal-error', message: problem },
        };
        for (const [variant, record] of Object.entries(records)) {
          assert.equal(describeFinding(record), legacyCommandLines[variant](facts), `${variant} ${JSON.stringify(facts)}`);
          compared += 1;
        }
      }
    }
  }
  assert.equal(compared, names.length * names.length * codes.length * 6);
});
