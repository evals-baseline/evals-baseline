import { datum } from '../../src/printable.mjs';
import { count, formatQuantised, listKeys, quantise } from '../../src/quantise.mjs';
import { byKey, compareText } from '../../src/unreadable.mjs';

const keyed = (id, key, text) => ({ id, key, text });

const valueOverSamples = (metric) => `${formatQuantised(quantise(metric.value))} over ${count(metric.samples, 'sample')}`;

const byMetricKey = (run) => new Map(run.metrics.map((metric) => [metric.key, metric]));

function describeMissing(expected) {
  return `the baseline names it (${valueOverSamples(expected)}) and this run has no such metric`;
}

const measuredNoiseFloorInMillionths = 8400;

function describeDrop(expected, actual, drop) {
  const tolerance = formatQuantised(quantise(expected.tolerance));
  const fall = `${valueOverSamples(actual)} is below the baseline ${valueOverSamples(expected)} by ${formatQuantised(drop)}`;
  if (quantise(expected.tolerance) === 0 && drop < measuredNoiseFloorInMillionths) {
    return `${fall}. The tolerance is 0, so every fall is reported, and a fall this small is one that two runs of unchanged code can show. The tolerance is probably unset; the model is probably not worse. Rerun the suite with nothing changed, see how far each metric moves, and set this tolerance in the baseline to match (see the README section on setting tolerances from your own noise). If 0 is on purpose, treat this as a real fall.`;
  }
  return `${fall}, more than the tolerance ${tolerance}`;
}

function describeCases(baseline, run) {
  const recorded = `${count(baseline.cases.count, 'case')} (digest ${baseline.cases.digest})`;
  const current = `${count(run.cases.count, 'case')} (digest ${run.cases.digest})`;
  return `the baseline was recorded from ${recorded}; this run holds ${current}; re-record if the change is intended`;
}

function findingsForMetric(expected, actual, reason) {
  if (actual === undefined) {
    return [reason === undefined ? keyed('missing-metric', expected.key, describeMissing(expected)) : keyed('unreadable-metric', expected.key, reason)];
  }
  const findings = [];
  const drop = quantise(expected.value) - quantise(actual.value);
  if (drop > quantise(expected.tolerance)) {
    findings.push(keyed('below-baseline', expected.key, describeDrop(expected, actual, drop)));
  }
  if (actual.samples < expected.samples) {
    findings.push(keyed('sample-count', expected.key, `the baseline holds ${count(expected.samples, 'sample')} and this run holds ${actual.samples}`));
  }
  return findings;
}

function compareFindings(baseline, run) {
  const findings = [];
  if (baseline.cases.digest !== run.cases.digest) {
    findings.push({ id: 'cases-changed', text: describeCases(baseline, run) });
  }
  const actualByKey = byMetricKey(run);
  const reasonByKey = new Map(run.refused.map((refusal) => [refusal.key, refusal.reason]));
  for (const expected of [...baseline.metrics].sort(byKey)) {
    findings.push(...findingsForMetric(expected, actualByKey.get(expected.key), reasonByKey.get(expected.key)));
  }
  return findings;
}

function describeRise(expected, actual) {
  return `${datum(expected.key)}: the baseline holds ${count(expected.samples, 'sample')} and this run holds ${actual.samples}; more samples than the baseline are never a finding`;
}

function riseNotes(baseline, run) {
  const actualByKey = byMetricKey(run);
  return [...baseline.metrics]
    .sort(byKey)
    .filter((expected) => actualByKey.has(expected.key) && actualByKey.get(expected.key).samples > expected.samples)
    .map((expected) => describeRise(expected, actualByKey.get(expected.key)));
}

function compareNotes(baseline, run) {
  const notes = [];
  const baselineKeys = new Set(baseline.metrics.map((metric) => metric.key));
  const onlyInRun = run.metrics.map((metric) => metric.key).filter((key) => !baselineKeys.has(key)).sort(compareText);
  if (onlyInRun.length > 0) {
    notes.push(`${onlyInRun.length} metric(s) only in this run, not compared (rule 3): ${listKeys(onlyInRun)}`);
  }
  notes.push(...riseNotes(baseline, run));
  notes.push(...run.errors);
  for (const { key, reason } of [...run.refused].sort(byKey)) {
    if (!baselineKeys.has(key)) {
      notes.push(`${datum(key)} cannot be read: ${reason}`);
    }
  }
  const { tool, toolVersion } = baseline.source;
  if (toolVersion !== null && run.toolVersion !== null && toolVersion !== run.toolVersion) {
    notes.push(`the baseline was recorded by ${tool} ${datum(toolVersion)}; this run was written by ${datum(run.toolVersion)}`);
  }
  return notes;
}

export function legacyCompare(baseline, run) {
  if (baseline.source.tool !== run.tool) {
    const recorded = `${baseline.source.tool} (${baseline.source.shape})`;
    return {
      findings: [{ id: 'bad-run', text: `${datum(run.name)}: the baseline was recorded from ${recorded} and this file is ${run.tool} (${run.shape})` }],
      notes: [],
    };
  }
  return { findings: compareFindings(baseline, run), notes: compareNotes(baseline, run) };
}

export const legacyFindingLine = ({ id, key, text }) => (key === undefined ? `${id}: ${text}` : `${id} ${datum(key)}: ${text}`);

const legacyFailure = (code) => (code === 'ENOENT' ? 'not found' : code);

export const legacyCommandLines = {
  'no-baseline': ({ file }) => legacyFindingLine({ id: 'no-baseline', text: `no baseline at ${datum(file)}; nothing was compared; record one with: evals-baseline record <run-file>` }),
  'bad-baseline/cannot-read': ({ file, failure }) => legacyFindingLine({ id: 'bad-baseline', text: `cannot read ${datum(file)}: ${legacyFailure(failure)}` }),
  'bad-baseline/refused': ({ file, problem }) => legacyFindingLine({ id: 'bad-baseline', text: `${datum(file)}: ${problem}` }),
  'bad-run/cannot-read': ({ file, failure }) => legacyFindingLine({ id: 'bad-run', text: `cannot read ${datum(file)}: ${legacyFailure(failure)}` }),
  'bad-run/refused': ({ file, problem }) => legacyFindingLine({ id: 'bad-run', text: `${datum(file)}: ${problem}` }),
  'internal-error': ({ message }) => legacyFindingLine({ id: 'internal-error', text: datum(message) }),
};
