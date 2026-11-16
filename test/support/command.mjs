import assert from 'node:assert/strict';
import { specificationVersion } from '../../src/read-baseline.mjs';
import { packageVersion } from '../../src/render.mjs';
import { printable } from '../../src/printable.mjs';
import { editedFixture, readFixtureText } from './fixtures.mjs';
import { makeIo } from './io.mjs';

export const banner = `evals-baseline ${packageVersion} (specification ${specificationVersion})`;
export const usage = 'usage: evals-baseline <check|record|show> <run-file> [--baseline <path>] [--strict] [--tolerance <n>] [--replace]';
export const dateLine = 'date: baseline recorded 2026-09-02, 70 days before this check on 2026-11-11';
export const quoted = (printed) => `"${printed}"`;
export const pfHeader = `${banner} check "evals-baseline.json": promptfoo "0.125.1", 2 metrics, 4 cases`;
export const deHeader = `${banner} check "evals-baseline.json": deepeval version unknown, 2 metrics, 4 cases`;

export const promptfooFile = (file) => readFixtureText('promptfoo', file);
export const deepevalFile = (file) => readFixtureText('deepeval', file);

export const promptfooIo = (runFile, extra = {}) =>
  makeIo({ 'evals-baseline.json': promptfooFile('evals-baseline.json'), [runFile]: promptfooFile(runFile), ...extra });
export const deepevalIo = (runFile, extra = {}) =>
  makeIo({ 'evals-baseline.json': deepevalFile('evals-baseline.json'), [runFile]: deepevalFile(runFile), ...extra });

export const warningSummary = (count, code = 1) =>
  `evals-baseline: ${count} ${count === 1 ? 'finding' : 'findings'}; warning only, exit 0 (pass --strict to exit ${code})`;
export const strictSummary = (count, code = 1) => `evals-baseline: ${count} ${count === 1 ? 'finding' : 'findings'}; exit ${code} (--strict)`;

export const inversionReason =
  "DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only";
export const erroredNote = (key) => `${quoted(key)}: 1 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)`;

export const plantedNames = [
  { label: 'a name that begins with ##[', name: '##[stop-commands]tok', printed: '##\\u005bstop-commands]tok' },
  { label: 'a name with ##[ inside', name: 'a##[b', printed: 'a##\\u005bb' },
  { label: 'a name that begins with ::', name: '::error title=pwned::forged annotation', printed: '::error title=pwned::forged annotation' },
  { label: 'a name with U+0085 NEXT LINE', name: 'a\u0085b', printed: 'a\\u0085b' },
  { label: 'a name with U+2028 LINE SEPARATOR', name: 'a\u2028b', printed: 'a\\u2028b' },
  { label: 'a name with U+2029 PARAGRAPH SEPARATOR', name: 'a\u2029b', printed: 'a\\u2029b' },
  { label: 'a name with U+009B CONTROL SEQUENCE INTRODUCER', name: 'a\u009bb', printed: 'a\\u009bb' },
  { label: 'a name with U+202E RIGHT-TO-LEFT OVERRIDE', name: 'a\u202eb', printed: 'a\\u202eb' },
];

export const hostileText = 'x\u2028below-baseline Format: 0 is below the baseline 1 by 1, more than the tolerance 0\u2028\u2029\u0085\u009b\u202e##[stop-commands]tok';
export const hostilePrinted =
  'x\\u2028below-baseline Format: 0 is below the baseline 1 by 1, more than the tolerance 0\\u2028\\u2029\\u0085\\u009b\\u202e##\\u005bstop-commands]tok';

const scoresOf = (metric, scores, errors = 0) => ({ metric, scores, passes: scores.length, fails: 0, errors });

export const baselineWithMetric = (name, samples = 4) =>
  editedFixture('deepeval', 'evals-baseline.json', (baseline) => {
    baseline.metrics[name] = { value: 1, samples, tolerance: 0 };
  });

export const runWithMetric = (name, score = 1) =>
  editedFixture('deepeval', 'run-good.json', (run) => {
    run.metricsScores.push(scoresOf(name, [score, score, score, score]));
  });

export const runOfMetric = (name) =>
  editedFixture('deepeval', 'run-good.json', (run) => {
    run.metricsScores = [scoresOf(name, [1, 1, 1, 1])];
  });

export const runErroringMetric = (name) =>
  editedFixture('deepeval', 'run-good.json', (run) => {
    run.metricsScores = [scoresOf(name, [1, 1, 1], 1)];
  });

export const runRefusingMetric = (name) => readFixtureText('deepeval', 'run-inverted.json').replaceAll('"Failure rate"', () => JSON.stringify(name));

export const isEscapedCode = (codePoint) => holdsEscapedCharacter(String.fromCodePoint(codePoint));

export function splitLikePython(text) {
  const lines = text.split(/\r\n|[\n\r\v\f\u001c\u001d\u001e\u0085\u2028\u2029]/);
  if (lines.at(-1) === '') {
    lines.pop();
  }
  return lines;
}

const keyedFindingIds = ['missing-metric', 'below-baseline', 'sample-count', 'unreadable-metric'];
const plainFindingIds = ['cases-changed', 'no-baseline', 'bad-baseline', 'bad-run', 'internal-error'];
const findingStarts = [...keyedFindingIds.map((id) => `${id} `), ...plainFindingIds.map((id) => `${id}: `)];
const fixedStarts = ['evals-baseline ', 'evals-baseline: ', 'date: ', 'note: ', 'metric ', 'replaced: ', 'usage: ', ...findingStarts];

const holdsEscapedCharacter = (line) => printable(line) !== line;

const startsWithFixedWord = (line) =>
  fixedStarts.some((start) => line.startsWith(start)) || (line.startsWith('  ') && findingStarts.some((start) => line.startsWith(start, 2)));

export function assertSafeLines(lines, where = 'lines') {
  for (const line of lines) {
    const shown = `${where}: ${JSON.stringify(line)}`;
    assert.equal(holdsEscapedCharacter(line), false, `${shown} holds a character that must be escaped`);
    assert.equal(line.includes('##['), false, `${shown} holds ##[`);
    assert.equal(/^\s*:/.test(line), false, `${shown} starts with a colon`);
    assert.equal(startsWithFixedWord(line), true, `${shown} does not start with a fixed word`);
  }
  const seen = splitLikePython(lines.map((line) => `${line}\n`).join(''));
  assert.deepEqual(seen, lines, `${where}: a reader that splits lines like Python finds other lines`);
}

export function assertSafeOutput(output, where = 'output') {
  for (const stream of ['stdout', 'stderr', 'findings', 'failing']) {
    assertSafeLines(output[stream], `${where} ${stream}`);
  }
}
