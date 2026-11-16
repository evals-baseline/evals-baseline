import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { after, test } from 'node:test';
import { cli } from '../src/command.mjs';
import { applyEdits, makeScratch, plantMutation, readModule, specimensThatStillPass } from './support/mutate.mjs';
import { mutations } from './support/mutations.mjs';
import { specimenGivesExpected } from './support/specimen-run.mjs';
import { specimens } from './support/specimen-table.mjs';
import { namesForbiddenInPureModules } from './support/source.mjs';

const scratch = makeScratch();
after(() => rmSync(scratch, { recursive: true, force: true }));

const specimenById = (id) => specimens.find((specimen) => specimen.id === id);
const sourceGuardMutations = mutations.filter((mutation) => mutation.sourceGuard);
const specimenMutations = mutations.filter((mutation) => !mutation.sourceGuard);

test('the proof ran every guard of 9.1 that an argument list or a source scan can reach', () => {
  const guards = new Set(mutations.map((mutation) => /^(S\d+)-/.exec(mutation.id)[1]));
  assert.deepEqual([...guards].sort(), ['S1', 'S10', 'S11', 'S13', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']);
  assert.equal(new Set(mutations.map((mutation) => mutation.id)).size, mutations.length);
});

test('every specimen a mutation names is a specimen of the table', () => {
  for (const mutation of specimenMutations) {
    assert.equal(mutation.specimens.length > 0, true, mutation.id);
    for (const id of mutation.specimens) {
      assert.notEqual(specimenById(id), undefined, `${mutation.id} names ${id}`);
    }
  }
});

for (const mutation of specimenMutations) {
  test(`${mutation.id}: the specimens are right on the pristine source and every one of them is wrong once the check is removed`, async () => {
    for (const id of mutation.specimens) {
      assert.equal(specimenGivesExpected(cli, specimenById(id)), true, `${id} on the pristine source`);
    }
    assert.deepEqual(await specimensThatStillPass(mutation, specimens, scratch), [], 'specimens that did not notice the mutation');
  });
}

for (const mutation of sourceGuardMutations) {
  test(`${mutation.id}: the source guard is quiet on the pristine module and reports the planted clock read`, () => {
    assert.deepEqual(namesForbiddenInPureModules(readModule(mutation.module)), []);
    const mutated = applyEdits(readModule(mutation.module), mutation.edits, mutation.id);
    assert.deepEqual(namesForbiddenInPureModules(mutated), ['\\bDate\\b']);
  });
}

test('the proof can fail: a mutation that changes nothing is reported as a specimen that still passes', async () => {
  const noOp = {
    id: 'noop-mutation',
    module: 'compare',
    edits: [['  if (actual.samples < expected.samples) {', '  if (actual.samples < expected.samples) {']],
    specimens: ['S4-promptfoo-three-cases'],
  };
  assert.deepEqual(await specimensThatStillPass(noOp, specimens, scratch), ['S4-promptfoo-three-cases']);
});

test('the proof can fail: a mutation whose snippet is absent, or present twice, is refused instead of silently doing nothing', () => {
  const source = readModule('compare');
  assert.throws(() => applyEdits(source, [['this text is not in the module', 'x']], 'absent'), /occurs 0 times/);
  assert.throws(() => applyEdits(source, [['const ', 'let ']], 'twice'), /occurs \d+ times/);
  assert.throws(() => plantMutation(scratch, { id: 'absent', module: 'compare', edits: [['no such text', 'x']] }), /occurs 0 times/);
});

test('the proof can fail: a mutation that breaks the module fails to load instead of counting as a wrong answer', async () => {
  const broken = { id: 'syntax-error', module: 'compare', edits: [['export function compare(baseline, run) {', 'export function compare(baseline, run) {{{']], specimens: ['S4-promptfoo-three-cases'] };
  await assert.rejects(() => specimensThatStillPass(broken, specimens, scratch), SyntaxError);
});
