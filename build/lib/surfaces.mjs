import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FROZEN_INSTANT_VARIABLE } from './clock.mjs';

const PRELOAD_CLOCK = pathToFileURL(fileURLToPath(new URL('./preload-clock.mjs', import.meta.url))).href;
const SCRIPT_TIMEOUT_MS = 30_000;

function invocation({ script, args = [], cwd, instant, env = {} }) {
  return {
    command: process.execPath,
    argv: ['--import', PRELOAD_CLOCK, script, ...args],
    options: { cwd, env: { TZ: 'UTC', [FROZEN_INSTANT_VARIABLE]: instant, ...env }, timeout: SCRIPT_TIMEOUT_MS },
  };
}

function outcomeOf({ script, error, status, signal, stdout, stderr }) {
  if (error) throw error;
  if (status === null) throw new Error(`${script} was stopped by ${signal}`);
  return { code: status, stdout, stderr };
}

export function runScript(request) {
  const { command, argv, options } = invocation(request);
  const result = spawnSync(command, argv, { ...options, encoding: 'utf8' });
  return outcomeOf({ script: request.script, ...result });
}

export function runScriptAsync(request) {
  const { command, argv, options } = invocation(request);
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = { stdout: [], stderr: [] };
    child.stdout.on('data', (chunk) => chunks.stdout.push(chunk));
    child.stderr.on('data', (chunk) => chunks.stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (status, signal) => {
      const text = (name) => Buffer.concat(chunks[name]).toString('utf8');
      try {
        resolve(outcomeOf({ script: request.script, status, signal, stdout: text('stdout'), stderr: text('stderr') }));
      } catch (error) {
        reject(error);
      }
    });
  });
}
