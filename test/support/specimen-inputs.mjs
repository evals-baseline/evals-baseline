import {
  badBaseline,
  banner,
  check,
  command,
  digest,
  directory,
  hostileKey,
  metricKey,
  metricLine,
  missing,
  readHead,
  refusedShow,
  showHead,
  unreadHead,
  unreadable,
  writtenBaseline,
  wroteBaseline,
} from './specimen-parts.mjs';
import { deepevalDigest, promptfooDigest } from './digests.mjs';

export const inputProblems = [
  check('S8-no-baseline', directory.promptfoo, ['run-good.json', '--baseline', 'does-not-exist.json'], {
    head: unreadHead('does-not-exist.json'),
    findings: ['no-baseline: no baseline at "does-not-exist.json"; nothing was compared; record one with: evals-baseline record <run-file>'],
  }),
  check('S8-hand-written-run', directory.promptfoo, ['planted/run-hand-written.json'], {
    head: readHead('promptfoo'),
    findings: [unreadable('planted/run-hand-written.json', 'neither a promptfoo results file nor a DeepEval test run; top-level keys: "accuracy"')],
  }),
  check('S8-results-version-4', directory.promptfoo, ['planted/run-version-4.json'], {
    head: readHead('promptfoo'),
    findings: [unreadable('planted/run-version-4.json', 'promptfoo results version 4 is not read; this implementation reads version 3')],
  }),
  check('S8-both-shapes', directory.promptfoo, ['planted/run-both-shapes.json'], {
    head: readHead('promptfoo'),
    findings: [
      unreadable(
        'planted/run-both-shapes.json',
        'matches both a promptfoo results file and a DeepEval test run; top-level keys: "config", "evalId", "metadata", "metricsScores", "results", "runtimeOptions", "shareableUrl", "testCases", "vars"',
      ),
    ],
  }),
  check('S8-not-json', directory.promptfoo, ['planted/run-not-json.json'], {
    head: readHead('promptfoo'),
    findings: [unreadable('planted/run-not-json.json', 'not JSON')],
  }),
  check('S8-missing-run-file', directory.promptfoo, ['no-such-run.json'], {
    head: readHead('promptfoo'),
    findings: ['bad-run: cannot read "no-such-run.json": not found'],
  }),
  check('S8-deepeval-wrapper', directory.deepeval, ['wrapped.json'], {
    head: readHead('deepeval'),
    findings: [
      unreadable(
        'wrapped.json',
        'this is DeepEval .latest_test_run.json, which wraps the run in testRunData; read .latest_run_full.json or a test_run_*.json file',
      ),
    ],
  }),
  check('S8-other-tool', 'fixtures', ['promptfoo/run-good.json', '--baseline', 'deepeval/evals-baseline.json'], {
    head: readHead('deepeval', 'deepeval/evals-baseline.json'),
    findings: [
      unreadable('promptfoo/run-good.json', 'the baseline was recorded from deepeval (deepeval-test-run) and this file is promptfoo (promptfoo-results-3)'),
    ],
  }),
  check('S8-other-tool-reversed', 'fixtures', ['deepeval/run-good.json', '--baseline', 'promptfoo/evals-baseline.json'], {
    head: readHead('promptfoo', 'promptfoo/evals-baseline.json'),
    findings: [
      unreadable('deepeval/run-good.json', 'the baseline was recorded from promptfoo (promptfoo-results-3) and this file is deepeval (deepeval-test-run)'),
    ],
  }),
  ...[
    ['misspelt-key', 'unknown key "tolerence" in metrics["agent :: accuracy"]'],
    ['no-cases', 'missing key "cases" in the baseline'],
    ['newer-minor', 'specification 1.1 is newer than 1.0, the newest this implementation reads'],
    ['other-major', 'specification 2.0 is not read by this implementation, which reads 1.x up to 1.0'],
    ['no-metric', 'metrics names no metric, so the baseline guards nothing'],
  ].map(([name, reason]) =>
    check(`S8-baseline-${name}`, directory.promptfoo, ['run-good.json', '--baseline', `planted/baseline-${name}.json`], {
      head: unreadHead(`planted/baseline-${name}.json`),
      findings: [badBaseline(`planted/baseline-${name}.json`, reason)],
    }),
  ),
];

const failureRateReason =
  "DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only";

export const polarityAndRefusals = [
  command('S9-deepeval-lower-is-better-show', directory.deepeval, ['show', 'run-inverted.json'], {
    stdout: [
      showHead('deepeval', 'run-inverted.json', 2, 4, deepevalDigest),
      metricLine('Accuracy', '1', 4),
      metricLine('Format', '1', 4),
      `note: "Failure rate" cannot be read: ${failureRateReason}`,
    ],
  }),
  command('S9-deepeval-lower-is-better-record', directory.deepeval, ['record', 'run-inverted.json', '--baseline', 'fresh.json', '--tolerance', '0'], {
    stdout: [wroteBaseline('fresh.json', 'deepeval', 2), `note: "Failure rate" not recorded: ${failureRateReason}`],
    writes: [['fresh.json', writtenBaseline('deepeval', () => {})]],
  }),
  check('S9-deepeval-lower-is-better-not-named', directory.deepeval, ['run-inverted.json'], {
    head: readHead('deepeval'),
    notes: [`note: "Failure rate" cannot be read: ${failureRateReason}`],
  }),
  check('S9-deepeval-lower-is-better-named', directory.deepeval, ['run-inverted.json', '--baseline', 'planted/baseline-names-failure-rate.json'], {
    head: readHead('deepeval', 'planted/baseline-names-failure-rate.json', 3),
    findings: [`unreadable-metric "Failure rate": ${failureRateReason}`],
  }),
  command('S9-deepeval-score-only-record', directory.deepeval, ['record', 'run-score-only.json', '--baseline', 'sc.json'], {
    stdout: [
      `${banner} record: refused: the run has errored samples ("Brevity": 4 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)); fix them and run the suite again; nothing written`,
    ],
    code: 3,
  }),
  check('S9-deepeval-conversational', directory.deepeval, ['planted/run-conversational.json'], {
    head: readHead('deepeval'),
    findings: [unreadable('planted/run-conversational.json', 'conversationalTestCases is not empty; this implementation does not read multi-turn runs')],
  }),
  check('S9-deepeval-sqlite-like', directory.deepeval, ['planted/run-sqlite-like.db'], {
    head: readHead('deepeval'),
    findings: [unreadable('planted/run-sqlite-like.db', 'not JSON')],
  }),
];

export const injection = [
  check('S10-hostile-metric-note', directory.promptfoo, ['run-injection.json'], {
    head: readHead('promptfoo'),
    notes: [`note: 1 metric(s) only in this run, not compared (rule 3): "${hostileKey}"`],
  }),
  check('S10-hostile-metric-finding', directory.promptfoo, ['run-good.json', '--baseline', 'planted/baseline-hostile-key.json'], {
    head: readHead('promptfoo', 'planted/baseline-hostile-key.json', 3),
    findings: [missing(hostileKey)],
  }),
  command('S10-hostile-metric-show', directory.promptfoo, ['show', 'run-injection.json'], {
    stdout: [
      showHead('promptfoo', 'run-injection.json', 3, 4, promptfooDigest),
      metricLine(metricKey.promptfoo.accuracy, '1', 4),
      metricLine(hostileKey, '1', 4),
      metricLine(metricKey.promptfoo.format, '1', 4),
    ],
  }),
];

const baselineRefusal = (name, reason) =>
  check(`S16-baseline-${name}`, directory.promptfoo, ['run-good.json', '--baseline', `planted/baseline-${name}.json`], {
    head: unreadHead(`planted/baseline-${name}.json`),
    findings: [badBaseline(`planted/baseline-${name}.json`, reason)],
  });

const specNotMajorMinor = (got) => `spec must be MAJOR.MINOR with no third number and no leading zeros, such as "1.0", got ${got}`;
const repeatedKey = (key) => `the key "${key}" appears twice in one object`;
const duplicatedKey = { promptfoo: 'accuracy', deepeval: 'scores' };

const printed = {
  stop: '##\\u005bstop-commands]tok',
  error: '::error title=pwned::forged annotation',
  forged: 'Accuracy\\u2028below-baseline Format: 0 is below the baseline 1 by 1, more than the tolerance 0\\u2028',
  csi: 'Csi\\u009b31mred',
  nel: 'Line\\u0085break',
  rlo: 'Rlo\\u202eabc',
};
const printedOnlyHostile = [printed.stop, printed.error, printed.forged, printed.csi, printed.nel, printed.rlo];
const printedEveryName = [printed.stop, printed.error, 'Accuracy', printed.forged, printed.csi, 'Format', printed.nel, printed.rlo];

export const malformedInputs = [
  ...[
    ['1.0.0', specNotMajorMinor('"1.0.0"')],
    ['1.0.7', specNotMajorMinor('"1.0.7"')],
    ['01.00', specNotMajorMinor('"01.00"')],
    ['1.00', specNotMajorMinor('"1.00"')],
    ['1.10', 'specification 1.10 is newer than 1.0, the newest this implementation reads'],
    ['0.9', 'specification 0.9 is not read by this implementation, which reads 1.x up to 1.0'],
  ].map(([spelling, reason]) => baselineRefusal(`spec-${spelling}`, reason)),
  baselineRefusal('duplicate-metric', repeatedKey('agent :: accuracy')),
  baselineRefusal('value-4000000001', 'metrics["agent :: accuracy"].value must be a number between -4000000000 and 4000000000'),
  ...['promptfoo', 'deepeval'].flatMap((tool) => [
    check(`S16-${tool}-run-duplicate-key`, directory[tool], ['planted/run-duplicate-key.json'], {
      head: readHead(tool),
      findings: [unreadable('planted/run-duplicate-key.json', repeatedKey(duplicatedKey[tool]))],
    }),
    command(`S16-${tool}-show-duplicate-key`, directory[tool], ['show', 'planted/run-duplicate-key.json'], {
      stdout: [refusedShow(`"planted/run-duplicate-key.json": ${repeatedKey(duplicatedKey[tool])}`)],
      code: 3,
    }),
    command(`S16-${tool}-show-value-4000000000`, directory[tool], ['show', 'planted/run-value-4000000000.json'], {
      stdout: [
        showHead(tool, 'planted/run-value-4000000000.json', 2, 4, digest[tool]),
        metricLine(metricKey[tool].accuracy, '4000000000', 4),
        metricLine(metricKey[tool].format, '1', 4),
      ],
    }),
    check(`S16-${tool}-run-value-4000000001`, directory[tool], ['planted/run-value-4000000001.json'], {
      head: readHead(tool),
      findings: [unreadable('planted/run-value-4000000001.json', `the value of "${metricKey[tool].accuracy}" is out of range`)],
    }),
  ]),
  check('S16-hostile-names-missing-metric', directory.deepeval, ['run-good.json', '--baseline', 'planted/baseline-hostile-names.json'], {
    head: readHead('deepeval', 'planted/baseline-hostile-names.json', 8),
    findings: printedOnlyHostile.map(missing),
  }),
  check('S16-hostile-names-note', directory.deepeval, ['planted/run-hostile-names.json'], {
    head: readHead('deepeval'),
    notes: [`note: 6 metric(s) only in this run, not compared (rule 3): ${printedOnlyHostile.map((name) => `"${name}"`).join(', ')}`],
  }),
  command('S16-hostile-names-show', directory.deepeval, ['show', 'planted/run-hostile-names.json'], {
    stdout: [showHead('deepeval', 'planted/run-hostile-names.json', 8, 4, deepevalDigest), ...printedEveryName.map((name) => metricLine(name, '1', 4))],
  }),
];
