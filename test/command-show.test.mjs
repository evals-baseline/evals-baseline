import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { assertSafeOutput, banner, deepevalFile, erroredNote, hostilePrinted, hostileText, inversionReason, plantedNames, promptfooFile, quoted, runErroringMetric, runOfMetric, runRefusingMetric } from './support/command.mjs';
import { deepevalDigest, promptfooDigest } from './support/digests.mjs';
import { editedFixture } from './support/fixtures.mjs';
import { makeIo } from './support/io.mjs';

test('show prints what the reader made of a promptfoo run', () => {
  const output = cli(['show', 'run-good.json'], makeIo({ 'run-good.json': promptfooFile('run-good.json') }));
  assert.deepEqual(output, {
    stdout: [
      `${banner} show "run-good.json": promptfoo "0.125.1" (promptfoo-results-3), 2 metrics, 4 cases (digest ${promptfooDigest})`,
      'metric "agent :: accuracy"  1  4 samples',
      'metric "agent :: format"  1  4 samples',
    ],
    stderr: [],
    code: 0,
    findings: [],
    failing: [],
  });
});

test('show of the lower-is-better DeepEval run prints the note of Appendix B and exits 0', () => {
  const output = cli(['show', 'run-inverted.json'], makeIo({ 'run-inverted.json': deepevalFile('run-inverted.json') }));
  assert.deepEqual(output.stdout, [
    `${banner} show "run-inverted.json": deepeval version unknown (deepeval-test-run), 2 metrics, 4 cases (digest ${deepevalDigest})`,
    'metric "Accuracy"  1  4 samples',
    'metric "Format"  1  4 samples',
    `note: "Failure rate" cannot be read: ${inversionReason}`,
  ]);
  assert.equal(output.code, 0);
});

test('show of a run with errored samples prints them as notes and exits 0, because it refuses nothing', () => {
  const output = cli(['show', 'run-error-one.json'], makeIo({ 'run-error-one.json': promptfooFile('run-error-one.json') }));
  assert.equal(output.stdout.at(-1), 'note: "agent": 1 errored test(s) in this run (promptfoo testErrorCount)');
  assert.equal(output.code, 0);
});

test('show of a promptfoo run with no named metric says what to add', () => {
  const output = cli(['show', 'run-unnamed.json'], makeIo({ 'run-unnamed.json': promptfooFile('run-unnamed.json') }));
  assert.deepEqual(output.stdout.slice(1), ['note: no named metric in this run; add "metric: <name>" to the assertions you want guarded']);
});

test('show of a run it cannot read is refused with exit 3 and the reader reason', () => {
  const output = cli(['show', 'wrapped.json'], makeIo({ 'wrapped.json': deepevalFile('wrapped.json') }));
  assert.deepEqual(output, {
    stdout: [`${banner} show: refused: "wrapped.json": this is DeepEval .latest_test_run.json, which wraps the run in testRunData; read .latest_run_full.json or a test_run_*.json file`],
    stderr: [],
    code: 3,
    findings: [],
    failing: [],
  });
  assert.deepEqual(cli(['show', 'missing.json'], makeIo()).stdout, [`${banner} show: refused: cannot read "missing.json": not found`]);
  assert.equal(cli(['show', 'missing.json'], makeIo()).code, 3);
});

test('show reads no baseline and writes nothing', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  cli(['show', 'run-good.json'], io);
  assert.deepEqual(io.writes, []);
});

for (const { label, name, printed } of plantedNames) {
  test(`show prints ${label}, used as a metric name, escaped after the word metric and in the notes of a refused and of an errored metric`, () => {
    const named = cli(['show', 'run.json'], makeIo({ 'run.json': runOfMetric(name) }));
    assert.deepEqual(named, {
      stdout: [
        `${banner} show "run.json": deepeval version unknown (deepeval-test-run), 1 metric, 4 cases (digest ${deepevalDigest})`,
        `metric ${quoted(printed)}  1  4 samples`,
      ],
      stderr: [],
      code: 0,
      findings: [],
      failing: [],
    });
    const refused = cli(['show', 'run.json'], makeIo({ 'run.json': runRefusingMetric(name) }));
    assert.deepEqual(refused.stdout, [
      `${banner} show "run.json": deepeval version unknown (deepeval-test-run), 2 metrics, 4 cases (digest ${deepevalDigest})`,
      'metric "Accuracy"  1  4 samples',
      'metric "Format"  1  4 samples',
      `note: ${quoted(printed)} cannot be read: ${inversionReason}`,
    ]);
    const errored = cli(['show', 'run.json'], makeIo({ 'run.json': runErroringMetric(name) }));
    assert.deepEqual(errored.stdout.slice(1), [`metric ${quoted(printed)}  1  3 samples`, `note: ${erroredNote(printed)}`]);
    for (const output of [named, refused, errored]) {
      assertSafeOutput(output, label);
    }
  });
}

test('show of a promptfoo run whose provider label begins with :: prints each metric line after the word metric', () => {
  const run = editedFixture('promptfoo', 'run-good.json', (document) => {
    document.results.prompts[0].provider = '::add-mask::Capital';
  });
  const output = cli(['show', 'run.json'], makeIo({ 'run.json': run }));
  assert.deepEqual(output.stdout.slice(1), ['metric "::add-mask::Capital :: accuracy"  1  4 samples', 'metric "::add-mask::Capital :: format"  1  4 samples']);
  assertSafeOutput(output);
});

const readRunLines = (path) => [
  `${banner} show ${path}: promptfoo "0.125.1" (promptfoo-results-3), 2 metrics, 4 cases (digest ${promptfooDigest})`,
  'metric "agent :: accuracy"  1  4 samples',
  'metric "agent :: format"  1  4 samples',
];

const hostileSlots = [
  ['the path of a run that is not there', ['show', hostileText], {}, 3, [`${banner} show: refused: cannot read ${quoted(hostilePrinted)}: not found`]],
  ['the path of a run that is not JSON', ['show', hostileText], { [hostileText]: 'not json' }, 3, [`${banner} show: refused: ${quoted(hostilePrinted)}: not JSON`]],
  ['the path of a run that is read', ['show', hostileText], { [hostileText]: promptfooFile('run-good.json') }, 0, readRunLines(quoted(hostilePrinted))],
  [
    'the tool version of the run',
    ['show', 'run.json'],
    {
      'run.json': editedFixture('promptfoo', 'run-good.json', (run) => {
        run.metadata.promptfooVersion = hostileText;
      }),
    },
    0,
    [
      `${banner} show "run.json": promptfoo ${quoted(hostilePrinted)} (promptfoo-results-3), 2 metrics, 4 cases (digest ${promptfooDigest})`,
      'metric "agent :: accuracy"  1  4 samples',
      'metric "agent :: format"  1  4 samples',
    ],
  ],
  ['the message of an exception', ['show', 'run.json'], { 'run.json': new TypeError(hostileText) }, 3, [`${banner} show: refused: internal-error: ${quoted(hostilePrinted)}`]],
];

for (const [slot, argv, files, code, stdout] of hostileSlots) {
  test(`show prints hostile text in ${slot} escaped, and starts every line with a fixed word`, () => {
    const output = cli(argv, makeIo(files));
    assert.deepEqual(output, { stdout, stderr: [], code, findings: [], failing: [] });
    assertSafeOutput(output, slot);
  });
}

test('show prints hostile text in a provider label escaped in the metric lines and in the note about an errored test', () => {
  const run = editedFixture('promptfoo', 'run-error-one.json', (document) => {
    document.results.prompts[0].provider = hostileText;
  });
  const output = cli(['show', 'run.json'], makeIo({ 'run.json': run }));
  assert.equal(output.stdout.at(-1), `note: ${quoted(hostilePrinted)}: 1 errored test(s) in this run (promptfoo testErrorCount)`);
  const metricLines = output.stdout.slice(1, -1);
  assert.equal(metricLines.length, 2);
  assert.equal(metricLines.every((line) => line.startsWith(`metric "${hostilePrinted} :: `)), true);
  assertSafeOutput(output);
});

test('show of a run the reader refuses prints the hostile metric name inside the reader reason escaped, after the path as printed', () => {
  const run = editedFixture('promptfoo', 'run-good.json', (document) => {
    document.results.prompts[0].metrics.namedScoresCount[hostileText] = 'four';
  });
  const output = cli(['show', 'run.json'], makeIo({ 'run.json': run }));
  assert.equal(output.stdout.length, 1);
  assert.equal(output.stdout[0].startsWith(`${banner} show: refused: "run.json": `), true);
  assert.equal(output.stdout[0].includes(hostilePrinted), true);
  assert.equal(output.code, 3);
  assertSafeOutput(output);
});
