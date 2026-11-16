import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { banner, deepevalIo, promptfooFile, promptfooIo, usage } from './support/command.mjs';
import { failure, makeIo } from './support/io.mjs';

const refusalCode = cli(['record', 'missing.json'], makeIo()).code;

const heldNow = '"evals-baseline.json" already holds a baseline of 2 metrics and 4 cases, recorded 2026-09-02';

const declined = (notes) => ({
  stdout: [
    `${banner} record: refused: ${heldNow}; this run would replace it with a baseline of 2 metrics and 4 cases; pass --replace to replace it; nothing written`,
    ...notes,
  ],
  stderr: [],
  code: refusalCode,
  findings: [],
  failing: [],
});

const fall = (key) => `note: "${key}": would fall by 0.25, from 1 over 4 samples to 0.75 over 4 samples`;

test('record over a baseline that is already there refuses, shows the fall, exits as a refusal does and leaves the file as it was', () => {
  const io = promptfooIo('run-worse.json');
  const before = io.store.get('evals-baseline.json');
  assert.deepEqual(cli(['record', 'run-worse.json'], io), declined([fall('agent :: accuracy')]));
  assert.deepEqual(io.writes, []);
  assert.equal(io.store.get('evals-baseline.json'), before);
});

test('a DeepEval baseline is refused in the same way, and names the metric as DeepEval does', () => {
  const io = deepevalIo('run-worse.json');
  assert.deepEqual(cli(['record', 'run-worse.json'], io), declined([fall('Accuracy')]));
  assert.deepEqual(io.writes, []);
});

test('the refusal names the baseline path the command was given, not the default path', () => {
  const io = makeIo({ 'run-worse.json': promptfooFile('run-worse.json'), 'suites/one.json': promptfooFile('evals-baseline.json') });
  const output = cli(['record', 'run-worse.json', '--baseline', 'suites/one.json'], io);
  assert.equal(output.stdout[0].startsWith(`${banner} record: refused: "suites/one.json" already holds a baseline of 2 metrics and 4 cases, recorded 2026-09-02; `), true);
  assert.equal(output.code, refusalCode);
  assert.deepEqual(io.writes, []);
});

test('the refusal exits as every other refusal of record does, and not with the code of a pass', () => {
  const errored = cli(['record', 'run-error-one.json'], promptfooIo('run-error-one.json'));
  assert.notEqual(refusalCode, 0);
  assert.equal(cli(['record', 'run-worse.json'], promptfooIo('run-worse.json')).code, errored.code);
});

test('the refusal is made before the baseline is written, so a write that would fail is never tried', () => {
  const io = promptfooIo('run-worse.json', { 'write:evals-baseline.json': failure('EACCES') });
  assert.deepEqual(cli(['record', 'run-worse.json'], io), declined([fall('agent :: accuracy')]));
});

test('--replace writes the values the refusal named, and a second record of the same run then needs no flag and changes nothing', () => {
  const io = promptfooIo('run-worse.json');
  const written = cli(['record', 'run-worse.json', '--replace'], io);
  assert.equal(written.code, 0);
  assert.equal(JSON.parse(io.writes[0][1]).metrics['agent :: accuracy'].value, 0.75);
  const again = cli(['record', 'run-worse.json'], io);
  assert.equal(again.stdout[0].startsWith(`${banner} record: unchanged: `), true);
  assert.equal(io.writes.length, 1);
});

test('--replace may come before the run file or after the other flags, and means the same', () => {
  const argvs = [
    ['record', '--replace', 'run-worse.json'],
    ['record', 'run-worse.json', '--tolerance', '0', '--replace'],
    ['record', '--replace', '--baseline', 'evals-baseline.json', 'run-worse.json'],
  ];
  for (const argv of argvs) {
    const io = promptfooIo('run-worse.json');
    assert.equal(cli(argv, io).code, 0, argv.join(' '));
    assert.equal(io.writes.length, 1, argv.join(' '));
  }
});

test('--replace with no baseline there yet changes nothing: the first record writes as it did without the flag', () => {
  const plain = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  const flagged = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  const expected = cli(['record', 'run-good.json', '--tolerance', '0'], plain);
  assert.deepEqual(cli(['record', 'run-good.json', '--tolerance', '0', '--replace'], flagged), expected);
  assert.deepEqual(flagged.writes, plain.writes);
});

test('--replace lifts this refusal and no other: a baseline that cannot be read, a tolerance that conflicts and a run with errors still refuse', () => {
  const misspelt = promptfooFile('planted/baseline-misspelt-key.json');
  const unreadable = cli(['record', 'run-good.json', '--replace'], promptfooIo('run-good.json', { 'evals-baseline.json': misspelt }));
  assert.equal(unreadable.stdout[0].includes('unknown key "tolerence"'), true);
  assert.equal(unreadable.stdout[0].includes('fix it or delete it, then record again'), true);
  assert.equal(unreadable.code, refusalCode);

  const conflicting = cli(['record', 'run-good.json', '--tolerance', '0.5', '--replace'], promptfooIo('run-good.json'));
  assert.equal(conflicting.stdout[0].includes('would change the tolerance of 2 metrics that the baseline already holds'), true);
  assert.equal(conflicting.code, refusalCode);

  const errored = cli(['record', 'run-error-one.json', '--replace'], promptfooIo('run-error-one.json'));
  assert.equal(errored.stdout[0].includes('the run has errored samples'), true);
  assert.equal(errored.code, refusalCode);
});

test('--replace belongs to record: check and show refuse it, and so does a second --replace, with the usage line on stderr and exit 2', () => {
  const cases = [
    [['check', 'run-good.json', '--replace'], 'evals-baseline: --replace is not a flag of check'],
    [['show', 'run-good.json', '--replace'], 'evals-baseline: --replace is not a flag of show'],
    [['record', 'run-good.json', '--replace', '--replace'], 'evals-baseline: --replace given twice'],
  ];
  for (const [argv, problem] of cases) {
    const io = promptfooIo('run-good.json');
    assert.deepEqual(cli(argv, io), { stdout: [], stderr: [problem, usage], code: 2, findings: [], failing: [] });
    assert.deepEqual(io.writes, []);
  }
});

test('the usage line names --replace', () => {
  assert.equal(usage.endsWith('[--tolerance <n>] [--replace]'), true);
  assert.deepEqual(cli(['record'], makeIo()).stderr, [usage]);
});
