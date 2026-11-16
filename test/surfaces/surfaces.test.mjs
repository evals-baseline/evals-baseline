import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ACTION_FILE, COMMITTED_DIRECTORY, COPY_FILE } from '../../build/lib/layout.mjs';
import { runParity } from '../../build/lib/parity.mjs';
import { snapshotDirectory } from '../../build/lib/scratch.mjs';
import { runScript, runScriptAsync } from '../../build/lib/surfaces.mjs';
import { ROOT, runNode, scratchDirectory } from './support.mjs';

const FIRST = '2026-11-11T12:00:00.000Z';
const SECOND = '2027-11-11T12:00:00.000Z';

function script(test, name, body) {
  const directory = scratchDirectory(test, 'script');
  const path = join(directory, name);
  writeFileSync(path, body);
  return { directory, path };
}

test('runScript returns the exit code, stdout and stderr exactly as the script wrote them', (t) => {
  const { directory, path } = script(t, 'a.mjs', "process.stdout.write('out\\n'); process.stderr.write('err\\n'); process.exitCode = 3;\n");
  assert.deepEqual(runScript({ script: path, cwd: directory, instant: FIRST }), { code: 3, stdout: 'out\n', stderr: 'err\n' });
});

test('runScript passes the arguments after the script', (t) => {
  const { directory, path } = script(t, 'a.mjs', 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
  const result = runScript({ script: path, args: ['check', '--strict'], cwd: directory, instant: FIRST });
  assert.equal(result.stdout, '["check","--strict"]');
});

test('runScript runs the script in the directory it is given', (t) => {
  const { directory, path } = script(t, 'a.mjs', 'process.stdout.write(process.cwd());\n');
  assert.equal(runScript({ script: path, cwd: directory, instant: FIRST }).stdout, realpathSync(directory));
});

test('runScript freezes new Date() and Date.now() at the instant it is given', (t) => {
  const { directory, path } = script(t, 'a.mjs', 'process.stdout.write(`${new Date().toISOString()} ${Date.now()}`);\n');
  assert.equal(runScript({ script: path, cwd: directory, instant: FIRST }).stdout, `${FIRST} ${Date.parse(FIRST)}`);
  assert.equal(runScript({ script: path, cwd: directory, instant: SECOND }).stdout, `${SECOND} ${Date.parse(SECOND)}`);
});

const ADDED_BY_THE_OPERATING_SYSTEM = ['__CF_USER_TEXT_ENCODING'];

test('runScript hands the script no environment but the time zone and the frozen instant', (t) => {
  const { directory, path } = script(t, 'a.mjs', 'process.stdout.write(JSON.stringify(process.env));\n');
  const seen = JSON.parse(runScript({ script: path, cwd: directory, instant: FIRST }).stdout);
  for (const name of ADDED_BY_THE_OPERATING_SYSTEM) delete seen[name];
  assert.deepEqual(seen, { TZ: 'UTC', EVALS_BASELINE_FROZEN_INSTANT: FIRST });
});

test('runScript adds the environment it is given to the time zone and the frozen instant, hyphens in names included', (t) => {
  const { directory, path } = script(t, 'a.mjs', 'process.stdout.write(JSON.stringify(process.env));\n');
  const seen = JSON.parse(runScript({ script: path, cwd: directory, instant: FIRST, env: { 'INPUT_RUN-FILE': 'a.json', GITHUB_OUTPUT: '/tmp/out' } }).stdout);
  for (const name of ADDED_BY_THE_OPERATING_SYSTEM) delete seen[name];
  assert.deepEqual(seen, { TZ: 'UTC', EVALS_BASELINE_FROZEN_INSTANT: FIRST, 'INPUT_RUN-FILE': 'a.json', GITHUB_OUTPUT: '/tmp/out' });
});

test('runScript reports a script that throws as exit code 1 with the error on stderr', (t) => {
  const { directory, path } = script(t, 'a.mjs', "throw new Error('boom');\n");
  const result = runScript({ script: path, cwd: directory, instant: FIRST });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /boom/);
});

test('runScriptAsync returns what runScript returns for the same script, arguments, environment and instant', async (t) => {
  const bodies = [
    "process.stdout.write('out\\n'); process.stderr.write('err\\n'); process.exitCode = 3;\n",
    'process.stdout.write(`${new Date().toISOString()} ${process.cwd()} ${JSON.stringify(process.argv.slice(2))}`);\n',
    'process.stdout.write(JSON.stringify(process.env));\n',
    "throw new Error('boom');\n",
  ];
  for (const body of bodies) {
    const { directory, path } = script(t, 'a.mjs', body);
    const options = { script: path, args: ['x'], cwd: directory, instant: SECOND, env: { 'INPUT_RUN-FILE': 'a.json' } };
    assert.deepEqual(await runScriptAsync(options), runScript(options));
  }
});

test('snapshotDirectory lists every file under a directory with the hash of its bytes, in sorted order, with / in every path', (t) => {
  const directory = scratchDirectory(t, 'snapshot');
  mkdirSync(join(directory, 'nested', 'deeper'), { recursive: true });
  writeFileSync(join(directory, 'b.txt'), 'b');
  writeFileSync(join(directory, 'a.txt'), 'a');
  writeFileSync(join(directory, 'nested', 'deeper', 'c.txt'), 'c');
  const snapshot = snapshotDirectory(directory);
  assert.deepEqual(Object.keys(snapshot), ['a.txt', 'b.txt', 'nested/deeper/c.txt']);
  assert.equal(snapshot['a.txt'], createHash('sha256').update('a').digest('hex'));
});

test('snapshotDirectory changes for exactly the file whose bytes changed, and for a file added', (t) => {
  const directory = scratchDirectory(t, 'snapshot');
  writeFileSync(join(directory, 'a.txt'), 'a');
  writeFileSync(join(directory, 'b.txt'), 'b');
  const first = snapshotDirectory(directory);
  writeFileSync(join(directory, 'a.txt'), 'changed');
  writeFileSync(join(directory, 'c.txt'), 'c');
  const second = snapshotDirectory(directory);
  assert.notEqual(second['a.txt'], first['a.txt']);
  assert.equal(second['b.txt'], first['b.txt']);
  assert.deepEqual(Object.keys(second), ['a.txt', 'b.txt', 'c.txt']);
});

test('the package binary, the copied file and the Action each give every conformance vector its stdout, stderr, exit code and files', async () => {
  const { ok, lines } = await runParity({ root: ROOT, distDir: join(ROOT, COMMITTED_DIRECTORY) });
  assert.equal(ok, true, lines.join('\n'));
});

const today = () => new Date().toISOString().slice(0, 10);
const DATE_OF_CHECK = /^date: .* this check on (\d{4}-\d{2}-\d{2})$/m;

const REAL_ENTRY_POINTS = [
  ['the package binary', ['src/cli.mjs', 'check', 'run-worse.json'], {}],
  ['the copied file', [`${COMMITTED_DIRECTORY}/${COPY_FILE}`, 'check', 'run-worse.json'], {}],
  ['the Action', [`${COMMITTED_DIRECTORY}/${ACTION_FILE}`], { 'INPUT_RUN-FILE': 'run-worse.json' }],
];

for (const [name, [entry, ...args], inputs] of REAL_ENTRY_POINTS) {
  test(`${name} dates a check with the real clock, as the UTC calendar day it runs on`, (t) => {
    const directory = scratchDirectory(t, 'real-clock');
    cpSync(join(ROOT, 'fixtures', 'promptfoo'), directory, { recursive: true });
    const before = today();
    const result = runNode([join(ROOT, entry), ...args], { cwd: directory, env: { PATH: process.env.PATH, ...inputs } });
    const after = today();
    const printed = DATE_OF_CHECK.exec(result.stdout)?.[1];
    assert.equal([before, after].includes(printed), true, `${printed} is neither ${before} nor ${after}:\n${result.output}`);
  });
}
