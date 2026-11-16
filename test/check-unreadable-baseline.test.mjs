import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { cli } from '../src/command.mjs';
import { banner, promptfooFile, promptfooIo } from './support/command.mjs';
import { makeWorkspace, runCli } from './support/cli-process.mjs';

const good = promptfooFile('evals-baseline.json');
const warningOnly = /^evals-baseline: 1 finding; warning only, exit 0 \(pass --strict to exit \d\)$/;

const unreadable = [
  ['a file of zero bytes, which is what a write that ran out of space leaves behind', '', 'not JSON'],
  ['a file of one empty line', '\n', 'not JSON'],
  ['a file of spaces', '          ', 'not JSON'],
  ['a file of zero bytes that a crash left at full length', '\u0000'.repeat(439), 'not JSON'],
  ['the first 100 characters of a good baseline', good.slice(0, 100), 'not JSON'],
  ['a good baseline behind a byte order mark', `\ufeff${good}`, 'not JSON'],
  ['an empty object', '{}', 'missing key "spec" in the baseline'],
  ['an empty list', '[]', 'not a JSON object'],
  ['null', 'null', 'not a JSON object'],
];

for (const [description, text, problem] of unreadable) {
  test(`check without --strict prints bad-baseline for ${description}, and says that it is a warning`, () => {
    const output = cli(['check', 'run-good.json'], promptfooIo('run-good.json', { 'evals-baseline.json': text }));
    const line = `bad-baseline: "evals-baseline.json": ${problem}`;
    assert.deepEqual(output.stdout.slice(0, 2), [`${banner} check "evals-baseline.json"`, line]);
    assert.match(output.stdout[2], warningOnly);
    assert.equal(output.stdout.length, 3);
    assert.deepEqual(output.findings, [line]);
    assert.deepEqual(output.failing, [line]);
    assert.equal(output.code, 0);
  });

  test(`check --strict fails on ${description}`, () => {
    const output = cli(['check', 'run-good.json', '--strict'], promptfooIo('run-good.json', { 'evals-baseline.json': text }));
    assert.deepEqual(output.findings, [`bad-baseline: "evals-baseline.json": ${problem}`]);
    assert.notEqual(output.code, 0);
  });
}

test('a baseline that cannot be read never makes check pass quietly: it prints a finding whatever the run holds', () => {
  for (const runFile of ['run-good.json', 'run-worse.json', 'run-nometric.json']) {
    const output = cli(['check', runFile], promptfooIo(runFile, { 'evals-baseline.json': '' }));
    assert.equal(output.findings.length, 1, runFile);
    assert.match(output.stdout.at(-1), warningOnly, runFile);
  }
});

const workspace = makeWorkspace();
after(workspace.remove);

test('on a real disk, check of a baseline of zero bytes prints bad-baseline and exits 0 without --strict, and exits with a failure code with it', () => {
  const directory = workspace.project({ 'evals-baseline.json': '', 'run-good.json': promptfooFile('run-good.json') });
  const lenient = runCli(directory, ['check', 'run-good.json']);
  assert.deepEqual(lenient.stdout.slice(0, 2), [`${banner} check "evals-baseline.json"`, 'bad-baseline: "evals-baseline.json": not JSON']);
  assert.match(lenient.stdout[2], warningOnly);
  assert.equal(lenient.code, 0);
  assert.notEqual(runCli(directory, ['check', 'run-good.json', '--strict']).code, 0);
});
