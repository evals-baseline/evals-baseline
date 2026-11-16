import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, cpSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, scratchDirectory } from './support.mjs';

const FIXTURES = join(ROOT, 'fixtures', 'promptfoo');
const PROCESS_TIMEOUT_MS = 30_000;

const SCENARIOS = [
  { name: 'a check without --strict that prints a finding', args: ['check', 'run-worse.json'], readerGone: 'stdout', code: 0 },
  { name: 'a check with --strict that finds a regression', args: ['check', 'run-worse.json', '--strict'], readerGone: 'stdout', code: 1 },
  { name: 'a check with --strict that cannot read its run', args: ['check', 'missing.json', '--strict'], readerGone: 'stdout', code: 3 },
  { name: 'a show that refuses its run', args: ['show', 'missing.json'], readerGone: 'stdout', code: 3 },
  { name: 'a usage error', args: ['check'], readerGone: 'stderr', code: 2 },
];

function runWithReaderGone({ script, args, readerGone }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: FIXTURES, stdio: ['ignore', 'pipe', 'pipe'], timeout: PROCESS_TIMEOUT_MS });
    const seen = { stdout: '', stderr: '' };
    for (const stream of ['stdout', 'stderr']) {
      if (stream === readerGone) child[stream].destroy();
      else child[stream].on('data', (chunk) => (seen[stream] += chunk));
    }
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, ...seen }));
  });
}

function runWithWriteFailure(script) {
  const readOnly = openSync(join(FIXTURES, 'run-worse.json'), 'r');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, 'check', 'run-worse.json'], { cwd: FIXTURES, stdio: ['ignore', readOnly, 'pipe'], timeout: PROCESS_TIMEOUT_MS });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      closeSync(readOnly);
      resolve({ code, stderr });
    });
  });
}

async function assertLeavesTheVerdictAlone(script) {
  for (const { name, args, readerGone, code } of SCENARIOS) {
    const outcome = await runWithReaderGone({ script, args, readerGone });
    const other = readerGone === 'stdout' ? 'stderr' : 'stdout';
    assert.deepEqual({ code: outcome.code, [other]: outcome[other] }, { code, [other]: '' }, `${name}, with the reader of ${readerGone} gone`);
  }
}

async function assertStillReportsOtherWriteErrors(script) {
  const outcome = await runWithWriteFailure(script);
  assert.notEqual(outcome.code, 0);
  assert.match(outcome.stderr, /EBADF/);
}

const assertBothGuards = async (script) => {
  await assertLeavesTheVerdictAlone(script);
  await assertStillReportsOtherWriteErrors(script);
};

function builtCopy(t) {
  const distribution = scratchDirectory(t, 'copy');
  const built = spawnSync(process.execPath, ['build/build.mjs', '--dist', distribution], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(built.status, 0, `${built.stdout}${built.stderr}`);
  return join(distribution, 'evals-baseline.mjs');
}

function copiedPackage(t) {
  const directory = scratchDirectory(t, 'planted-package');
  cpSync(join(ROOT, 'src'), join(directory, 'src'), { recursive: true });
  return join(directory, 'src', 'cli.mjs');
}

const SURFACES = [
  { surface: 'package', original: () => join(ROOT, 'src', 'cli.mjs'), duplicate: copiedPackage },
  { surface: 'copy', original: builtCopy, duplicate: builtCopy },
];

const CLOSED_READER_CHECK = /if \(error\.code !== 'EPIPE'\) \{\s*throw error;\s*\}/;
const WIRING = /^[ \t]*process\.std(?:out|err)\.on\('error', ignoreClosedReader\);\n/gm;

const PLANTS = [
  ['does not listen for a closed reader at all', (text) => text.replace(WIRING, '')],
  ['exits 0 when the reader has gone, whatever the verdict was', (text) => text.replace(CLOSED_READER_CHECK, '$&\nprocess.exit(0);')],
  ['exits 1 when the reader has gone, whatever the verdict was', (text) => text.replace(CLOSED_READER_CHECK, '$&\nprocess.exit(1);')],
  ['swallows every write error, not only a closed reader', (text) => text.replace(CLOSED_READER_CHECK, '')],
];

for (const { surface, original, duplicate } of SURFACES) {
  test(`the ${surface} exits with the verdict, and prints nothing more, when the reader of its output has gone`, async (t) => {
    await assertLeavesTheVerdictAlone(original(t));
  });

  test(`the ${surface} still fails loudly on a write error that is not a closed reader`, async (t) => {
    await assertStillReportsOtherWriteErrors(original(t));
  });

  for (const [name, plant] of PLANTS) {
    test(`goes red on the ${surface} when it ${name}, and green without it`, async (t) => {
      const planted = duplicate(t);
      const source = readFileSync(planted, 'utf8');
      const text = plant(source);
      assert.notEqual(text, source, 'the plant changed nothing');
      writeFileSync(planted, text);
      await assert.rejects(assertBothGuards(planted));
      await assertBothGuards(original(t));
    });
  }
}
