import { usage } from './command.mjs';
import { promptfooDigest } from './digests.mjs';
import { hiddenSentenceInJson, hiddenSentencePrinted, instruction } from './payloads.mjs';
import { checkDay, checkDayAYearLater, expectedFor } from './specimen-run.mjs';
import { baselineWithMetrics, metricLine, readHead, showHead, wroteBaseline } from './specimen-parts.mjs';
import { specimens } from './specimen-table.mjs';

const pinned = checkDay.toISOString();
const aYearLater = checkDayAYearLater.toISOString();

const wrongAnswer = specimens.find((specimen) => specimen.id === 'S2-promptfoo-one-case-wrong');
const dateAYearLater = 'date: baseline recorded 2026-09-02, 435 days before this check on 2027-11-11';

function reportAYearLater(strict) {
  const expected = expectedFor(wrongAnswer, strict);
  return { ...expected, stdout: expected.stdout.map((line, index) => (index === 1 ? dateAYearLater : line)) };
}

const reasonLineWording = `The line before the usage line is the reference implementation's wording of why the arguments were refused. The "Exit codes" section of the specification fixes exit code 2 and sends the text to stderr, and shows only the usage line, so another implementation cannot be expected to reproduce that line.`;

const refusedArguments = (id, argv, stderr, referenceOnly) => ({
  id,
  argv,
  now: pinned,
  expected: { stdout: [], stderr, code: 2, writes: [] },
  referenceOnly,
});

const accuracyKey = 'agent :: accuracy';
const formatKey = 'agent :: format';
const hiddenRun = 'planted/run-injection-hidden-sentence.json';
const plainRun = 'planted/run-injection-plain-sentence.json';
const quoteRun = 'planted/run-injection-quote-and-backslash.json';
const writtenPath = 'planted/baseline-injection-written.json';
const hiddenKey = `agent :: ${hiddenSentencePrinted}`;
const plainKey = `agent :: ${instruction}`;
const quoteKey = `agent :: x\\u0022 is fine. ${instruction}. \\u0022y\\\\`;

const shown = (runFile, keys) => ({
  stdout: [showHead('promptfoo', runFile, 3, 4, promptfooDigest), ...keys.map((key) => metricLine(key, '1', 4))],
  stderr: [],
  code: 0,
  writes: [],
});

const baselineEntry = (key) => `    "${key}": {\n      "value": 1,\n      "samples": 4,\n      "tolerance": 0\n    }`;
const baselineHead = baselineWithMetrics('promptfoo', []).split('  "metrics": {')[0];
const writtenBaseline = `${baselineHead}  "metrics": {\n${[accuracyKey, `agent :: ${hiddenSentenceInJson}`, formatKey].map(baselineEntry).join(',\n')}\n  }\n}\n`;

const extraCases = [
  { id: 'X-injection-hidden-sentence-show', argv: ['show', hiddenRun], now: pinned, expected: shown(hiddenRun, [accuracyKey, hiddenKey, formatKey]) },
  {
    id: 'X-injection-hidden-sentence-check',
    argv: ['check', hiddenRun],
    now: pinned,
    expected: {
      stdout: [...readHead('promptfoo'), `note: 1 metric(s) only in this run, not compared (rule 3): "${hiddenKey}"`, 'evals-baseline: no findings'],
      stderr: [],
      code: 0,
      writes: [],
    },
  },
  {
    id: 'X-injection-hidden-sentence-record',
    argv: ['record', hiddenRun, '--baseline', writtenPath, '--tolerance', '0'],
    now: pinned,
    expected: { stdout: [wroteBaseline(writtenPath, 'promptfoo', 3)], stderr: [], code: 0, writes: [[writtenPath, writtenBaseline]] },
  },
  { id: 'X-injection-plain-sentence-show', argv: ['show', plainRun], now: pinned, expected: shown(plainRun, [accuracyKey, formatKey, plainKey]) },
  {
    id: 'X-injection-quote-and-backslash-show',
    argv: ['show', quoteRun],
    now: pinned,
    expected: shown(quoteRun, [accuracyKey, formatKey, quoteKey]),
  },
  { id: 'S7-promptfoo-one-case-wrong-a-year-later', argv: ['check', 'run-worse.json'], now: aYearLater, expected: reportAYearLater(false) },
  {
    id: 'S7-promptfoo-one-case-wrong-a-year-later-strict',
    argv: ['check', 'run-worse.json', '--strict'],
    now: aYearLater,
    expected: reportAYearLater(true),
  },
  {
    id: 'X-version',
    argv: ['--version'],
    now: pinned,
    expected: { stdout: ['evals-baseline 1.0.0 (specification 1.0)'], stderr: [], code: 0, writes: [] },
  },
  refusedArguments(
    'X-usage-unknown-flag',
    ['check', 'run-good.json', '--frobnicate'],
    ['evals-baseline: unknown flag "--frobnicate"', usage],
    reasonLineWording,
  ),
  refusedArguments(
    'X-usage-tolerance-not-a-number',
    ['record', 'run-good.json', '--tolerance', 'abc'],
    ['evals-baseline: --tolerance needs a number of at least 0, got "abc"', usage],
    reasonLineWording,
  ),
];

export const extraRows = extraCases.map(({ id, argv, now, referenceOnly }) => ({ id, dir: 'fixtures/promptfoo', argv, now, referenceOnly }));
export const extraExpectations = new Map(extraCases.map(({ id, expected }) => [id, expected]));
