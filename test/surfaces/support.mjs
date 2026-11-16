import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { runScript } from '../../build/lib/surfaces.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function scratchDirectory(test, label) {
  const directory = mkdtempSync(join(tmpdir(), `evals-baseline-${label}-`));
  test.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

export function runNode(args, { cwd = ROOT, env = { PATH: process.env.PATH } } = {}) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { code: result.status, stdout: result.stdout, stderr: result.stderr, output: `${result.stdout}${result.stderr}` };
}

const tail = (output) => output.trim().split('\n').slice(-6).join(' | ');

export function proveWithSpecimen({ run, plant, token }) {
  const pristine = run();
  if (pristine.code !== 0) return { ok: false, reason: `already red on the pristine copy: ${tail(pristine.output)}` };
  if (pristine.output.includes(token)) {
    return { ok: false, reason: `already prints "${token}" on the pristine copy, so the token proves nothing` };
  }
  const restore = plant();
  let planted;
  try {
    planted = run();
  } finally {
    restore();
  }
  if (planted.code === 0) return { ok: false, reason: 'stayed green on the specimen' };
  if (!planted.output.includes(token)) return { ok: false, reason: `went red for the wrong reason: ${tail(planted.output)}` };
  return { ok: true, reason: `red on the specimen (${token}), green without it` };
}

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function splitFence(stdout) {
  if (stdout === '') return { token: null, report: [], annotations: [] };
  assert.ok(stdout.endsWith('\n'), `stdout ends inside a line: ${JSON.stringify(stdout.slice(-60))}`);
  const lines = stdout.slice(0, -1).split('\n');
  const opener = /^::stop-commands::(\S+)$/.exec(lines[0]);
  assert.ok(opener, `stdout opens with ${JSON.stringify(lines[0])}, not with ::stop-commands::<token>`);
  const closerAt = lines.indexOf(`::${opener[1]}::`, 1);
  assert.notEqual(closerAt, -1, `stdout never closes the report with ::${opener[1]}::`);
  return { token: opener[1], report: lines.slice(1, closerAt), annotations: lines.slice(closerAt + 1) };
}

export function runAction(t, root, inputs, options = {}) {
  const { cwd = join(root, 'fixtures', 'mini'), instant = '2026-11-11T12:00:00.000Z', withOutput = true, env = {} } = options;
  const outputFile = join(scratchDirectory(t, 'github-output'), 'out');
  writeFileSync(outputFile, '');
  const variables = Object.fromEntries(Object.entries(inputs).map(([name, value]) => [`INPUT_${name.toUpperCase()}`, value]));
  if (withOutput) variables.GITHUB_OUTPUT = outputFile;
  const result = runScript({ script: join(root, 'dist', 'action.mjs'), cwd, instant, env: { ...variables, ...env } });
  return { ...result, ...splitFence(result.stdout), githubOutput: readFileSync(outputFile, 'utf8') };
}
