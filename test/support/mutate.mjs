import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repositoryRoot } from './fixtures.mjs';
import { specimenGivesExpected } from './specimen-run.mjs';

export const makeScratch = () => mkdtempSync(join(tmpdir(), 'evals-baseline-mutation-'));

function occurrences(text, snippet) {
  return text.split(snippet).length - 1;
}

export function applyEdits(source, edits, label) {
  return edits.reduce((text, [from, to]) => {
    const found = occurrences(text, from);
    if (found !== 1) {
      throw new Error(`${label}: the snippet ${JSON.stringify(from.slice(0, 60))} occurs ${found} times in the source, not once`);
    }
    return text.replace(from, () => to);
  }, source);
}

export const readModule = (module) => readFileSync(join(repositoryRoot, 'src', `${module}.mjs`), 'utf8');

export function plantMutation(scratch, mutation) {
  const directory = join(scratch, mutation.id);
  cpSync(join(repositoryRoot, 'src'), directory, { recursive: true });
  const mutated = applyEdits(readModule(mutation.module), mutation.edits, mutation.id);
  writeFileSync(join(directory, `${mutation.module}.mjs`), mutated, 'utf8');
  return directory;
}

export async function loadCli(directory) {
  const { cli } = await import(pathToFileURL(join(directory, 'command.mjs')).href);
  return cli;
}

export async function specimensThatStillPass(mutation, specimens, scratch) {
  const cli = await loadCli(plantMutation(scratch, mutation));
  return mutation.specimens.filter((id) => specimenGivesExpected(cli, specimens.find((specimen) => specimen.id === id)));
}
