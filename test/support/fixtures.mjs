import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const fixturePath = (...parts) => join(repositoryRoot, 'fixtures', ...parts);

export const readFixtureText = (tool, file) => readFileSync(fixturePath(tool, file), 'utf8');

export function editedFixture(tool, file, edit) {
  const document = JSON.parse(readFixtureText(tool, file));
  edit(document);
  return JSON.stringify(document);
}
