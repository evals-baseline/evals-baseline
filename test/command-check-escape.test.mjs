import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import {
  assertSafeOutput,
  banner,
  baselineWithMetric,
  dateLine,
  deepevalFile,
  deepevalIo,
  deHeader,
  hostilePrinted,
  hostileText,
  inversionReason,
  pfHeader,
  plantedNames,
  promptfooFile,
  promptfooIo,
  quoted,
  runRefusingMetric,
  runWithMetric,
  splitLikePython,
  warningSummary,
} from './support/command.mjs';
import { editedFixture } from './support/fixtures.mjs';
import { failure, makeIo } from './support/io.mjs';

const forgedKey = 'Accuracy\u2028below-baseline Format: 0 is below the baseline 1 by 1, more than the tolerance 0\u2028';

test('a baseline metric named like a finding forges nothing: its U+2028 is printed as an escape, and a reader that splits lines like Python finds no below-baseline line', () => {
  const output = cli(['check', 'run-good.json'], deepevalIo('run-good.json', { 'evals-baseline.json': baselineWithMetric(forgedKey) }));
  const finding =
    'missing-metric "Accuracy\\u2028below-baseline Format: 0 is below the baseline 1 by 1, more than the tolerance 0\\u2028": the baseline names it (1 over 4 samples) and this run has no such metric';
  assert.deepEqual(output.stdout, [`${banner} check "evals-baseline.json": deepeval version unknown, 3 metrics, 4 cases`, dateLine, finding, warningSummary(1)]);
  assert.deepEqual(output.findings, [finding]);
  const seen = splitLikePython(output.stdout.map((line) => `${line}\n`).join(''));
  assert.deepEqual(seen, output.stdout);
  assert.equal(seen.some((line) => line.startsWith('below-baseline Format')), false);
  assertSafeOutput(output);
});

for (const { label, name, printed } of plantedNames) {
  test(`check prints ${label}, used as a metric name, escaped in every finding and note`, () => {
    const threeMetrics = `${banner} check "evals-baseline.json": deepeval version unknown, 3 metrics, 4 cases`;
    const scenarios = [
      [
        'a baseline metric the run lacks',
        'run-good.json',
        { 'evals-baseline.json': baselineWithMetric(name) },
        [threeMetrics, dateLine, `missing-metric ${quoted(printed)}: the baseline names it (1 over 4 samples) and this run has no such metric`, warningSummary(1)],
      ],
      [
        'a metric that fell below its baseline and changed its sample count',
        'run-good.json',
        { 'evals-baseline.json': baselineWithMetric(name, 5), 'run-good.json': runWithMetric(name, 0.5) },
        [
          threeMetrics,
          dateLine,
          `below-baseline ${quoted(printed)}: 0.5 over 4 samples is below the baseline 1 over 5 samples by 0.5, more than the tolerance 0`,
          `sample-count ${quoted(printed)}: the baseline holds 5 samples and this run holds 4`,
          warningSummary(2),
        ],
      ],
      [
        'a metric only the run has',
        'run-good.json',
        { 'run-good.json': runWithMetric(name) },
        [deHeader, dateLine, `note: 1 metric(s) only in this run, not compared (rule 3): ${quoted(printed)}`, 'evals-baseline: no findings'],
      ],
      [
        'a refused metric the baseline names',
        'run-inverted.json',
        { 'evals-baseline.json': baselineWithMetric(name), 'run-inverted.json': runRefusingMetric(name) },
        [threeMetrics, dateLine, `unreadable-metric ${quoted(printed)}: ${inversionReason}`, warningSummary(1, 3)],
      ],
      [
        'a refused metric the baseline does not name',
        'run-inverted.json',
        { 'run-inverted.json': runRefusingMetric(name) },
        [deHeader, dateLine, `note: ${quoted(printed)} cannot be read: ${inversionReason}`, 'evals-baseline: no findings'],
      ],
    ];
    for (const [scenario, runFile, files, expected] of scenarios) {
      const output = cli(['check', runFile], deepevalIo(runFile, files));
      assert.deepEqual(output.stdout, expected, scenario);
      assert.equal(output.code, 0, scenario);
      assertSafeOutput(output, scenario);
    }
  });
}

const missingFinding = (key) => `missing-metric ${quoted(key)}: the baseline names it (1 over 4 samples) and this run has no such metric`;

const hostileSlots = [
  [
    'the baseline path of a file that is not there',
    ['check', 'run-good.json', '--baseline', hostileText],
    { 'run-good.json': deepevalFile('run-good.json') },
    [
      `${banner} check ${quoted(hostilePrinted)}`,
      `no-baseline: no baseline at ${quoted(hostilePrinted)}; nothing was compared; record one with: evals-baseline record <run-file>`,
      warningSummary(1, 3),
    ],
  ],
  [
    'the baseline path and the error code of a file that cannot be opened',
    ['check', 'run-good.json', '--baseline', hostileText],
    { [hostileText]: failure(hostileText), 'run-good.json': deepevalFile('run-good.json') },
    [`${banner} check ${quoted(hostilePrinted)}`, `bad-baseline: cannot read ${quoted(hostilePrinted)}: ${hostilePrinted}`, warningSummary(1, 3)],
  ],
  [
    'the run path of a file that is not there',
    ['check', hostileText],
    { 'evals-baseline.json': deepevalFile('evals-baseline.json') },
    [deHeader, dateLine, `bad-run: cannot read ${quoted(hostilePrinted)}: not found`, warningSummary(1, 3)],
  ],
  [
    'the run path of a file that is not JSON',
    ['check', hostileText],
    { 'evals-baseline.json': deepevalFile('evals-baseline.json'), [hostileText]: 'not json' },
    [deHeader, dateLine, `bad-run: ${quoted(hostilePrinted)}: not JSON`, warningSummary(1, 3)],
  ],
  [
    'the tool version of the baseline',
    ['check', 'run-good.json'],
    {
      'evals-baseline.json': editedFixture('promptfoo', 'evals-baseline.json', (baseline) => {
        baseline.source.toolVersion = hostileText;
      }),
      'run-good.json': promptfooFile('run-good.json'),
    },
    [
      `${banner} check "evals-baseline.json": promptfoo ${quoted(hostilePrinted)}, 2 metrics, 4 cases`,
      dateLine,
      `note: the baseline was recorded by promptfoo ${quoted(hostilePrinted)}; this run was written by "0.125.1"`,
      'evals-baseline: no findings',
    ],
  ],
  [
    'the tool version of the run',
    ['check', 'run-good.json'],
    {
      'evals-baseline.json': promptfooFile('evals-baseline.json'),
      'run-good.json': editedFixture('promptfoo', 'run-good.json', (run) => {
        run.metadata.promptfooVersion = hostileText;
      }),
    },
    [pfHeader, dateLine, `note: the baseline was recorded by promptfoo "0.125.1"; this run was written by ${quoted(hostilePrinted)}`, 'evals-baseline: no findings'],
  ],
  [
    'the provider label of the run',
    ['check', 'run-good.json'],
    {
      'evals-baseline.json': promptfooFile('evals-baseline.json'),
      'run-good.json': editedFixture('promptfoo', 'run-good.json', (run) => {
        run.results.prompts[0].provider = hostileText;
      }),
    },
    [
      pfHeader,
      dateLine,
      missingFinding('agent :: accuracy'),
      missingFinding('agent :: format'),
      `note: 2 metric(s) only in this run, not compared (rule 3): ${quoted(`${hostilePrinted} :: accuracy`)}, ${quoted(`${hostilePrinted} :: format`)}`,
      warningSummary(2),
    ],
  ],
  [
    'the message of an exception',
    ['check', 'run-good.json'],
    { 'evals-baseline.json': promptfooFile('evals-baseline.json'), 'run-good.json': new TypeError(hostileText) },
    [pfHeader, dateLine, `internal-error: ${quoted(hostilePrinted)}`, warningSummary(1, 3)],
  ],
];

for (const [slot, argv, files, stdout] of hostileSlots) {
  test(`check prints hostile text in ${slot} escaped, and starts every line with a fixed word`, () => {
    const output = cli(argv, makeIo(files));
    assert.deepEqual(output.stdout, stdout);
    assert.equal(output.code, 0);
    assertSafeOutput(output, slot);
  });
}

test('a hostile key in a baseline the reader refuses is printed escaped inside the reader reason, after the path as printed', () => {
  const baseline = JSON.stringify({ spec: '1.0', [hostileText]: 1 });
  const output = cli(['check', 'run-good.json', '--baseline', hostileText], makeIo({ [hostileText]: baseline, 'run-good.json': deepevalFile('run-good.json') }));
  assert.equal(output.stdout.length, 3);
  assert.equal(output.stdout[1].startsWith(`bad-baseline: ${quoted(hostilePrinted)}: `), true);
  assert.equal(output.stdout[1].includes(`unknown key ${quoted(hostilePrinted)} in `), true);
  assertSafeOutput(output);
});

test('a hostile metric name inside the path of a reader reason for a run is printed escaped', () => {
  const run = editedFixture('promptfoo', 'run-good.json', (document) => {
    document.results.prompts[0].metrics.namedScoresCount[hostileText] = 'four';
  });
  const output = cli(['check', 'run-good.json'], promptfooIo('run-good.json', { 'run-good.json': run }));
  assert.equal(output.stdout[2].startsWith('bad-run: "run-good.json": '), true);
  assert.equal(output.stdout[2].includes(quoted(hostilePrinted)), true);
  assertSafeOutput(output);
});
