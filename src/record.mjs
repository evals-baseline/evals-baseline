import { datum, jsonSafe } from './printable.mjs';
import { count, formatQuantised, quantise } from './quantise.mjs';
import { specificationVersion } from './read-baseline.mjs';
import { byKey, compareText } from './unreadable.mjs';

function carriedTolerances(run, previous) {
  const carried = new Map();
  if (previous !== null && previous !== undefined && previous.source.tool === run.tool) {
    for (const metric of previous.metrics) {
      carried.set(metric.key, metric.tolerance);
    }
  }
  return carried;
}

const unsetReason = (metrics) =>
  `no tolerance was given for ${count(metrics, 'metric')}, and a tolerance of 0 reports a fall of any size; pass --tolerance <n> to set one, or --tolerance 0 to accept 0`;

const conflictReason = (tolerance, metrics) =>
  `--tolerance ${formatQuantised(quantise(tolerance))} would change the tolerance of ${count(metrics, 'metric')} that the baseline already holds, and record keeps those; edit them in the baseline, or leave --tolerance out`;

export function toleranceRefusal(run, tolerance, previous) {
  const carried = carriedTolerances(run, previous);
  if (tolerance === undefined) {
    const unset = run.metrics.filter(({ key }) => !carried.has(key));
    return unset.length === 0 ? null : { reason: unsetReason(unset.length), held: [] };
  }
  const held = run.metrics
    .filter(({ key }) => carried.has(key) && quantise(carried.get(key)) !== quantise(tolerance))
    .map(({ key }) => ({ key, tolerance: carried.get(key) }))
    .sort(byKey);
  return held.length === 0 ? null : { reason: conflictReason(tolerance, held.length), held };
}

export function record(run, now, tolerance, previous) {
  const carried = carriedTolerances(run, previous);
  return {
    spec: specificationVersion,
    source: { tool: run.tool, toolVersion: run.toolVersion, shape: run.shape },
    recordedAt: now.toISOString(),
    cases: { count: run.cases.count, digest: run.cases.digest },
    metrics: run.metrics
      .map(({ key, value, samples }) => ({ key, value, samples, tolerance: carried.has(key) ? carried.get(key) : tolerance }))
      .sort(byKey),
  };
}

function metricText({ key, value, samples, tolerance }) {
  const body = JSON.stringify({ value, samples, tolerance }, null, 2).replaceAll('\n', '\n    ');
  return `    ${JSON.stringify(key)}: ${body}`;
}

export function baselineText(baseline) {
  const head = JSON.stringify(
    {
      spec: baseline.spec,
      source: { tool: baseline.source.tool, toolVersion: baseline.source.toolVersion, shape: baseline.source.shape },
      recordedAt: baseline.recordedAt,
      cases: { count: baseline.cases.count, digest: baseline.cases.digest },
    },
    null,
    2,
  );
  const metrics = [...baseline.metrics].sort(byKey).map(metricText).join(',\n');
  return jsonSafe(`${head.slice(0, -2)},\n  "metrics": {\n${metrics}\n  }\n}\n`);
}

export function isUnchanged(previous, next) {
  const stamp = { recordedAt: next.recordedAt, source: { ...previous.source, toolVersion: next.source.toolVersion } };
  return baselineText({ ...previous, ...stamp }) === baselineText(next);
}

const valueAndSamples = ({ value, samples }) => `${formatQuantised(quantise(value))} over ${count(samples, 'sample')}`;

function movement(before, after) {
  const drop = quantise(before.value) - quantise(after.value);
  if (drop !== 0) {
    return `would ${drop > 0 ? 'fall' : 'rise'} by ${formatQuantised(Math.abs(drop))}, from ${valueAndSamples(before)} to ${valueAndSamples(after)}`;
  }
  if (before.samples !== after.samples) {
    return `would keep the value ${formatQuantised(quantise(after.value))} and go from ${count(before.samples, 'sample')} to ${count(after.samples, 'sample')}`;
  }
  return null;
}

const removedMetric = (before) =>
  `would be removed; the baseline holds ${valueAndSamples(before)}, with the tolerance ${formatQuantised(quantise(before.tolerance))}`;

function metricMovement(before, after) {
  if (before === undefined) {
    return `would be added, at ${valueAndSamples(after)}`;
  }
  return after === undefined ? removedMetric(before) : movement(before, after);
}

function metricNotes(previous, next) {
  const before = new Map(previous.metrics.map((metric) => [metric.key, metric]));
  const after = new Map(next.metrics.map((metric) => [metric.key, metric]));
  return [...new Set([...before.keys(), ...after.keys()])]
    .sort(compareText)
    .map((key) => [key, metricMovement(before.get(key), after.get(key))])
    .filter(([, text]) => text !== null)
    .map(([key, text]) => `${datum(key)}: ${text}`);
}

const casesText = ({ count: total, digest }) => `${count(total, 'case')} (digest ${digest})`;

function sourceNotes(previous, next) {
  const notes = [];
  if (previous.source.tool !== next.source.tool) {
    notes.push(`the tool would change from ${previous.source.tool} to ${next.source.tool}, so no tolerance would be carried over`);
  }
  if (previous.cases.digest !== next.cases.digest) {
    notes.push(`the cases would change from ${casesText(previous.cases)} to ${casesText(next.cases)}`);
  }
  return notes;
}

const baselineSummary = ({ metrics, cases }) => `a baseline of ${count(metrics.length, 'metric')} and ${count(cases.count, 'case')}`;

export function replaceRefusal(baselinePath, previous, next, replace) {
  if (previous === null || previous === undefined || replace) {
    return null;
  }
  return {
    reason: `${datum(baselinePath)} already holds ${baselineSummary(previous)}, recorded ${previous.recordedAt.slice(0, 10)}; this run would replace it with ${baselineSummary(next)}; pass --replace to replace it`,
    notes: [...sourceNotes(previous, next), ...metricNotes(previous, next)],
  };
}

function removeQuietly(files, path) {
  try {
    files.rmSync(path, { force: true });
  } catch {
    return;
  }
}

function createTemporary(files, temporary, text) {
  try {
    files.writeFileSync(temporary, text, { flag: 'wx', flush: true });
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      removeQuietly(files, temporary);
    }
    throw error;
  }
}

export function writeAtomically(path, text, files, suffix) {
  const temporary = `${path}.${suffix}.tmp`;
  createTemporary(files, temporary, text);
  try {
    files.renameSync(temporary, path);
  } catch (error) {
    removeQuietly(files, temporary);
    throw error;
  }
}
