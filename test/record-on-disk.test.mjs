import assert from 'node:assert/strict';
import { chmodSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { cli } from '../src/command.mjs';
import { banner, promptfooFile } from './support/command.mjs';
import { canLimitFileSize, makeWorkspace, runCli } from './support/cli-process.mjs';
import { editedFixture } from './support/fixtures.mjs';
import { makeIo } from './support/io.mjs';

const workspace = makeWorkspace();
after(workspace.remove);

const oldBaseline = promptfooFile('evals-baseline.json');
const worseRun = promptfooFile('run-worse.json');
const refusalCode = cli(['record', 'missing.json'], makeIo()).code;
const heldNow = '"evals-baseline.json" already holds a baseline of 2 metrics and 4 cases, recorded 2026-09-02';

const filesIn = (directory) => readdirSync(directory).sort();
const baselineIn = (directory) => readFileSync(join(directory, 'evals-baseline.json'), 'utf8');
const cannotWrite = (code) => `${banner} record: refused: cannot write "evals-baseline.json": ${code}; nothing written`;

const sixtyExtraMetrics = editedFixture('promptfoo', 'run-good.json', (document) => {
  const { metrics } = document.results.prompts[0];
  for (let index = 0; index < 60; index += 1) {
    const key = `extra-${String(index).padStart(2, '0')}`;
    metrics.namedScores[key] = 4;
    metrics.namedScoresCount[key] = 4;
    metrics.namedScoreWeights[key] = 4;
  }
});

test('on a real disk, record over a baseline refuses, exits as a refusal does, and leaves the baseline byte for byte and the directory as it was', () => {
  const directory = workspace.project({ 'evals-baseline.json': oldBaseline, 'run-worse.json': worseRun });
  const output = runCli(directory, ['record', 'run-worse.json']);
  assert.deepEqual(output.stdout, [
    `${banner} record: refused: ${heldNow}; this run would replace it with a baseline of 2 metrics and 4 cases; pass --replace to replace it; nothing written`,
    'note: "agent :: accuracy": would fall by 0.25, from 1 over 4 samples to 0.75 over 4 samples',
  ]);
  assert.equal(output.code, refusalCode);
  assert.equal(baselineIn(directory), oldBaseline);
  assert.deepEqual(filesIn(directory), ['evals-baseline.json', 'run-worse.json']);
});

test('on a real disk, record --replace replaces the baseline whole and leaves no temporary file beside it', () => {
  const directory = workspace.project({ 'evals-baseline.json': oldBaseline, 'run-worse.json': worseRun });
  const output = runCli(directory, ['record', 'run-worse.json', '--replace']);
  assert.equal(output.code, 0);
  assert.equal(output.stdout[0], `${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, promptfoo "0.125.1")`);
  assert.equal(JSON.parse(baselineIn(directory)).metrics['agent :: accuracy'].value, 0.75);
  assert.deepEqual(filesIn(directory), ['evals-baseline.json', 'run-worse.json']);
});

test('on a real disk, a first record creates the baseline and leaves no temporary file beside it', () => {
  const directory = workspace.project({ 'run-worse.json': worseRun });
  assert.equal(runCli(directory, ['record', 'run-worse.json', '--tolerance', '0']).code, 0);
  assert.deepEqual(filesIn(directory), ['evals-baseline.json', 'run-worse.json']);
});

test('on a real disk, a write that runs out of room part way leaves the old baseline byte for byte, says nothing was written, and leaves no temporary file', { skip: !canLimitFileSize }, () => {
  const directory = workspace.project({ 'evals-baseline.json': oldBaseline, 'run-big.json': sixtyExtraMetrics });
  const output = runCli(directory, ['record', 'run-big.json', '--tolerance', '0', '--replace'], { fileSizeLimitInBlocks: 1 });
  assert.deepEqual(output.stdout, [cannotWrite('EFBIG')]);
  assert.equal(output.code, refusalCode);
  assert.equal(baselineIn(directory), oldBaseline);
  assert.deepEqual(filesIn(directory), ['evals-baseline.json', 'run-big.json']);
});

test('on a real disk, the same record with room to write succeeds, so the failure above came from the limit and from nothing else', { skip: !canLimitFileSize }, () => {
  const directory = workspace.project({ 'evals-baseline.json': oldBaseline, 'run-big.json': sixtyExtraMetrics });
  const output = runCli(directory, ['record', 'run-big.json', '--tolerance', '0', '--replace'], { fileSizeLimitInBlocks: 1000 });
  assert.equal(output.code, 0);
  assert.equal(Object.keys(JSON.parse(baselineIn(directory)).metrics).length, 62);
});

const canDenyEntries = process.platform !== 'win32' && process.getuid?.() !== 0;

test('on a real disk, a directory that cannot take a new file means the temporary file cannot be made: record says nothing was written and the baseline is as it was', { skip: !canDenyEntries }, () => {
  const directory = workspace.project({ 'evals-baseline.json': oldBaseline, 'run-worse.json': worseRun });
  chmodSync(directory, 0o555);
  try {
    const output = runCli(directory, ['record', 'run-worse.json', '--replace']);
    assert.deepEqual(output.stdout, [cannotWrite('EACCES')]);
    assert.equal(output.code, refusalCode);
    assert.equal(baselineIn(directory), oldBaseline);
    assert.deepEqual(filesIn(directory), ['evals-baseline.json', 'run-worse.json']);
  } finally {
    chmodSync(directory, 0o755);
  }
});
