import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { cli } from '../src/command.mjs';
import { readBaseline } from '../src/read-baseline.mjs';
import { promptfooFile } from './support/command.mjs';

let directory;
let runPath;

before(() => {
  directory = mkdtempSync(join(tmpdir(), 'evals-baseline-files-'));
  runPath = join(directory, 'run.json');
  writeFileSync(runPath, promptfooFile('run-good.json'));
});

after(() => {
  rmSync(directory, { recursive: true, force: true });
});

test('record writes a baseline file on disk that check then accepts, using the real file system', () => {
  const baselinePath = join(directory, 'baseline.json');
  const recorded = cli(['record', runPath, '--baseline', baselinePath, '--tolerance', '0']);
  assert.equal(recorded.code, 0);
  assert.equal(existsSync(baselinePath), true);
  assert.equal(readBaseline(readFileSync(baselinePath, 'utf8'), baselinePath).metrics.length, 2);
  const checked = cli(['check', runPath, '--baseline', baselinePath, '--strict']);
  assert.equal(checked.code, 0);
  assert.deepEqual(checked.findings, []);
  assert.equal(checked.stdout.at(-1), 'evals-baseline: no findings');
});

test('check against a baseline path that is not on disk reports no-baseline', () => {
  const missing = join(directory, 'missing.json');
  const output = cli(['check', runPath, '--baseline', missing]);
  assert.equal(output.findings.length, 1);
  assert.equal(output.findings[0].startsWith('no-baseline'), true);
  assert.equal(output.findings[0].includes(missing), true);
});

test('record into a directory that does not exist refuses with the error code, exits 3 and writes nothing', () => {
  const unwritable = join(directory, 'absent-directory', 'baseline.json');
  const output = cli(['record', runPath, '--baseline', unwritable, '--tolerance', '0']);
  assert.equal(output.code, 3);
  assert.equal(output.stdout[0].includes(unwritable), true);
  assert.equal(output.stdout[0].includes('ENOENT'), true);
  assert.equal(existsSync(join(directory, 'absent-directory')), false);
});
