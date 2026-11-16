import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repositoryRoot } from './fixtures.mjs';

const cliPath = join(repositoryRoot, 'src', 'cli.mjs');

export const canLimitFileSize = process.platform !== 'win32';

export function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'evals-baseline-process-'));
  let count = 0;
  return {
    project(files) {
      count += 1;
      const directory = join(root, `project-${count}`);
      mkdirSync(directory);
      for (const [name, text] of Object.entries(files)) {
        writeFileSync(join(directory, name), text);
      }
      return directory;
    },
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}

const lines = (text) => text.split('\n').slice(0, -1);

export function runCli(directory, argv, { fileSizeLimitInBlocks } = {}) {
  const command =
    fileSizeLimitInBlocks === undefined
      ? [process.execPath, cliPath, ...argv]
      : ['sh', '-c', `ulimit -f ${fileSizeLimitInBlocks} && exec "$@"`, 'sh', process.execPath, cliPath, ...argv];
  const result = spawnSync(command[0], command.slice(1), { cwd: directory, encoding: 'utf8' });
  return { code: result.status, stdout: lines(result.stdout), stderr: lines(result.stderr) };
}
