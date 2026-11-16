import {
  banner,
  baselineWithMetrics,
  below,
  casesChanged,
  check,
  command,
  deepevalErrored,
  directory,
  metricKey,
  metricLine,
  missing,
  readHead,
  refusedRecord,
  sampleCount,
  showHead,
  unreadableBaselineAdvice,
  wroteBaseline,
  writtenBaseline,
} from './specimen-parts.mjs';
import { deepevalDigest, deepevalSwappedDigest, deepevalThreeCasesDigest, identityDigests, promptfooDigest, promptfooSwappedDigest, promptfooThreeCasesDigest } from './digests.mjs';
import { usage } from './command.mjs';
import { injection, inputProblems, malformedInputs, polarityAndRefusals } from './specimen-inputs.mjs';
import { sampleRows } from './specimen-samples.mjs';
import { toleranceRows } from './specimen-tolerances.mjs';

const boundaryRows = ['promptfoo', 'deepeval'].flatMap((tool) =>
  ['0.9', '0.900001', '0.899999', '0.95'].map((value) =>
    check(
      `S2b-${tool}-${value}`,
      directory[tool],
      [`planted/run-accuracy-${value}.json`, '--baseline', 'planted/baseline-boundary.json'],
      {
        head: readHead(tool, 'planted/baseline-boundary.json'),
        findings: value === '0.899999' ? [below(metricKey[tool].accuracy, '0.899999', '0.92', '0.020001', '0.02')] : [],
      },
    ),
  ),
);

const recording = (tool, errorsText) => {
  const accuracy = metricKey[tool].accuracy;
  const wrote = wroteBaseline('evals-baseline.json', tool, 2);
  return [
    command(`S13-${tool}-record-errored-sample`, directory[tool], ['record', 'run-error-one.json'], {
      stdout: [`${banner} record: refused: the run has errored samples (${errorsText}); fix them and run the suite again; nothing written`],
      code: 3,
    }),
    command(`S13-${tool}-record-identical`, directory[tool], ['record', 'run-good-again.json'], {
      stdout: [`${banner} record: unchanged: "evals-baseline.json" already holds these values; not rewritten (recorded 2026-09-02)`],
    }),
    command(`S13-${tool}-record-refused-over-regression`, directory[tool], ['record', 'run-worse.json'], {
      stdout: [
        refusedRecord(
          '"evals-baseline.json" already holds a baseline of 2 metrics and 4 cases, recorded 2026-09-02; this run would replace it with a baseline of 2 metrics and 4 cases; pass --replace to replace it',
        ),
        `note: "${accuracy}": would fall by 0.25, from 1 over 4 samples to 0.75 over 4 samples`,
      ],
      code: 3,
    }),
    command(`S13-${tool}-record-over-regression`, directory[tool], ['record', 'run-worse.json', '--replace'], {
      stdout: [
        wrote,
        'replaced: the previous baseline would have reported 1 finding against this run:',
        `  ${below(accuracy, '0.75', '1', '0.25', '0')}`,
      ],
      writes: [
        [
          'evals-baseline.json',
          writtenBaseline(tool, (document) => {
            document.metrics[accuracy].value = 0.75;
          }),
        ],
      ],
    }),
    command(
      `S13-${tool}-record-identical-over-hand-set-tolerance`,
      directory[tool],
      ['record', 'run-good-again.json', '--baseline', 'planted/baseline-tolerance-0.02.json'],
      {
        stdout: [`${banner} record: unchanged: "planted/baseline-tolerance-0.02.json" already holds these values; not rewritten (recorded 2026-09-02)`],
      },
    ),
  ];
};

const recordEdges = [
  command('S13-promptfoo-record-over-misspelt-key', directory.promptfoo, ['record', 'run-good.json', '--baseline', 'planted/baseline-misspelt-key.json'], {
    stdout: [refusedRecord(`"planted/baseline-misspelt-key.json": unknown key "tolerence" in metrics["agent :: accuracy"]; ${unreadableBaselineAdvice}`)],
    code: 3,
  }),
  command('S13-promptfoo-record-over-other-major', directory.promptfoo, ['record', 'run-good.json', '--baseline', 'planted/baseline-other-major.json'], {
    stdout: [
      refusedRecord(
        `"planted/baseline-other-major.json": specification 2.0 is not read by this implementation, which reads 1.x up to 1.0; ${unreadableBaselineAdvice}`,
      ),
    ],
    code: 3,
  }),
  command('S13-promptfoo-record-version-bump', directory.promptfoo, ['record', 'planted/run-version-bump.json'], {
    stdout: [`${banner} record: unchanged: "evals-baseline.json" already holds these values; not rewritten (recorded 2026-09-02)`],
  }),
  ...['promptfoo', 'deepeval'].map((tool) =>
    command(`S13-${tool}-record-no-cases`, directory[tool], ['record', 'planted/run-no-cases.json'], {
      stdout: [refusedRecord('the run holds no cases, so a baseline of it would guard nothing')],
      code: 3,
    }),
  ),
  command('S13-deepeval-record-integer-like-names', directory.deepeval, ['record', 'planted/run-integer-like-names.json', '--baseline', 'fresh.json', '--tolerance', '0'], {
    stdout: [wroteBaseline('fresh.json', 'deepeval', 6)],
    writes: [['fresh.json', baselineWithMetrics('deepeval', ['-1', '01', '1', '10', '2', 'a'].map((name) => [name, '1', 4]))]],
  }),
];

const showRow = (id, tool, run, cases, caseDigest, metrics) =>
  command(id, directory[tool], ['show', `planted/${run}`], {
    stdout: [showHead(tool, `planted/${run}`, metrics.length, cases, caseDigest), ...metrics.map(([key, value, samples]) => metricLine(key, value, samples))],
  });

const recordRow = (id, tool, run, metrics) =>
  command(id, directory[tool], ['record', `planted/${run}`, '--baseline', 'fresh.json', '--tolerance', '0'], {
    stdout: [wroteBaseline('fresh.json', tool, metrics.length)],
    writes: [['fresh.json', baselineWithMetrics(tool, metrics)]],
  });

const tieMetrics = [
  [metricKey.promptfoo.accuracy, '0.914063', 128],
  [metricKey.promptfoo.format, '1', 4],
];
const sumOrderMetrics = [
  ['Accuracy', '0.757812', 32],
  ['Format', '0.760937', 32],
];
const decimalTieMetrics = [
  ['tie -0.8984375', '-0.898437', 1],
  ['tie -0.9140625', '-0.914062', 1],
  ['tie -5e-7', '0', 1],
  ['tie -7e-7', '-0.000001', 1],
  ['tie 0.0001245', '0.000124', 1],
  ['tie 0.0001265', '0.000127', 1],
  ['tie 0.0078125', '0.007813', 1],
  ['tie 0.1234565', '0.123457', 1],
  ['tie 5e-7', '0.000001', 1],
];

const roundingRows = [
  showRow('S14-promptfoo-tie-117-of-128-show', 'promptfoo', 'run-tie-117-of-128.json', 4, promptfooDigest, tieMetrics),
  recordRow('S14-promptfoo-tie-117-of-128-record', 'promptfoo', 'run-tie-117-of-128.json', tieMetrics),
  showRow('S14-deepeval-sum-order-show', 'deepeval', 'run-sum-order.json', 4, deepevalDigest, sumOrderMetrics),
  recordRow('S14-deepeval-sum-order-record', 'deepeval', 'run-sum-order.json', sumOrderMetrics),
  showRow('S14-deepeval-decimal-ties-show', 'deepeval', 'run-ties.json', 4, deepevalDigest, decimalTieMetrics),
  recordRow('S14-deepeval-decimal-ties-record', 'deepeval', 'run-ties.json', decimalTieMetrics),
];

const goodMetrics = (tool) => [
  [metricKey[tool].accuracy, '1', 4],
  [metricKey[tool].format, '1', 4],
];

const identityRows = [
  ...[
    ['key-order-code-unit', 'run-vars-code-unit-key-order.json', 1, identityDigests.codeUnitKeyOrder],
    ['case-order-code-unit', 'run-vars-code-unit-case-order.json', 2, identityDigests.codeUnitCaseOrder],
    ['pair-order-code-unit', 'run-vars-code-unit-pair.json', 2, identityDigests.codeUnitPair],
    ['number-one-point-zero', 'run-vars-number-one-point-zero.json', 1, identityDigests.numberOnePointZero],
    ['number-small-exponent', 'run-vars-number-small-exponent.json', 1, identityDigests.numberSmallExponent],
    ['number-negative-zero', 'run-vars-number-negative-zero.json', 1, identityDigests.numberNegativeZero],
    ['number-large-exponent', 'run-vars-number-large-exponent.json', 1, identityDigests.numberLargeExponent],
    ['nested-value', 'run-vars-nested.json', 1, identityDigests.nested],
    ['repeated-test-index', 'run-repeated-test-index.json', 1, identityDigests.repeatedTestIndex],
  ].map(([name, run, cases, caseDigest]) => showRow(`S15-promptfoo-${name}`, 'promptfoo', run, cases, caseDigest, goodMetrics('promptfoo'))),
  ...[
    ['expected-output-absent', identityDigests.expectedOutputNullOrAbsent],
    ['expected-output-null', identityDigests.expectedOutputNullOrAbsent],
    ['expected-output-empty', identityDigests.expectedOutputEmpty],
  ].map(([name, caseDigest]) => showRow(`S15-deepeval-${name}`, 'deepeval', `run-${name}.json`, 1, caseDigest, goodMetrics('deepeval'))),
];

const promptfooCasesChangedByCut = casesChanged('promptfoo', 3, promptfooThreeCasesDigest);
const deepevalCasesChangedByCut = casesChanged('deepeval', 3, deepevalThreeCasesDigest);

export const specimens = [
  check('S1-promptfoo-format-removed', directory.promptfoo, ['run-nometric.json'], {
    head: readHead('promptfoo'),
    findings: [missing(metricKey.promptfoo.format)],
  }),
  check('S1-deepeval-format-removed', directory.deepeval, ['run-nometric.json'], {
    head: readHead('deepeval'),
    findings: [missing(metricKey.deepeval.format)],
  }),
  check('S1-promptfoo-same-suite-twice', directory.promptfoo, ['run-good-again.json'], { head: readHead('promptfoo') }),
  check('S1-deepeval-same-suite-twice', directory.deepeval, ['run-good-again.json'], { head: readHead('deepeval') }),
  check('S2-promptfoo-one-case-wrong', directory.promptfoo, ['run-worse.json'], {
    head: readHead('promptfoo'),
    findings: [below(metricKey.promptfoo.accuracy, '0.75', '1', '0.25', '0')],
  }),
  check('S2-deepeval-one-case-wrong', directory.deepeval, ['run-worse.json'], {
    head: readHead('deepeval'),
    findings: [below(metricKey.deepeval.accuracy, '0.75', '1', '0.25', '0')],
  }),
  ...boundaryRows,
  check('S3-promptfoo-metric-added', directory.promptfoo, ['run-extra.json'], {
    head: readHead('promptfoo'),
    notes: ['note: 1 metric(s) only in this run, not compared (rule 3): "agent :: extra"'],
  }),
  check('S3-deepeval-metrics-added', directory.deepeval, ['run-extra.json'], {
    head: readHead('deepeval'),
    notes: ['note: 2 metric(s) only in this run, not compared (rule 3): "Exact Match", "Pattern Match"'],
  }),
  check('S4-promptfoo-three-cases', directory.promptfoo, ['run-3tests.json'], {
    head: readHead('promptfoo'),
    findings: [promptfooCasesChangedByCut, sampleCount(metricKey.promptfoo.accuracy), sampleCount(metricKey.promptfoo.format)],
    failing: [sampleCount(metricKey.promptfoo.accuracy), sampleCount(metricKey.promptfoo.format)],
  }),
  check('S4-deepeval-three-cases', directory.deepeval, ['run-drop-one.json'], {
    head: readHead('deepeval'),
    findings: [deepevalCasesChangedByCut, sampleCount(metricKey.deepeval.accuracy), sampleCount(metricKey.deepeval.format)],
    failing: [sampleCount(metricKey.deepeval.accuracy), sampleCount(metricKey.deepeval.format)],
  }),
  check('S4-promptfoo-provider-error', directory.promptfoo, ['run-error-one.json'], {
    head: readHead('promptfoo'),
    findings: [sampleCount(metricKey.promptfoo.accuracy), sampleCount(metricKey.promptfoo.format)],
    notes: ['note: "agent": 1 errored test(s) in this run (promptfoo testErrorCount)'],
  }),
  check('S4-deepeval-metric-error', directory.deepeval, ['run-error-one.json'], {
    head: readHead('deepeval'),
    findings: [sampleCount(metricKey.deepeval.accuracy), sampleCount(metricKey.deepeval.format)],
    notes: [`note: ${deepevalErrored('Accuracy')}`, `note: ${deepevalErrored('Format')}`],
  }),
  ...sampleRows,
  check('S5-promptfoo-case-swapped', directory.promptfoo, ['run-swapped.json'], {
    head: readHead('promptfoo'),
    findings: [casesChanged('promptfoo', 4, promptfooSwappedDigest)],
    failing: [],
  }),
  check('S5-deepeval-case-swapped', directory.deepeval, ['run-swap.json'], {
    head: readHead('deepeval'),
    findings: [casesChanged('deepeval', 4, deepevalSwappedDigest)],
    failing: [],
  }),
  ...inputProblems,
  ...polarityAndRefusals,
  ...injection,
  check('S11-reader-throws-a-range-error', directory.promptfoo, ['planted/run-deeply-nested.json'], {
    head: readHead('promptfoo'),
    findings: ['internal-error: "Maximum call stack size exceeded"'],
  }),
  ...recording('promptfoo', '"agent": 1 errored test(s) in this run (promptfoo testErrorCount)'),
  ...recording('deepeval', `${deepevalErrored('Accuracy')}; ${deepevalErrored('Format')}`),
  command('S13-promptfoo-record-hand-written-run', directory.promptfoo, ['record', 'planted/run-hand-written.json'], {
    stdout: [
      `${banner} record: refused: "planted/run-hand-written.json": neither a promptfoo results file nor a DeepEval test run; top-level keys: "accuracy"; nothing written`,
    ],
    code: 3,
  }),
  command('S13-promptfoo-record-no-named-metric', directory.promptfoo, ['record', 'run-unnamed.json'], {
    stdout: [`${banner} record: refused: no named metric in this run; add "metric: <name>" to the assertions you want guarded; nothing written`],
    code: 3,
  }),
  ...recordEdges,
  ...toleranceRows,
  ...roundingRows,
  ...identityRows,
  ...malformedInputs,
  ...[
    ['X-usage-no-run-file', ['check']],
    ['X-usage-two-run-files', ['check', 'run-good.json', 'run-worse.json']],
    ['X-usage-unknown-verb', ['frobnicate', 'run-good.json']],
  ].map(([id, argv]) => command(id, directory.promptfoo, argv, { stdout: [], stderr: [usage], code: 2 })),
];
