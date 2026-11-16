import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { cli } from '../src/command.mjs';
import { writeAtomically } from '../src/record.mjs';
import { banner, promptfooFile } from './support/command.mjs';
import { repositoryRoot } from './support/fixtures.mjs';
import { failure, makeIo } from './support/io.mjs';

const root = mkdtempSync(join(tmpdir(), 'evals-baseline-write-'));
after(() => rmSync(root, { recursive: true, force: true }));

const scratch = (name) => {
  const directory = join(root, name);
  mkdirSync(directory);
  return directory;
};

const realFiles = { renameSync, rmSync, writeFileSync };

function recordingFiles(failures = {}) {
  const calls = [];
  const step = (name) => (...argumentsOfStep) => {
    calls.push([name, ...argumentsOfStep]);
    if (failures[name] !== undefined) {
      throw failures[name];
    }
  };
  return { calls, files: { writeFileSync: step('writeFileSync'), renameSync: step('renameSync'), rmSync: step('rmSync') } };
}

const stepNames = (calls) => calls.map(([name]) => name);

test('the text goes to a temporary file beside the baseline, flushed, and the file is then renamed over the baseline', () => {
  const { calls, files } = recordingFiles();
  writeAtomically('suites/evals-baseline.json', 'text', files, 4242);
  assert.deepEqual(calls, [
    ['writeFileSync', 'suites/evals-baseline.json.4242.tmp', 'text', { flag: 'wx', flush: true }],
    ['renameSync', 'suites/evals-baseline.json.4242.tmp', 'suites/evals-baseline.json'],
  ]);
});

test('a write that fails never opens the baseline, removes the temporary file and rethrows the error with its code', () => {
  const { calls, files } = recordingFiles({ writeFileSync: failure('ENOSPC') });
  assert.throws(() => writeAtomically('evals-baseline.json', 'text', files, 1), { code: 'ENOSPC' });
  assert.deepEqual(calls, [
    ['writeFileSync', 'evals-baseline.json.1.tmp', 'text', { flag: 'wx', flush: true }],
    ['rmSync', 'evals-baseline.json.1.tmp', { force: true }],
  ]);
});

test('a temporary file that was already there is not ours, so it is not removed, and the error comes back', () => {
  const { calls, files } = recordingFiles({ writeFileSync: failure('EEXIST') });
  assert.throws(() => writeAtomically('evals-baseline.json', 'text', files, 1), { code: 'EEXIST' });
  assert.deepEqual(stepNames(calls), ['writeFileSync']);
});

test('a rename that fails removes the temporary file and rethrows the error with its code', () => {
  const { calls, files } = recordingFiles({ renameSync: failure('EBUSY') });
  assert.throws(() => writeAtomically('evals-baseline.json', 'text', files, 1), { code: 'EBUSY' });
  assert.deepEqual(stepNames(calls), ['writeFileSync', 'renameSync', 'rmSync']);
  assert.deepEqual(calls[2], ['rmSync', 'evals-baseline.json.1.tmp', { force: true }]);
});

test('a removal that fails does not hide the error that came first', () => {
  const { files } = recordingFiles({ renameSync: failure('EACCES'), rmSync: failure('EPERM') });
  assert.throws(() => writeAtomically('evals-baseline.json', 'text', files, 1), { code: 'EACCES' });
  const writeFails = recordingFiles({ writeFileSync: failure('ENOSPC'), rmSync: failure('EPERM') });
  assert.throws(() => writeAtomically('evals-baseline.json', 'text', writeFails.files, 1), { code: 'ENOSPC' });
});

test('an error with no code is rethrown as it came, and the temporary file is still removed', () => {
  const boom = new Error('boom');
  const { calls, files } = recordingFiles({ writeFileSync: boom });
  assert.throws(() => writeAtomically('evals-baseline.json', 'text', files, 1), boom);
  assert.deepEqual(stepNames(calls), ['writeFileSync', 'rmSync']);
});

test('on a real file system the baseline is replaced whole and the directory holds the baseline and nothing else', () => {
  const directory = scratch('replace');
  const baseline = join(directory, 'evals-baseline.json');
  writeFileSync(baseline, 'the old baseline\n');
  writeAtomically(baseline, 'the new baseline\n', realFiles, process.pid);
  assert.equal(readFileSync(baseline, 'utf8'), 'the new baseline\n');
  assert.deepEqual(readdirSync(directory), ['evals-baseline.json']);
});

test('a baseline that is not there yet is created', () => {
  const directory = scratch('create');
  writeAtomically(join(directory, 'evals-baseline.json'), 'text', realFiles, process.pid);
  assert.deepEqual(readdirSync(directory), ['evals-baseline.json']);
});

test('a rename that cannot happen leaves what is at the path as it was and leaves no temporary file', () => {
  const directory = scratch('rename-fails');
  const occupied = join(directory, 'evals-baseline.json');
  mkdirSync(occupied);
  writeFileSync(join(occupied, 'inner.txt'), 'inner');
  assert.throws(() => writeAtomically(occupied, 'text', realFiles, process.pid), (error) => typeof error.code === 'string');
  assert.deepEqual(readdirSync(directory), ['evals-baseline.json']);
  assert.deepEqual(readdirSync(occupied), ['inner.txt']);
});

test('a directory that does not exist is an error with the system code, and nothing is created', () => {
  const missing = join(root, 'missing-directory');
  assert.throws(() => writeAtomically(join(missing, 'evals-baseline.json'), 'text', realFiles, process.pid), { code: 'ENOENT' });
  assert.equal(existsSync(missing), false);
});

const sizeLimited = { skip: process.platform === 'win32' ? 'the size limit is set through sh' : false };
const recordModule = JSON.stringify(pathToFileURL(join(repositoryRoot, 'src', 'record.mjs')).href);
const oversizedText = "'x'.repeat(5000)";

function failedWrite(body, path) {
  const script = `import { renameSync, rmSync, writeFileSync } from 'node:fs'; import { writeAtomically } from ${recordModule}; try { ${body} } catch (error) { console.log(error.code); }`;
  const command = ['-c', 'ulimit -f 1 && exec "$@"', 'sh', process.execPath, '--input-type=module', '-e', script, path];
  return spawnSync('sh', command, { encoding: 'utf8' }).stdout.trim();
}

test('under a size limit that makes a write fail part way, plain writeFileSync destroys the old file', sizeLimited, () => {
  const directory = scratch('limit-control');
  const baseline = join(directory, 'evals-baseline.json');
  writeFileSync(baseline, 'the old baseline\n');
  assert.equal(failedWrite(`writeFileSync(process.argv[1], ${oversizedText});`, baseline), 'EFBIG');
  assert.notEqual(readFileSync(baseline, 'utf8'), 'the old baseline\n');
});

test('under the same limit, writeAtomically fails the same way and leaves the old file byte for byte, with no temporary file', sizeLimited, () => {
  const directory = scratch('limit');
  const baseline = join(directory, 'evals-baseline.json');
  writeFileSync(baseline, 'the old baseline\n');
  const body = `writeAtomically(process.argv[1], ${oversizedText}, { renameSync, rmSync, writeFileSync }, process.pid);`;
  assert.equal(failedWrite(body, baseline), 'EFBIG');
  assert.equal(readFileSync(baseline, 'utf8'), 'the old baseline\n');
  assert.deepEqual(readdirSync(directory), ['evals-baseline.json']);
});

function memoryFiles(store, writeFails) {
  return {
    writeFileSync(path, text) {
      store.set(path, '');
      if (writeFails !== undefined) {
        throw failure(writeFails);
      }
      store.set(path, text);
    },
    renameSync(from, to) {
      store.set(to, store.get(from));
      store.delete(from);
    },
    rmSync(path) {
      store.delete(path);
    },
  };
}

test('record on a full disk says it could not write, and leaves neither a baseline nor a temporary file behind', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  io.writeFile = (path, text) => writeAtomically(path, text, memoryFiles(io.store, 'ENOSPC'), 99);
  const output = cli(['record', 'run-good.json', '--tolerance', '0'], io);
  assert.deepEqual(output.stdout, [`${banner} record: refused: cannot write "evals-baseline.json": ENOSPC; nothing written`]);
  assert.notEqual(output.code, 0);
  assert.equal(output.code, cli(['record', 'missing.json'], makeIo()).code);
  assert.deepEqual([...io.store.keys()], ['run-good.json']);
});

test('record through the writer puts the baseline in place with the text it would have written', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  io.writeFile = (path, text) => writeAtomically(path, text, memoryFiles(io.store), 99);
  const output = cli(['record', 'run-good.json', '--tolerance', '0'], io);
  assert.equal(output.code, 0);
  assert.equal(io.store.get('evals-baseline.json'), promptfooFile('evals-baseline.json').replace('"recordedAt": "2026-09-02T09:00:00.000Z"', '"recordedAt": "2026-11-11T12:00:00.000Z"'));
  assert.deepEqual([...io.store.keys()].sort(), ['evals-baseline.json', 'run-good.json']);
});
