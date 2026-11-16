import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import {
  banner,
  dateLine,
  deepevalIo,
  deHeader,
  pfHeader,
  promptfooFile,
  promptfooIo,
  strictSummary,
  warningSummary,
} from './support/command.mjs';
import { promptfooDigest, promptfooSwappedDigest, promptfooThreeCasesDigest } from './support/digests.mjs';
import { failure, makeIo } from './support/io.mjs';

test('check with a clean run prints the header, the date line and no findings, and writes nothing', () => {
  const io = promptfooIo('run-good.json');
  const output = cli(['check', 'run-good.json'], io);
  assert.deepEqual(output, { stdout: [pfHeader, dateLine, 'evals-baseline: no findings'], stderr: [], code: 0, findings: [], failing: [] });
  assert.deepEqual(io.writes, []);
});

test('check on the worse run warns by default and exits 0, as the specification shows it', () => {
  const finding = 'below-baseline "agent :: accuracy": 0.75 over 4 samples is below the baseline 1 over 4 samples by 0.25, more than the tolerance 0';
  const output = cli(['check', 'run-worse.json'], promptfooIo('run-worse.json'));
  assert.deepEqual(output, { stdout: [pfHeader, dateLine, finding, warningSummary(1)], stderr: [], code: 0, findings: [finding], failing: [finding] });
});

test('check --strict on the same run prints the same finding and exits 1', () => {
  const finding = 'below-baseline "agent :: accuracy": 0.75 over 4 samples is below the baseline 1 over 4 samples by 0.25, more than the tolerance 0';
  const output = cli(['check', 'run-worse.json', '--strict'], promptfooIo('run-worse.json'));
  assert.deepEqual(output, { stdout: [pfHeader, dateLine, finding, strictSummary(1)], stderr: [], code: 1, findings: [finding], failing: [finding] });
});

test('the flags of check can come before or after the run file', () => {
  const after = cli(['check', 'run-worse.json', '--strict'], promptfooIo('run-worse.json'));
  const before = cli(['check', '--strict', 'run-worse.json'], promptfooIo('run-worse.json'));
  assert.deepEqual(before, after);
});

test('--baseline names the baseline that is read and printed in the header', () => {
  const io = makeIo({ 'suites/one.json': promptfooFile('evals-baseline.json'), 'run-good.json': promptfooFile('run-good.json') });
  const output = cli(['check', 'run-good.json', '--baseline', 'suites/one.json'], io);
  assert.equal(output.stdout[0], `${banner} check "suites/one.json": promptfoo "0.125.1", 2 metrics, 4 cases`);
  assert.deepEqual(output.stdout.slice(2), ['evals-baseline: no findings']);
});

test('the date comes from the clock the caller gave, in UTC', () => {
  const lateEvening = new Date('2026-11-11T23:59:59.999Z');
  const output = cli(['check', 'run-good.json'], makeIo({ 'evals-baseline.json': promptfooFile('evals-baseline.json'), 'run-good.json': promptfooFile('run-good.json') }, lateEvening));
  assert.equal(output.stdout[1], dateLine);
  const nextDay = new Date('2026-11-12T00:00:00.000Z');
  const next = cli(['check', 'run-good.json'], makeIo({ 'evals-baseline.json': promptfooFile('evals-baseline.json'), 'run-good.json': promptfooFile('run-good.json') }, nextDay));
  assert.equal(next.stdout[1], 'date: baseline recorded 2026-09-02, 71 days before this check on 2026-11-12');
});

test('a baseline that does not exist is the finding no-baseline, with the header carrying the path alone', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  const finding = 'no-baseline: no baseline at "does-not-exist.json"; nothing was compared; record one with: evals-baseline record <run-file>';
  const output = cli(['check', 'run-good.json', '--baseline', 'does-not-exist.json'], io);
  assert.deepEqual(output, {
    stdout: [`${banner} check "does-not-exist.json"`, finding, warningSummary(1, 3)],
    stderr: [],
    code: 0,
    findings: [finding],
    failing: [finding],
  });
  assert.equal(cli(['check', 'run-good.json', '--baseline', 'does-not-exist.json', '--strict'], io).code, 3);
});

test('a baseline that cannot be read is the finding bad-baseline with the reader refusal, and the run is not read', () => {
  const io = makeIo({ 'evals-baseline.json': '{"spec": "1.0"}', 'hand.json': '{"accuracy": 1}' });
  const output = cli(['check', 'hand.json'], io);
  assert.deepEqual(output.stdout, [
    `${banner} check "evals-baseline.json"`,
    'bad-baseline: "evals-baseline.json": missing key "source" in the baseline',
    warningSummary(1, 3),
  ]);
  assert.equal(output.findings.length, 1);
});

test('a baseline path that exists but cannot be opened is bad-baseline and names the system error code', () => {
  const io = makeIo({ 'evals-baseline.json': failure('EISDIR'), 'run-good.json': promptfooFile('run-good.json') });
  assert.deepEqual(cli(['check', 'run-good.json'], io).stdout, [
    `${banner} check "evals-baseline.json"`,
    'bad-baseline: cannot read "evals-baseline.json": EISDIR',
    warningSummary(1, 3),
  ]);
});

test('a run file that does not exist is one bad-run finding, after the header and the date line', () => {
  const io = makeIo({ 'evals-baseline.json': promptfooFile('evals-baseline.json') });
  assert.deepEqual(cli(['check', 'missing.json'], io).stdout, [pfHeader, dateLine, 'bad-run: cannot read "missing.json": not found', warningSummary(1, 3)]);
});

test('a run file that cannot be opened is bad-run and names the system error code', () => {
  const io = promptfooIo('run-good.json', { 'a-directory': failure('EISDIR') });
  assert.equal(cli(['check', 'a-directory'], io).stdout[2], 'bad-run: cannot read "a-directory": EISDIR');
});

test('a hand-written run is one bad-run finding naming its top-level keys, as the specification shows it', () => {
  const io = promptfooIo('run-good.json', { '/tmp/hand.json': '{"accuracy": 0.99}' });
  assert.deepEqual(cli(['check', '/tmp/hand.json'], io).stdout, [
    pfHeader,
    dateLine,
    'bad-run: "/tmp/hand.json": neither a promptfoo results file nor a DeepEval test run; top-level keys: "accuracy"',
    warningSummary(1, 3),
  ]);
});

test('a run of the other tool is one bad-run finding naming both shapes, as Appendix B shows it', () => {
  const io = deepevalIo('run-good.json', { '../pf/run-good.json': promptfooFile('run-good.json') });
  assert.deepEqual(cli(['check', '../pf/run-good.json'], io).stdout, [
    deHeader,
    dateLine,
    'bad-run: "../pf/run-good.json": the baseline was recorded from deepeval (deepeval-test-run) and this file is promptfoo (promptfoo-results-3)',
    warningSummary(1, 3),
  ]);
});

test('the swapped run: cases-changed alone, printed and counted, exits 0 even under --strict, as owner decision 12B says', () => {
  const finding = `cases-changed: the baseline was recorded from 4 cases (digest ${promptfooDigest}); this run holds 4 cases (digest ${promptfooSwappedDigest}); re-record if the change is intended`;
  const summary = 'evals-baseline: 1 finding; warning only, exit 0 (cases-changed never fails --strict)';
  for (const argv of [['check', 'run-swapped.json'], ['check', 'run-swapped.json', '--strict']]) {
    assert.deepEqual(cli(argv, promptfooIo('run-swapped.json')), {
      stdout: [pfHeader, dateLine, finding, summary],
      stderr: [],
      code: 0,
      findings: [finding],
      failing: [],
    });
  }
});

test('three cases: cases-changed and a sample-count finding per metric, and strict fails only on the sample counts', () => {
  const lines = [
    `cases-changed: the baseline was recorded from 4 cases (digest ${promptfooDigest}); this run holds 3 cases (digest ${promptfooThreeCasesDigest}); re-record if the change is intended`,
    'sample-count "agent :: accuracy": the baseline holds 4 samples and this run holds 3',
    'sample-count "agent :: format": the baseline holds 4 samples and this run holds 3',
  ];
  const warned = cli(['check', 'run-3tests.json'], promptfooIo('run-3tests.json'));
  assert.deepEqual(warned.stdout, [pfHeader, dateLine, ...lines, warningSummary(3)]);
  assert.equal(warned.code, 0);
  const strict = cli(['check', 'run-3tests.json', '--strict'], promptfooIo('run-3tests.json'));
  assert.deepEqual(strict.stdout, [pfHeader, dateLine, ...lines, strictSummary(3)]);
  assert.equal(strict.code, 1);
  assert.deepEqual(strict.findings, lines);
  assert.deepEqual(strict.failing, lines.slice(1));
});

test('a metric only in the run is one note and no finding', () => {
  const output = cli(['check', 'run-extra.json', '--strict'], promptfooIo('run-extra.json'));
  assert.deepEqual(output.stdout, [pfHeader, dateLine, 'note: 1 metric(s) only in this run, not compared (rule 3): "agent :: extra"', 'evals-baseline: no findings']);
  assert.equal(output.code, 0);
  assert.deepEqual(output.findings, []);
});

test('an exception from reading or comparing is the finding internal-error with its message, and check does not throw', () => {
  const io = promptfooIo('run-good.json', { 'run-good.json': new TypeError('the reader broke on purpose') });
  const finding = 'internal-error: "the reader broke on purpose"';
  const warned = cli(['check', 'run-good.json'], io);
  assert.deepEqual(warned.stdout, [pfHeader, dateLine, finding, warningSummary(1, 3)]);
  assert.equal(warned.code, 0);
  const strict = cli(['check', 'run-good.json', '--strict'], io);
  assert.deepEqual(strict.stdout, [pfHeader, dateLine, finding, strictSummary(1, 3)]);
  assert.equal(strict.code, 3);
  assert.deepEqual(strict.failing, [finding]);
});

test('an exception thrown by something that is not an Error is still reported, as text', () => {
  const io = promptfooIo('run-good.json');
  io.readFile = (path) => {
    if (path === 'run-good.json') {
      throw 'a plain string';
    }
    return promptfooFile('evals-baseline.json');
  };
  assert.equal(cli(['check', 'run-good.json'], io).stdout[2], 'internal-error: "a plain string"');
});

test('the message of an internal error is escaped like every other line', () => {
  const io = promptfooIo('run-good.json', { 'run-good.json': new Error('bad\n::error::pwned\u001b[31m') });
  const output = cli(['check', 'run-good.json'], io);
  assert.equal(output.stdout[2], 'internal-error: "bad\\u000a::error::pwned\\u001b[31m"');
  assert.equal(output.stdout.some((line) => line.startsWith('::')), false);
});

test('every line of a check is free of control characters even when the file names and the keys are hostile', () => {
  const hostile = 'agent :: bad\n::error::pwned\u001b[31m';
  const run = JSON.parse(promptfooFile('run-good.json'));
  const metrics = run.results.prompts[0].metrics;
  for (const field of ['namedScores', 'namedScoresCount', 'namedScoreWeights']) {
    metrics[field][hostile.slice('agent :: '.length)] = metrics[field].accuracy;
  }
  const io = makeIo({ 'evals-baseline.json': promptfooFile('evals-baseline.json'), 'r\n::error::x.json': JSON.stringify(run) });
  const output = cli(['check', 'r\n::error::x.json'], io);
  assert.equal(output.stdout.includes('note: 1 metric(s) only in this run, not compared (rule 3): "agent :: bad\\u000a::error::pwned\\u001b[31m"'), true);
  for (const line of [...output.stdout, ...output.findings]) {
    assert.equal(/[\u0000-\u001f\u007f]/.test(line), false);
    assert.equal(line.startsWith('::'), false);
  }
});

test('cli has no state: the same arguments give the same result twice', () => {
  const first = cli(['check', 'run-3tests.json', '--strict'], promptfooIo('run-3tests.json'));
  const second = cli(['check', 'run-3tests.json', '--strict'], promptfooIo('run-3tests.json'));
  assert.deepEqual(first, second);
});
