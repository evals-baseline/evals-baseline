import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { readRun } from '../src/read-run.mjs';
import { baselineText, record } from '../src/record.mjs';
import { banner, deepevalFile, deepevalIo, promptfooFile, promptfooIo } from './support/command.mjs';
import { promptfooDigest, promptfooThreeCasesDigest } from './support/digests.mjs';
import { failure, fixedClock, makeIo } from './support/io.mjs';

test('record writes the baseline at the injected clock and says what it wrote', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json') }, new Date('2026-09-02T09:00:00.000Z'));
  const output = cli(['record', 'run-good.json', '--tolerance', '0'], io);
  assert.deepEqual(output, {
    stdout: [`${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, promptfoo "0.125.1")`],
    stderr: [],
    code: 0,
    findings: [],
    failing: [],
  });
  assert.deepEqual(io.writes, [['evals-baseline.json', promptfooFile('evals-baseline.json')]]);
});

test('record of a DeepEval run says the version is unknown', () => {
  const io = makeIo({ 'run-good.json': deepevalFile('run-good.json') }, new Date('2026-09-02T09:00:00.000Z'));
  assert.deepEqual(cli(['record', 'run-good.json', '--tolerance', '0'], io).stdout, [`${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, deepeval version unknown)`]);
  assert.deepEqual(io.writes, [['evals-baseline.json', deepevalFile('evals-baseline.json')]]);
});

test('record writes to the path --baseline names, and the tolerance it is given goes to every new metric', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  const output = cli(['record', 'run-good.json', '--baseline', 'suites/one.json', '--tolerance', '0.02'], io);
  assert.deepEqual(output.stdout, [`${banner} record: wrote "suites/one.json" (2 metrics, 4 cases, promptfoo "0.125.1")`]);
  assert.equal(io.writes.length, 1);
  assert.equal(io.writes[0][0], 'suites/one.json');
  const written = JSON.parse(io.writes[0][1]);
  assert.deepEqual(Object.values(written.metrics).map((metric) => metric.tolerance), [0.02, 0.02]);
  assert.equal(written.recordedAt, '2026-11-11T12:00:00.000Z');
});

test('recording the same numbers again is unchanged: nothing is written and the recorded date is kept', () => {
  const io = promptfooIo('run-good-again.json');
  const output = cli(['record', 'run-good-again.json'], io);
  assert.deepEqual(output.stdout, [`${banner} record: unchanged: "evals-baseline.json" already holds these values; not rewritten (recorded 2026-09-02)`]);
  assert.equal(output.code, 0);
  assert.deepEqual(io.writes, []);
});

test('recording the same numbers over a hand-set tolerance is unchanged again, because the tolerance is carried into the new record', () => {
  const handTuned = JSON.parse(promptfooFile('evals-baseline.json'));
  for (const metric of Object.values(handTuned.metrics)) {
    metric.tolerance = 0.02;
  }
  const io = promptfooIo('run-good-again.json', { 'evals-baseline.json': JSON.stringify(handTuned, null, 2) });
  const output = cli(['record', 'run-good-again.json'], io);
  assert.equal(output.stdout[0].startsWith(`${banner} record: unchanged: `), true);
  assert.deepEqual(io.writes, []);
});

test('with --replace, re-recording over a regression writes, and prints the findings it erases under replaced:, as the specification shows it', () => {
  const io = promptfooIo('run-worse.json');
  const output = cli(['record', 'run-worse.json', '--replace'], io);
  assert.deepEqual(output.stdout, [
    `${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, promptfoo "0.125.1")`,
    'replaced: the previous baseline would have reported 1 finding against this run:',
    '  below-baseline "agent :: accuracy": 0.75 over 4 samples is below the baseline 1 over 4 samples by 0.25, more than the tolerance 0',
  ]);
  assert.equal(output.code, 0);
  assert.equal(io.writes.length, 1);
  assert.equal(JSON.parse(io.writes[0][1]).metrics['agent :: accuracy'].value, 0.75);
});

test('replaced: counts findings in the plural and lists each one, cases-changed included', () => {
  const output = cli(['record', 'run-3tests.json', '--replace'], promptfooIo('run-3tests.json'));
  assert.deepEqual(output.stdout.slice(1), [
    'replaced: the previous baseline would have reported 3 findings against this run:',
    `  cases-changed: the baseline was recorded from 4 cases (digest ${promptfooDigest}); this run holds 3 cases (digest ${promptfooThreeCasesDigest}); re-record if the change is intended`,
    '  sample-count "agent :: accuracy": the baseline holds 4 samples and this run holds 3',
    '  sample-count "agent :: format": the baseline holds 4 samples and this run holds 3',
  ]);
});

test('a previous baseline of the other tool is replaced, its tolerance is not carried, and the mismatch is printed', () => {
  const handTuned = JSON.parse(deepevalFile('evals-baseline.json'));
  for (const metric of Object.values(handTuned.metrics)) {
    metric.tolerance = 0.3;
  }
  const io = promptfooIo('run-good.json', { 'evals-baseline.json': JSON.stringify(handTuned, null, 2) });
  const output = cli(['record', 'run-good.json', '--tolerance', '0.1', '--replace'], io);
  assert.deepEqual(output.stdout.slice(1), [
    'replaced: the previous baseline would have reported 1 finding against this run:',
    '  bad-run: "run-good.json": the baseline was recorded from deepeval (deepeval-test-run) and this file is promptfoo (promptfoo-results-3)',
  ]);
  assert.deepEqual(Object.values(JSON.parse(io.writes[0][1]).metrics).map((metric) => metric.tolerance), [0.1, 0.1]);
});

test('a previous baseline path that exists but cannot be opened refuses the record and writes nothing', () => {
  const io = promptfooIo('run-good.json', { 'evals-baseline.json': failure('EISDIR') });
  const output = cli(['record', 'run-good.json'], io);
  assert.deepEqual(output.stdout, [`${banner} record: refused: cannot read "evals-baseline.json": EISDIR; nothing written`]);
  assert.equal(output.code, 3);
  assert.deepEqual(io.writes, []);
});

test('record refuses a run with errored samples, names them, exits 3 and writes nothing, as the specification shows it', () => {
  const io = promptfooIo('run-error-one.json');
  const output = cli(['record', 'run-error-one.json'], io);
  assert.deepEqual(output, {
    stdout: [
      `${banner} record: refused: the run has errored samples ("agent": 1 errored test(s) in this run (promptfoo testErrorCount)); fix them and run the suite again; nothing written`,
    ],
    stderr: [],
    code: 3,
    findings: [],
    failing: [],
  });
  assert.deepEqual(io.writes, []);
});

test('record names every errored metric of a DeepEval run, joined with a semicolon, as Appendix B shows it for one', () => {
  const brevity =
    '"Brevity": 4 sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)';
  const output = cli(['record', 'run-score-only.json', '--baseline', 'sc.json'], makeIo({ 'run-score-only.json': deepevalFile('run-score-only.json') }));
  assert.deepEqual(output.stdout, [`${banner} record: refused: the run has errored samples (${brevity}); fix them and run the suite again; nothing written`]);
  const both = cli(['record', 'run-error-one.json'], makeIo({ 'run-error-one.json': deepevalFile('run-error-one.json') }));
  assert.match(both.stdout[0], /errored samples \("Accuracy": 1 sample\(s\) DeepEval counted as errors, [^;]*; "Format": 1 sample\(s\)/);
  assert.equal(both.code, 3);
});

test('record refuses a run with no named metric and says what to add, as the specification shows it', () => {
  const io = promptfooIo('run-unnamed.json');
  const output = cli(['record', 'run-unnamed.json'], io);
  assert.deepEqual(output.stdout, [`${banner} record: refused: no named metric in this run; add "metric: <name>" to the assertions you want guarded; nothing written`]);
  assert.equal(output.code, 3);
  assert.deepEqual(io.writes, []);
});

test('record refuses a DeepEval run with no metric sample', () => {
  const run = JSON.parse(deepevalFile('run-good.json'));
  run.metricsScores = [];
  const output = cli(['record', 'run.json'], makeIo({ 'run.json': JSON.stringify(run) }));
  assert.deepEqual(output.stdout, [`${banner} record: refused: no metric with a valid sample in this run; nothing written`]);
});

test('record refuses a run whose every metric the reader refused, and prints why under each key', () => {
  const run = JSON.parse(deepevalFile('run-inverted.json'));
  run.metricsScores = run.metricsScores.filter((entry) => entry.metric === 'Failure rate');
  const output = cli(['record', 'run.json'], makeIo({ 'run.json': JSON.stringify(run) }));
  assert.equal(output.stdout[0], `${banner} record: refused: every metric in this run was refused by the reader; nothing written`);
  assert.match(output.stdout[1], /^note: "Failure rate" not recorded: DeepEval's own verdicts contradict higher-is-better in 4 sample\(s\)/);
  assert.equal(output.code, 3);
});

test('record leaves out a metric the reader refuses and says so in a note', () => {
  const io = makeIo({ 'run-inverted.json': deepevalFile('run-inverted.json') }, new Date('2026-09-02T09:00:00.000Z'));
  const output = cli(['record', 'run-inverted.json', '--tolerance', '0'], io);
  assert.deepEqual(output.stdout, [
    `${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, deepeval version unknown)`,
    "note: \"Failure rate\" not recorded: DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only",
  ]);
  assert.deepEqual(io.writes, [['evals-baseline.json', deepevalFile('evals-baseline.json')]]);
});

test('record that finds nothing to rewrite still says which metric it leaves out', () => {
  const io = deepevalIo('run-inverted.json');
  const output = cli(['record', 'run-inverted.json'], io);
  assert.deepEqual(output.stdout, [
    `${banner} record: unchanged: "evals-baseline.json" already holds these values; not rewritten (recorded 2026-09-02)`,
    "note: \"Failure rate\" not recorded: DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only",
  ]);
  assert.equal(output.code, 0);
  assert.deepEqual(io.writes, []);
});

test('record refuses a run it cannot read with the reader reason, exit 3 and no write', () => {
  const io = makeIo({ 'hand.json': '{"accuracy": 1}' });
  const output = cli(['record', 'hand.json'], io);
  assert.deepEqual(output.stdout, [
    `${banner} record: refused: "hand.json": neither a promptfoo results file nor a DeepEval test run; top-level keys: "accuracy"; nothing written`,
  ]);
  assert.equal(output.code, 3);
  assert.deepEqual(io.writes, []);
  assert.deepEqual(cli(['record', 'missing.json'], io).stdout, [`${banner} record: refused: cannot read "missing.json": not found; nothing written`]);
});

test('record that cannot write the file says so, exits 3 and does not claim it wrote', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json'), 'write:evals-baseline.json': failure('EACCES') });
  const output = cli(['record', 'run-good.json', '--tolerance', '0'], io);
  assert.deepEqual(output.stdout, [`${banner} record: refused: cannot write "evals-baseline.json": EACCES; nothing written`]);
  assert.equal(output.code, 3);
});

test('an exception inside record or show is reported as a refusal that names it, with exit 3', () => {
  const broken = makeIo({ 'run-good.json': new TypeError('the reader broke on purpose') });
  assert.deepEqual(cli(['record', 'run-good.json'], broken).stdout, [`${banner} record: refused: internal-error: "the reader broke on purpose"; nothing written`]);
  assert.equal(cli(['record', 'run-good.json'], broken).code, 3);
  assert.deepEqual(cli(['show', 'run-good.json'], broken).stdout, [`${banner} show: refused: internal-error: "the reader broke on purpose"`]);
  assert.equal(cli(['show', 'run-good.json'], broken).code, 3);
});

test('a record followed by a check of the same run finds nothing', () => {
  const io = makeIo({ 'run-worse.json': promptfooFile('run-worse.json') });
  cli(['record', 'run-worse.json', '--tolerance', '0'], io);
  const output = cli(['check', 'run-worse.json', '--strict'], io);
  assert.equal(output.code, 0);
  assert.equal(output.stdout.at(-1), 'evals-baseline: no findings');
});

test('record and the reader agree on what was written: a baseline made from a run reads back, and the numbers are the run numbers', () => {
  const run = readRun(promptfooFile('run-worse.json'), 'run-worse.json');
  const expected = baselineText(record(run, fixedClock, 0, null));
  const io = makeIo({ 'run-worse.json': promptfooFile('run-worse.json') });
  cli(['record', 'run-worse.json', '--tolerance', '0'], io);
  assert.equal(io.writes[0][1], expected);
});
