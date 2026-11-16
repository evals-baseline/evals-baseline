import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { assertSafeOutput, banner, deepevalFile, deepevalIo, hostilePrinted, hostileText, plantedNames, promptfooFile, promptfooIo, quoted } from './support/command.mjs';
import { makeIo } from './support/io.mjs';

const refusalOf = (reason) => `${banner} record: refused: ${reason}; nothing written`;

const unset = (metrics) =>
  refusalOf(`no tolerance was given for ${metrics}, and a tolerance of 0 reports a fall of any size; pass --tolerance <n> to set one, or --tolerance 0 to accept 0`);

const conflict = (flag, metrics) =>
  refusalOf(`--tolerance ${flag} would change the tolerance of ${metrics} that the baseline already holds, and record keeps those; edit them in the baseline, or leave --tolerance out`);

const heldNote = (key, tolerance) => `note: ${quoted(key)}: the baseline holds the tolerance ${tolerance}`;

const baselineHolding = (read, tolerances) => {
  const baseline = JSON.parse(read('evals-baseline.json'));
  for (const [key, tolerance] of Object.entries(tolerances)) {
    baseline.metrics[key].tolerance = tolerance;
  }
  return JSON.stringify(baseline, null, 2);
};

const promptfooHolding = (tolerances) => baselineHolding(promptfooFile, tolerances);
const deepevalHolding = (tolerances) => baselineHolding(deepevalFile, tolerances);

const writtenTolerances = (io) => Object.values(JSON.parse(io.writes[0][1]).metrics).map((metric) => metric.tolerance);

function assertRefused(output, lines) {
  assert.deepEqual(output.stdout, lines);
  assert.deepEqual(output.stderr, []);
  assert.equal(output.code, 3);
  assertSafeOutput(output);
}

const tools = [
  { tool: 'promptfoo', file: promptfooFile, io: promptfooIo, holding: promptfooHolding, keys: ['agent :: accuracy', 'agent :: format'] },
  { tool: 'deepeval', file: deepevalFile, io: deepevalIo, holding: deepevalHolding, keys: ['Accuracy', 'Format'] },
];

for (const { tool, file, io, holding, keys } of tools) {
  const [accuracy, format] = keys;
  const freshPath = () => makeIo({ 'run-good.json': file('run-good.json') });
  const overHolding = (tolerances) => io('run-good-again.json', { 'evals-baseline.json': holding(tolerances) });

  test(`${tool}: record into a path with no baseline and no --tolerance refuses, counts the metrics that have none, exits 3 and writes nothing`, () => {
    const files = freshPath();
    assertRefused(cli(['record', 'run-good.json'], files), [unset('2 metrics')]);
    assert.deepEqual(files.writes, []);
    assert.equal(files.store.has('evals-baseline.json'), false);
  });

  test(`${tool}: --tolerance 0 is a tolerance given, so record writes a baseline that holds 0`, () => {
    const files = freshPath();
    const output = cli(['record', 'run-good.json', '--tolerance', '0'], files);
    assert.equal(output.code, 0);
    assert.equal(output.stdout[0].startsWith(`${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, `), true);
    assert.deepEqual(writtenTolerances(files), [0, 0]);
  });

  test(`${tool}: --tolerance 0.05 over a path with no baseline writes 0.05 for every metric`, () => {
    const files = freshPath();
    assert.equal(cli(['record', 'run-good.json', '--tolerance', '0.05'], files).code, 0);
    assert.deepEqual(writtenTolerances(files), [0.05, 0.05]);
  });

  test(`${tool}: --tolerance that differs from the tolerance a baseline holds refuses, names each held tolerance, exits 3 and leaves the baseline alone`, () => {
    const files = overHolding({ [accuracy]: 0.02, [format]: 0.01 });
    const before = files.store.get('evals-baseline.json');
    assertRefused(cli(['record', 'run-good-again.json', '--tolerance', '0.05'], files), [
      conflict('0.05', '2 metrics'),
      heldNote(accuracy, '0.02'),
      heldNote(format, '0.01'),
    ]);
    assert.deepEqual(files.writes, []);
    assert.equal(files.store.get('evals-baseline.json'), before);
  });

  test(`${tool}: --tolerance equal to every held tolerance is accepted, and over identical numbers record says unchanged`, () => {
    const files = overHolding({ [accuracy]: 0.02, [format]: 0.02 });
    const output = cli(['record', 'run-good-again.json', '--tolerance', '0.02'], files);
    assert.deepEqual(output.stdout, [`${banner} record: unchanged: "evals-baseline.json" already holds these values; not rewritten (recorded 2026-09-02)`]);
    assert.equal(output.code, 0);
    assert.deepEqual(files.writes, []);
  });

  test(`${tool}: a previous baseline of the other tool holds nothing for this run, so no --tolerance refuses and --tolerance with --replace writes`, () => {
    const otherHolding = tool === 'promptfoo' ? deepevalHolding({ Accuracy: 0.3, Format: 0.3 }) : promptfooHolding({ 'agent :: accuracy': 0.3, 'agent :: format': 0.3 });
    const refusing = io('run-good.json', { 'evals-baseline.json': otherHolding });
    assertRefused(cli(['record', 'run-good.json'], refusing), [unset('2 metrics')]);
    assert.deepEqual(refusing.writes, []);
    const writing = io('run-good.json', { 'evals-baseline.json': otherHolding });
    assert.equal(cli(['record', 'run-good.json', '--tolerance', '0.1', '--replace'], writing).code, 0);
    assert.deepEqual(writtenTolerances(writing), [0.1, 0.1]);
  });
}

test('record over a baseline that holds every metric of the run needs no --tolerance, and keeps what it holds, zero or not', () => {
  const zeros = promptfooIo('run-good-again.json');
  assert.equal(cli(['record', 'run-good-again.json'], zeros).stdout[0].startsWith(`${banner} record: unchanged: `), true);
  assert.deepEqual(zeros.writes, []);
  const tuned = promptfooIo('run-worse.json', { 'evals-baseline.json': promptfooHolding({ 'agent :: accuracy': 0.05, 'agent :: format': 0.01 }) });
  assert.equal(cli(['record', 'run-worse.json', '--replace'], tuned).code, 0);
  assert.deepEqual(writtenTolerances(tuned), [0.05, 0.01]);
});

test('--tolerance that equals one held tolerance and differs from another refuses for the one metric, spelt in the singular', () => {
  const files = promptfooIo('run-good-again.json', { 'evals-baseline.json': promptfooHolding({ 'agent :: accuracy': 0.3, 'agent :: format': 0.01 }) });
  assertRefused(cli(['record', 'run-good-again.json', '--tolerance', '0.3'], files), [conflict('0.3', '1 metric'), heldNote('agent :: format', '0.01')]);
  assert.deepEqual(files.writes, []);
});

test('--tolerance is compared with a held tolerance in millionths, and printed in millionths', () => {
  const files = promptfooIo('run-good-again.json', { 'evals-baseline.json': promptfooHolding({ 'agent :: accuracy': 0.05, 'agent :: format': 0.05 }) });
  assert.equal(cli(['record', 'run-good-again.json', '--tolerance', '0.0500001'], files).code, 0);
  assert.deepEqual(files.writes, []);
  assertRefused(cli(['record', 'run-good-again.json', '--tolerance', '.1234567'], files), [
    conflict('0.123457', '2 metrics'),
    heldNote('agent :: accuracy', '0.05'),
    heldNote('agent :: format', '0.05'),
  ]);
  assert.deepEqual(files.writes, []);
});

test('a run with a metric that the baseline does not hold, and no --tolerance, refuses for that metric alone and writes nothing', () => {
  const files = promptfooIo('run-extra.json', { 'evals-baseline.json': promptfooHolding({ 'agent :: accuracy': 0.02, 'agent :: format': 0.02 }) });
  assertRefused(cli(['record', 'run-extra.json'], files), [unset('1 metric')]);
  assert.deepEqual(files.writes, []);
});

test('a DeepEval run with two metrics that the baseline does not hold, and no --tolerance, refuses for both', () => {
  const files = deepevalIo('run-extra.json');
  assertRefused(cli(['record', 'run-extra.json'], files), [unset('2 metrics')]);
  assert.deepEqual(files.writes, []);
});

test('a run with a new metric and a --tolerance equal to the held ones writes with --replace, and the new metric takes the tolerance given', () => {
  const files = promptfooIo('run-extra.json', { 'evals-baseline.json': promptfooHolding({ 'agent :: accuracy': 0.02, 'agent :: format': 0.02 }) });
  const output = cli(['record', 'run-extra.json', '--tolerance', '0.02', '--replace'], files);
  assert.equal(output.stdout[0], `${banner} record: wrote "evals-baseline.json" (3 metrics, 4 cases, promptfoo "0.125.1")`);
  assert.deepEqual(writtenTolerances(files), [0.02, 0.02, 0.02]);
});

test('a run with a new metric and a --tolerance that differs from the held ones refuses for the held metrics alone', () => {
  const files = promptfooIo('run-extra.json', { 'evals-baseline.json': promptfooHolding({ 'agent :: accuracy': 0.02, 'agent :: format': 0.04 }) });
  assertRefused(cli(['record', 'run-extra.json', '--tolerance', '0.3'], files), [
    conflict('0.3', '2 metrics'),
    heldNote('agent :: accuracy', '0.02'),
    heldNote('agent :: format', '0.04'),
  ]);
  assert.deepEqual(files.writes, []);
});

test('a metric of the baseline that the run lacks is not counted or named in a refusal over the tolerance', () => {
  const files = promptfooIo('run-nometric.json', { 'evals-baseline.json': promptfooHolding({ 'agent :: accuracy': 0.02, 'agent :: format': 0.04 }) });
  assertRefused(cli(['record', 'run-nometric.json', '--tolerance', '0.3'], files), [conflict('0.3', '1 metric'), heldNote('agent :: accuracy', '0.02')]);
});

test('a baseline that cannot be read is refused before the tolerance is looked at, with and without --tolerance', () => {
  const misspelt = promptfooFile('planted/baseline-misspelt-key.json');
  const reason = 'unknown key "tolerence" in metrics["agent :: accuracy"]';
  const advice = 'the existing baseline cannot be read, so recording over it would discard its tolerances; fix it or delete it, then record again';
  for (const argv of [['record', 'run-good.json'], ['record', 'run-good.json', '--tolerance', '0.1']]) {
    const files = promptfooIo('run-good.json', { 'evals-baseline.json': misspelt });
    assertRefused(cli(argv, files), [refusalOf(`"evals-baseline.json": ${reason}; ${advice}`)]);
    assert.deepEqual(files.writes, []);
  }
});

test('a run that cannot be recorded is refused for that before the tolerance is looked at', () => {
  const output = cli(['record', 'run-error-one.json'], makeIo({ 'run-error-one.json': promptfooFile('run-error-one.json') }));
  assert.equal(output.stdout.length, 1);
  assert.equal(output.stdout[0].startsWith(`${banner} record: refused: the run has errored samples (`), true);
});

const hostileKeys = [
  { label: 'a name with a sentence hidden among escapes', name: hostileText, printed: hostilePrinted },
  { label: 'a name with a double quote and a backslash', name: 'k"\\', printed: 'k\\u0022\\\\' },
  ...plantedNames,
];

for (const { label, name, printed } of hostileKeys) {
  test(`record refuses over a tolerance and prints ${label} escaped, between quotes, in its note`, () => {
    const baseline = JSON.parse(deepevalFile('evals-baseline.json'));
    baseline.metrics[name] = { value: 1, samples: 4, tolerance: 0.2 };
    baseline.metrics.Format.tolerance = 0.5;
    const run = JSON.parse(deepevalFile('run-good.json'));
    run.metricsScores[0].metric = name;
    const files = makeIo({ 'evals-baseline.json': JSON.stringify(baseline), 'run-good.json': JSON.stringify(run) });
    const output = cli(['record', 'run-good.json', '--tolerance', '0.5'], files);
    assertRefused(output, [conflict('0.5', '1 metric'), `note: ${quoted(printed)}: the baseline holds the tolerance 0.2`]);
    assert.deepEqual(files.writes, []);
  });
}
