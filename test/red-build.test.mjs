import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { banner } from './support/render.mjs';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(repositoryRoot, 'src', 'cli.mjs');
const fixtureDirectory = join(repositoryRoot, 'fixtures', 'promptfoo');

const maskClock = (line) =>
  line.replace(/^(date: baseline recorded \S+), -?\d+ days? (?:before|after) this check on \d{4}-\d{2}-\d{2}$/, '$1, <age> this check on <today>');

function runCheck(...extraArguments) {
  const result = spawnSync(process.execPath, [cliPath, 'check', 'run-worse.json', ...extraArguments], {
    cwd: fixtureDirectory,
    encoding: 'utf8',
  });
  return {
    lines: result.stdout.split('\n').slice(0, -1).map(maskClock),
    stdoutEndsWithNewline: result.stdout.endsWith('\n'),
    stderr: result.stderr,
    status: result.status,
  };
}

const header = `${banner} check "evals-baseline.json": promptfoo "0.125.1", 2 metrics, 4 cases`;
const dateLine = 'date: baseline recorded 2026-09-02, <age> this check on <today>';
const finding = 'below-baseline "agent :: accuracy": 0.75 over 4 samples is below the baseline 1 over 4 samples by 0.25, more than the tolerance 0';

test('the red-build fixture: a regressed promptfoo run warns by default and exits 0', () => {
  const outcome = runCheck();
  assert.deepEqual(outcome.lines, [
    header,
    dateLine,
    finding,
    'evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)',
  ]);
  assert.equal(outcome.stdoutEndsWithNewline, true);
  assert.equal(outcome.stderr, '');
  assert.equal(outcome.status, 0);
});

test('the red-build fixture: the same regressed run under --strict prints the same finding and exits 1', () => {
  const outcome = runCheck('--strict');
  assert.deepEqual(outcome.lines, [header, dateLine, finding, 'evals-baseline: 1 finding; exit 1 (--strict)']);
  assert.equal(outcome.stderr, '');
  assert.equal(outcome.status, 1);
});
