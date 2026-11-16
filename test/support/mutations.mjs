const loopOverBaselineKeys = `  for (const expected of [...baseline.metrics].sort(byKey)) {
    findings.push(...findingsForMetric(expected, actualByKey.get(expected.key), reasonByKey.get(expected.key)));
  }
`;

const walkTheUnion = `  const onlyInRun = run.metrics.filter((metric) => !baseline.metrics.some((known) => known.key === metric.key));
  const union = [...baseline.metrics, ...onlyInRun.map((metric) => ({ ...metric, samples: metric.samples + 1, tolerance: 0 }))];
  for (const expected of union.sort(byKey)) {`;

export const mutations = [
  {
    id: 'S1-delete-the-loop-over-the-baseline-keys',
    module: 'compare',
    edits: [[loopOverBaselineKeys, '']],
    specimens: ['S1-promptfoo-format-removed', 'S1-deepeval-format-removed'],
  },
  {
    id: 'S2-compare-with-greater-or-equal',
    module: 'compare',
    edits: [['  if (drop > quantise(expected.tolerance)) {', '  if (drop >= quantise(expected.tolerance)) {']],
    specimens: ['S2b-promptfoo-0.9', 'S2b-deepeval-0.9', 'S1-promptfoo-same-suite-twice', 'S1-deepeval-same-suite-twice'],
  },
  {
    id: 'S2-compare-with-plain-subtraction',
    module: 'compare',
    edits: [
      [
        '  const drop = quantise(expected.value) - quantise(actual.value);\n  if (drop > quantise(expected.tolerance)) {',
        '  const drop = expected.value - actual.value;\n  if (drop > expected.tolerance) {',
      ],
    ],
    specimens: ['S2b-promptfoo-0.9', 'S2b-deepeval-0.9'],
  },
  {
    id: 'S3-walk-the-union-of-the-keys',
    module: 'compare',
    edits: [['  for (const expected of [...baseline.metrics].sort(byKey)) {', walkTheUnion]],
    specimens: ['S3-promptfoo-metric-added', 'S3-deepeval-metrics-added'],
  },
  {
    id: 'S4-delete-the-count-comparison',
    module: 'compare',
    edits: [['  if (actual.samples < expected.samples) {', '  if (false) {']],
    specimens: ['S4-promptfoo-three-cases', 'S4-deepeval-three-cases', 'S4-promptfoo-provider-error', 'S4-deepeval-metric-error'],
  },
  {
    id: 'S5-delete-the-digest-comparison',
    module: 'compare',
    edits: [['  if (baseline.cases.digest !== run.cases.digest) {', '  if (false) {']],
    specimens: ['S5-promptfoo-case-swapped', 'S5-deepeval-case-swapped', 'S4-promptfoo-three-cases', 'S4-deepeval-three-cases'],
  },
  {
    id: 'S6-make-the-default-exit-1',
    module: 'render',
    edits: [['    code: strict ? strictCode : exitCode.pass,', '    code: strictCode,']],
    specimens: ['S2-promptfoo-one-case-wrong', 'S2-deepeval-one-case-wrong'],
  },
  {
    id: 'S6-make-cases-changed-fail-under-strict',
    module: 'render',
    edits: [["const advisoryFindingId = 'cases-changed';", "const advisoryFindingId = 'none';"]],
    specimens: ['S5-promptfoo-case-swapped', 'S5-deepeval-case-swapped'],
  },
  {
    id: 'S6-let-a-finding-that-could-not-be-evaluated-exit-1',
    module: 'render',
    edits: [['  return regressionFindingIds.has(id) ? exitCode.regression : exitCode.notEvaluated;', '  return exitCode.regression;']],
    specimens: ['S8-no-baseline', 'S8-hand-written-run', 'S8-baseline-misspelt-key', 'S9-deepeval-lower-is-better-named', 'S11-reader-throws-a-range-error'],
  },
  {
    id: 'S6-let-a-regression-exit-3',
    module: 'render',
    edits: [['  return regressionFindingIds.has(id) ? exitCode.regression : exitCode.notEvaluated;', '  return exitCode.notEvaluated;']],
    specimens: ['S1-promptfoo-format-removed', 'S2-promptfoo-one-case-wrong', 'S4-promptfoo-three-cases', 'S4-deepeval-fewer-samples-and-a-drop'],
  },
  {
    id: 'S6-print-exit-1-in-the-strict-summary-of-every-finding',
    module: 'render',
    edits: [['exit ${strictCode} (--strict)', 'exit 1 (--strict)']],
    specimens: ['S8-no-baseline', 'S8-hand-written-run', 'S9-deepeval-lower-is-better-named', 'S11-reader-throws-a-range-error'],
  },
  {
    id: 'S6-print-exit-1-in-the-advice-of-every-finding',
    module: 'render',
    edits: [['(pass --strict to exit ${strictCode})', '(pass --strict to exit 1)']],
    specimens: ['S8-no-baseline', 'S8-baseline-misspelt-key', 'S9-deepeval-lower-is-better-named', 'S11-reader-throws-a-range-error'],
  },
  {
    id: 'S7-add-a-clock-read-to-compare',
    module: 'compare',
    edits: [['function compareNotes(baseline, run) {\n  const notes = [];', 'function compareNotes(baseline, run) {\n  const notes = [];\n  const readAt = Date.now();']],
    sourceGuard: true,
  },
  {
    id: 'S7-add-a-clock-read-to-the-exit-code',
    module: 'render',
    edits: [['    code: strict ? strictCode : exitCode.pass,', '    code: strict && Date.now() > 0 ? strictCode : exitCode.pass,']],
    sourceGuard: true,
  },
  {
    id: 'S8-print-no-findings-for-a-missing-baseline',
    module: 'command',
    edits: [["    state.findings.push({ id: 'no-baseline', file: baselinePath });\n    return;", '    return;']],
    specimens: ['S8-no-baseline'],
  },
  {
    id: 'S8-print-no-findings-for-an-unreadable-baseline',
    module: 'command',
    edits: [["    state.findings.push({ id: 'bad-baseline', file: baselinePath, cause: 'refused', problem: baseline.problem });\n    return;", '    return;']],
    specimens: ['S8-baseline-misspelt-key', 'S8-baseline-no-cases', 'S8-baseline-newer-minor', 'S8-baseline-other-major', 'S8-baseline-no-metric'],
  },
  {
    id: 'S8-print-no-findings-for-an-unreadable-run',
    module: 'command',
    edits: [["    state.findings.push({ id: 'bad-run', file: runFile, cause: 'refused', problem: run.problem });\n    return;", '    return;']],
    specimens: ['S8-hand-written-run', 'S8-results-version-4', 'S8-both-shapes', 'S8-not-json', 'S8-deepeval-wrapper'],
  },
  {
    id: 'S8-print-no-findings-for-a-missing-run-file',
    module: 'command',
    edits: [["    state.findings.push({ id: 'bad-run', file: runFile, cause: 'cannot-read', failure: runInput.failure });\n    return;", '    return;']],
    specimens: ['S8-missing-run-file'],
  },
  {
    id: 'S8-compare-a-run-of-the-other-tool-anyway',
    module: 'compare',
    edits: [['  if (baseline.source.tool !== run.tool) {', '  if (false) {']],
    specimens: ['S8-other-tool', 'S8-other-tool-reversed'],
  },
  {
    id: 'S9-drop-the-polarity-witness',
    module: 'read-run',
    edits: [['  const contradictions = findContradictions(document.testCases);', '  const contradictions = new Map();']],
    specimens: [
      'S9-deepeval-lower-is-better-show',
      'S9-deepeval-lower-is-better-record',
      'S9-deepeval-lower-is-better-not-named',
      'S9-deepeval-lower-is-better-named',
    ],
  },
  {
    id: 'S9-drop-the-multi-turn-refusal',
    module: 'read-run',
    edits: [['    if (conversational.length > 0) {', '    if (conversational.length > 999999) {']],
    specimens: ['S9-deepeval-conversational'],
  },
  {
    id: 'S10-print-without-the-replacement',
    module: 'printable',
    edits: [['export function printable(text) {', 'export function printable(text) {\n  return text;\n}\n\nfunction replacingPrintable(text) {']],
    specimens: ['S10-hostile-metric-note', 'S10-hostile-metric-finding', 'S10-hostile-metric-show'],
  },
  {
    id: 'S10-span-without-the-quotes',
    module: 'printable',
    edits: [['const spanOf = (text) => `"${printable(', 'const spanOf = (text) => `${printable(']],
    specimens: ['S10-hostile-metric-note', 'S10-hostile-metric-finding', 'S10-hostile-metric-show'],
  },
  {
    id: 'S11-let-the-exception-escape',
    module: 'command',
    edits: [["    state.findings.push(internalError(error));", '    throw error;']],
    specimens: ['S11-reader-throws-a-range-error'],
  },
  {
    id: 'S13-record-reads-with-another-reader',
    module: 'command',
    edits: [['  return attempt(() => readRun(input.text, runFile));', '  return { value: JSON.parse(input.text) };']],
    specimens: ['S13-promptfoo-record-hand-written-run'],
  },
  {
    id: 'S13-record-accepts-errored-samples',
    module: 'command',
    edits: [['  if (run.errors.length > 0) {', '  if (false) {']],
    specimens: ['S13-promptfoo-record-errored-sample', 'S13-deepeval-record-errored-sample', 'S9-deepeval-score-only-record'],
  },
  {
    id: 'S13-record-accepts-a-run-with-no-metric',
    module: 'command',
    edits: [['  if (run.metrics.length === 0) {', '  if (false) {']],
    specimens: ['S13-promptfoo-record-no-named-metric'],
  },
  {
    id: 'S13-record-does-not-say-which-metric-it-left-out',
    module: 'render',
    edits: [['const notRecorded = (refused) =>', 'const notRecorded = (refused) => [] ||']],
    specimens: ['S9-deepeval-lower-is-better-record'],
  },
  {
    id: 'S13-record-does-not-keep-the-tolerance',
    module: 'record',
    edits: [['carried.has(key) ? carried.get(key) : tolerance', 'tolerance']],
    specimens: ['S13-promptfoo-record-identical-over-hand-set-tolerance', 'S13-deepeval-record-identical-over-hand-set-tolerance'],
  },
  {
    id: 'S13-record-rewrites-an-unchanged-baseline',
    module: 'command',
    edits: [['    if (existing.previous !== null && isUnchanged(existing.previous, next)) {', '    if (false) {']],
    specimens: ['S13-promptfoo-record-identical', 'S13-deepeval-record-identical'],
  },
  {
    id: 'S13-record-does-not-print-what-it-replaces',
    module: 'command',
    edits: [['    return compare(previous, run).findings;', '    return [];']],
    specimens: ['S13-promptfoo-record-over-regression', 'S13-deepeval-record-over-regression'],
  },
  {
    id: 'S13-record-replaces-a-baseline-without-being-asked',
    module: 'record',
    edits: [['  if (previous === null || previous === undefined || replace) {', '  if (true) {']],
    specimens: ['S13-promptfoo-record-refused-over-regression', 'S13-deepeval-record-refused-over-regression'],
  },
  {
    id: 'S13-record-refuses-even-when-told-to-replace',
    module: 'record',
    edits: [['previous === undefined || replace) {', 'previous === undefined) {']],
    specimens: [
      'S13-promptfoo-record-over-regression',
      'S13-deepeval-record-over-regression',
      'S13-promptfoo-record-new-metric-with-tolerance',
      'S13-deepeval-record-new-metric-with-tolerance',
    ],
  },
  {
    id: 'S13-record-names-the-wrong-direction-of-a-move',
    module: 'record',
    edits: [["${drop > 0 ? 'fall' : 'rise'}", "${drop > 0 ? 'rise' : 'fall'}"]],
    specimens: ['S13-promptfoo-record-refused-over-regression', 'S13-deepeval-record-refused-over-regression'],
  },
  {
    id: 'S13-record-does-not-say-which-metric-would-move',
    module: 'record',
    edits: [['    .filter(([, text]) => text !== null)', '    .filter(() => false)']],
    specimens: ['S13-promptfoo-record-refused-over-regression', 'S13-deepeval-record-refused-over-regression'],
  },
  {
    id: 'S4-fire-sample-count-on-a-rise',
    module: 'compare',
    edits: [['  if (actual.samples < expected.samples) {', '  if (actual.samples !== expected.samples) {']],
    specimens: ['S4-promptfoo-more-samples', 'S4-deepeval-more-samples'],
  },
  {
    id: 'S2-print-below-baseline-without-the-samples',
    module: 'describe',
    edits: [
      [
        '    `${valueOverSamples(run)} is below the baseline ${valueOverSamples(baseline)} by ${formatQuantised(drop)}, more than the tolerance ${formatQuantised(baseline.tolerance)}`,',
        '    `${formatQuantised(run.value)} is below the baseline ${formatQuantised(baseline.value)} by ${formatQuantised(drop)}, more than the tolerance ${formatQuantised(baseline.tolerance)}`,',
      ],
    ],
    specimens: [
      'S2-promptfoo-one-case-wrong',
      'S2-deepeval-one-case-wrong',
      'S2b-promptfoo-0.899999',
      'S2b-deepeval-0.899999',
      'S4-promptfoo-fewer-samples-and-a-drop',
      'S4-deepeval-fewer-samples-and-a-drop',
    ],
  },
  {
    id: 'S13-record-accepts-an-unset-tolerance',
    module: 'record',
    edits: [['    return unset.length === 0 ? null : { reason: unsetReason(unset.length), held: [] };', '    return null;']],
    specimens: [
      'S13-promptfoo-record-unset-tolerance',
      'S13-deepeval-record-unset-tolerance',
      'S13-promptfoo-record-new-metric-no-tolerance',
      'S13-deepeval-record-new-metric-no-tolerance',
    ],
  },
  {
    id: 'S13-record-ignores-a-tolerance-that-conflicts',
    module: 'record',
    edits: [['    .filter(({ key }) => carried.has(key) && quantise(carried.get(key)) !== quantise(tolerance))', '    .filter(() => false)']],
    specimens: ['S13-promptfoo-record-tolerance-conflict', 'S13-deepeval-record-tolerance-conflict'],
  },
];
