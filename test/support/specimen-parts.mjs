import { specificationVersion } from '../../src/read-baseline.mjs';
import { packageVersion } from '../../src/render.mjs';
import { readFixtureText } from './fixtures.mjs';
import { deepevalDigest, promptfooDigest } from './digests.mjs';

export const banner = `evals-baseline ${packageVersion} (specification ${specificationVersion})`;
export const recordedLine = 'date: baseline recorded 2026-09-02, 70 days before this check on 2026-11-11';
export const recordedAtTheClock = '2026-11-11T12:00:00.000Z';

export const directory = { promptfoo: 'fixtures/promptfoo', deepeval: 'fixtures/deepeval' };
export const described = { promptfoo: 'promptfoo "0.125.1"', deepeval: 'deepeval version unknown' };
export const digest = { promptfoo: promptfooDigest, deepeval: deepevalDigest };
export const metricKey = {
  promptfoo: { accuracy: 'agent :: accuracy', format: 'agent :: format' },
  deepeval: { accuracy: 'Accuracy', format: 'Format' },
};
export const hostileKey = 'agent :: bad\\u000a::error::pwned\\u001b[31m';

export const readHead = (tool, baselinePath = 'evals-baseline.json', metrics = 2) => [
  `${banner} check "${baselinePath}": ${described[tool]}, ${metrics} metrics, 4 cases`,
  recordedLine,
];
export const unreadHead = (baselinePath) => [`${banner} check "${baselinePath}"`];

export const check = (id, dir, argv, expected) => {
  const findings = expected.findings ?? [];
  return { kind: 'check', id, dir, argv: ['check', ...argv], findings, notes: [], ...expected, failing: expected.failing ?? findings };
};
export const command = (id, dir, argv, expected) => ({ kind: 'command', id, dir, argv, code: 0, writes: [], ...expected });

export const missing = (key) => `missing-metric "${key}": the baseline names it (1 over 4 samples) and this run has no such metric`;
export const below = (key, value, baseline, drop, tolerance, { runSamples = 4, baselineSamples = 4 } = {}) =>
  `below-baseline "${key}": ${value} over ${counted(runSamples, 'sample')} is below the baseline ${baseline} over ${counted(baselineSamples, 'sample')} by ${drop}, more than the tolerance ${tolerance}`;
export const sampleCount = (key, baselineSamples = 4, runSamples = 3) =>
  `sample-count "${key}": the baseline holds ${counted(baselineSamples, 'sample')} and this run holds ${runSamples}`;
export const moreSamples = (key, baselineSamples = 4, runSamples = 8) =>
  `note: "${key}": the baseline holds ${counted(baselineSamples, 'sample')} and this run holds ${runSamples}; more samples than the baseline are never a finding`;
export const casesChanged = (tool, runCount, runDigest) =>
  `cases-changed: the baseline was recorded from 4 cases (digest ${digest[tool]}); this run holds ${runCount} cases (digest ${runDigest}); re-record if the change is intended`;
export const deepevalErrored = (metric) =>
  `"${metric}": 1 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)`;
export const unreadable = (name, reason) => `bad-run: "${name}": ${reason}`;

export const writtenBaseline = (tool, edit) => {
  const document = JSON.parse(readFixtureText(tool, 'evals-baseline.json'));
  document.recordedAt = recordedAtTheClock;
  edit(document);
  return `${JSON.stringify(document, null, 2)}\n`;
};

export const baselineWithMetrics = (tool, metrics, tolerance = 0) => {
  const text = writtenBaseline(tool, () => {});
  const head = text.slice(0, text.indexOf('  "metrics": {'));
  const entries = metrics.map(
    ([key, value, samples]) => `    ${JSON.stringify(key)}: {\n      "value": ${value},\n      "samples": ${samples},\n      "tolerance": ${tolerance}\n    }`,
  );
  return `${head}  "metrics": {\n${entries.join(',\n')}\n  }\n}\n`;
};

export const counted = (number, noun) => `${number} ${noun}${number === 1 ? '' : 's'}`;

const shownAs = { promptfoo: 'promptfoo "0.125.1" (promptfoo-results-3)', deepeval: 'deepeval version unknown (deepeval-test-run)' };

export const showHead = (tool, runFile, metrics, cases, caseDigest) =>
  `${banner} show "${runFile}": ${shownAs[tool]}, ${counted(metrics, 'metric')}, ${counted(cases, 'case')} (digest ${caseDigest})`;
export const metricLine = (key, value, samples) => `metric "${key}"  ${value}  ${counted(samples, 'sample')}`;
export const refusedShow = (reason) => `${banner} show: refused: ${reason}`;
export const refusedRecord = (reason) => `${banner} record: refused: ${reason}; nothing written`;
export const wroteBaseline = (path, tool, metrics) => `${banner} record: wrote "${path}" (${counted(metrics, 'metric')}, 4 cases, ${described[tool]})`;
export const badBaseline = (path, reason) => `bad-baseline: "${path}": ${reason}`;
export const unreadableBaselineAdvice =
  'the existing baseline cannot be read, so recording over it would discard its tolerances; fix it or delete it, then record again';
export const unsetTolerance = (metrics) =>
  refusedRecord(
    `no tolerance was given for ${counted(metrics, 'metric')}, and a tolerance of 0 reports a fall of any size; pass --tolerance <n> to set one, or --tolerance 0 to accept 0`,
  );
export const changedTolerance = (flag, metrics) =>
  refusedRecord(
    `--tolerance ${flag} would change the tolerance of ${counted(metrics, 'metric')} that the baseline already holds, and record keeps those; edit them in the baseline, or leave --tolerance out`,
  );
export const heldTolerance = (key, tolerance) => `note: "${key}": the baseline holds the tolerance ${tolerance}`;
export const unchangedRecord = (path) => `${banner} record: unchanged: "${path}" already holds these values; not rewritten (recorded 2026-09-02)`;
