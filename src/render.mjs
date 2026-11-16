import { describeFinding, describeNote } from './describe.mjs';
import { datum, printable } from './printable.mjs';
import { count, formatQuantised, quantise } from './quantise.mjs';
import { specificationVersion } from './read-baseline.mjs';

export const packageVersion = '1.0.0';

const bannerText = `evals-baseline ${packageVersion} (specification ${specificationVersion})`;

export const exitCode = { pass: 0, regression: 1, usage: 2, notEvaluated: 3 };

const advisoryFindingId = 'cases-changed';

const regressionFindingIds = new Set(['missing-metric', 'below-baseline', 'sample-count']);

function exitCodeOfFinding({ id }) {
  if (id === advisoryFindingId) {
    return exitCode.pass;
  }
  return regressionFindingIds.has(id) ? exitCode.regression : exitCode.notEvaluated;
}

function strictExitCode(findings) {
  const codes = findings.map(exitCodeOfFinding);
  if (codes.includes(exitCode.regression)) {
    return exitCode.regression;
  }
  return codes.includes(exitCode.notEvaluated) ? exitCode.notEvaluated : exitCode.pass;
}

const toolText = (tool, version) => (version === null ? `${tool} version unknown` : `${tool} ${datum(version)}`);

function dayNumber(isoDay) {
  const [year, month, day] = isoDay.split('-').map(Number);
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra;
}

function describeAge(recordedDay, today) {
  const days = dayNumber(today) - dayNumber(recordedDay);
  if (days === 0) {
    return 'the same day as';
  }
  return days > 0 ? `${count(days, 'day')} before` : `${count(-days, 'day')} after`;
}

function summaryText(findingCount, strictCode, strict) {
  if (findingCount === 0) {
    return 'evals-baseline: no findings';
  }
  const counted = `evals-baseline: ${count(findingCount, 'finding')}`;
  if (strictCode === exitCode.pass) {
    return `${counted}; warning only, exit 0 (${advisoryFindingId} never fails --strict)`;
  }
  return strict ? `${counted}; exit ${strictCode} (--strict)` : `${counted}; warning only, exit 0 (pass --strict to exit ${strictCode})`;
}

export function render(result, strict, today) {
  const { baselinePath, baseline, findings, notes } = result;
  const lines = [];
  if (baseline === null) {
    lines.push(`${bannerText} check ${datum(baselinePath)}`);
  } else {
    const described = `${toolText(baseline.source.tool, baseline.source.toolVersion)}, ${count(baseline.metrics.length, 'metric')}, ${count(baseline.cases.count, 'case')}`;
    const recordedDay = baseline.recordedAt.slice(0, 10);
    lines.push(`${bannerText} check ${datum(baselinePath)}: ${described}`);
    lines.push(`date: baseline recorded ${recordedDay}, ${describeAge(recordedDay, today)} this check on ${today}`);
  }
  const findingLines = findings.map((finding) => printable(describeFinding(finding)));
  const failingLines = findings.filter((finding) => exitCodeOfFinding(finding) !== exitCode.pass).map((finding) => printable(describeFinding(finding)));
  lines.push(...findingLines);
  lines.push(...notes.map((note) => `note: ${describeNote(note)}`));
  const strictCode = strictExitCode(findings);
  lines.push(summaryText(findings.length, strictCode, strict));
  return {
    lines: lines.map(printable),
    code: strict ? strictCode : exitCode.pass,
    findings: findingLines,
    failing: failingLines,
  };
}

export function noMetricAdvice(tool) {
  return tool === 'promptfoo'
    ? 'no named metric in this run; add "metric: <name>" to the assertions you want guarded'
    : 'no metric with a valid sample in this run';
}

export function renderShow(run, runFile) {
  const described = `${toolText(run.tool, run.toolVersion)} (${run.shape}), ${count(run.metrics.length, 'metric')}, ${count(run.cases.count, 'case')} (digest ${run.cases.digest})`;
  const lines = [`${bannerText} show ${datum(runFile)}: ${described}`];
  for (const metric of run.metrics) {
    lines.push(`metric ${datum(metric.key)}  ${formatQuantised(quantise(metric.value))}  ${count(metric.samples, 'sample')}`);
  }
  for (const { key, reason } of run.refused) {
    lines.push(`note: ${describeNote({ kind: 'refused-metric', key, reason })}`);
  }
  for (const text of run.errors) {
    lines.push(`note: ${describeNote({ kind: 'run-error', text })}`);
  }
  if (run.metrics.length === 0 && run.refused.length === 0) {
    lines.push(`note: ${noMetricAdvice(run.tool)}`);
  }
  return lines.map(printable);
}

export function renderShowRefusal(reason) {
  return [printable(`${bannerText} show: refused: ${reason}`)];
}

const notRecorded = (refused) => refused.map((refusal) => `note: ${datum(refusal.key)} not recorded: ${refusal.reason}`);

const heldTolerances = (held) =>
  held.map(({ key, tolerance }) => `note: ${datum(key)}: the baseline holds the tolerance ${formatQuantised(quantise(tolerance))}`);

export function renderRecordRefusal(reason, refused, held = [], notes = []) {
  return [
    `${bannerText} record: refused: ${reason}; nothing written`,
    ...notRecorded(refused),
    ...heldTolerances(held),
    ...notes.map((text) => `note: ${text}`),
  ].map(printable);
}

export function renderRecordUnchanged(baselinePath, previous, refused) {
  const recorded = `recorded ${previous.recordedAt.slice(0, 10)}`;
  return [
    `${bannerText} record: unchanged: ${datum(baselinePath)} already holds these values; not rewritten (${recorded})`,
    ...notRecorded(refused),
  ].map(printable);
}

export function renderRecordWritten(baselinePath, baseline, refused, replaced) {
  const described = `${count(baseline.metrics.length, 'metric')}, ${count(baseline.cases.count, 'case')}, ${toolText(baseline.source.tool, baseline.source.toolVersion)}`;
  const lines = [`${bannerText} record: wrote ${datum(baselinePath)} (${described})`, ...notRecorded(refused)];
  if (replaced.length > 0) {
    lines.push(`replaced: the previous baseline would have reported ${count(replaced.length, 'finding')} against this run:`);
    lines.push(...replaced.map((finding) => `  ${describeFinding(finding)}`));
  }
  return lines.map(printable);
}

export function renderVersion() {
  return [bannerText];
}
