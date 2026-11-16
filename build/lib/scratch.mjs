import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function createScratch(label) {
  const directory = mkdtempSync(join(tmpdir(), `evals-baseline-${label}-`));
  return { directory, dispose: () => rmSync(directory, { recursive: true, force: true }) };
}

export function copyDirectory(from, to) {
  cpSync(from, to, { recursive: true });
}

function filesUnder(directory, relative = '') {
  return readdirSync(join(directory, relative), { withFileTypes: true }).flatMap((entry) => {
    const path = relative === '' ? entry.name : `${relative}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(directory, path) : [path];
  });
}

export function snapshotDirectory(directory) {
  const entries = filesUnder(directory)
    .sort()
    .map((path) => [path, createHash('sha256').update(readFileSync(join(directory, path))).digest('hex')]);
  return Object.fromEntries(entries);
}
