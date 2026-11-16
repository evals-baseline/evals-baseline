import { quantise } from './quantise.mjs';
import { byKey, compareText } from './unreadable.mjs';

const byMetricKey = (run) => new Map(run.metrics.map((metric) => [metric.key, metric]));

const baselineSide = (expected) => ({ value: quantise(expected.value), samples: expected.samples });

function findingsForMetric(expected, actual, reason) {
  if (actual === undefined) {
    return [
      reason === undefined
        ? { id: 'missing-metric', key: expected.key, baseline: baselineSide(expected) }
        : { id: 'unreadable-metric', key: expected.key, reason },
    ];
  }
  const findings = [];
  const drop = quantise(expected.value) - quantise(actual.value);
  if (drop > quantise(expected.tolerance)) {
    findings.push({
      id: 'below-baseline',
      key: expected.key,
      baseline: { ...baselineSide(expected), tolerance: quantise(expected.tolerance) },
      run: { value: quantise(actual.value), samples: actual.samples },
      drop,
    });
  }
  if (actual.samples < expected.samples) {
    findings.push({ id: 'sample-count', key: expected.key, baseline: { samples: expected.samples }, run: { samples: actual.samples } });
  }
  return findings;
}

function compareFindings(baseline, run) {
  const findings = [];
  if (baseline.cases.digest !== run.cases.digest) {
    findings.push({
      id: 'cases-changed',
      baseline: { count: baseline.cases.count, digest: baseline.cases.digest },
      run: { count: run.cases.count, digest: run.cases.digest },
    });
  }
  const actualByKey = byMetricKey(run);
  const reasonByKey = new Map(run.refused.map((refusal) => [refusal.key, refusal.reason]));
  for (const expected of [...baseline.metrics].sort(byKey)) {
    findings.push(...findingsForMetric(expected, actualByKey.get(expected.key), reasonByKey.get(expected.key)));
  }
  return findings;
}

function riseNotes(baseline, run) {
  const actualByKey = byMetricKey(run);
  return [...baseline.metrics]
    .sort(byKey)
    .filter((expected) => actualByKey.has(expected.key) && actualByKey.get(expected.key).samples > expected.samples)
    .map((expected) => ({
      kind: 'more-samples',
      key: expected.key,
      baseline: { samples: expected.samples },
      run: { samples: actualByKey.get(expected.key).samples },
    }));
}

function compareNotes(baseline, run) {
  const notes = [];
  const baselineKeys = new Set(baseline.metrics.map((metric) => metric.key));
  const onlyInRun = run.metrics.map((metric) => metric.key).filter((key) => !baselineKeys.has(key)).sort(compareText);
  if (onlyInRun.length > 0) {
    notes.push({ kind: 'metrics-only-in-run', keys: onlyInRun });
  }
  notes.push(...riseNotes(baseline, run));
  notes.push(...run.errors.map((text) => ({ kind: 'run-error', text })));
  for (const { key, reason } of [...run.refused].sort(byKey)) {
    if (!baselineKeys.has(key)) {
      notes.push({ kind: 'refused-metric', key, reason });
    }
  }
  const { tool, toolVersion } = baseline.source;
  if (toolVersion !== null && run.toolVersion !== null && toolVersion !== run.toolVersion) {
    notes.push({ kind: 'tool-version-changed', tool, baseline: { toolVersion }, run: { toolVersion: run.toolVersion } });
  }
  return notes;
}

export function compare(baseline, run) {
  if (baseline.source.tool !== run.tool) {
    return {
      findings: [
        {
          id: 'bad-run',
          file: run.name,
          cause: 'other-tool',
          baseline: { tool: baseline.source.tool, shape: baseline.source.shape },
          run: { tool: run.tool, shape: run.shape },
        },
      ],
      notes: [],
    };
  }
  return { findings: compareFindings(baseline, run), notes: compareNotes(baseline, run) };
}
