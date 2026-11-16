import { readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { COMMITTED_DIRECTORY, GENERATED_SCRIPTS } from './lib/layout.mjs';
import { GUARD_COUNT, scanText } from './lib/scan.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const USAGE = 'usage: node build/guards.mjs [--dist <directory>]';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function labelOf(path) {
  const inside = relative(ROOT, path);
  return inside.startsWith('..') ? path : inside;
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function parseOptions(argv) {
  try {
    return parseArgs({ args: argv, options: { dist: { type: 'string' } }, strict: true, allowPositionals: false }).values;
  } catch {
    return null;
  }
}

function violationLines(directory) {
  return GENERATED_SCRIPTS.flatMap((name) => {
    const path = join(directory, name);
    const label = labelOf(path);
    if (!isFile(path)) return [{ file: label, text: `guard missing: ${label}: no such generated file` }];
    return scanText(readFileSync(path, 'utf8')).map(({ guard, line, message }) => ({
      file: label,
      text: `guard ${guard}: ${label}:${line}: ${message}`,
    }));
  });
}

function main(argv) {
  const options = parseOptions(argv);
  if (options === null) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const directory = resolve(options.dist ?? join(ROOT, COMMITTED_DIRECTORY));
  const violations = violationLines(directory);
  for (const { text } of violations) process.stdout.write(`${text}\n`);
  if (violations.length === 0) {
    process.stdout.write(`guards: ${plural(GUARD_COUNT, 'guard')} over ${plural(GENERATED_SCRIPTS.length, 'file')}, no violations\n`);
    return 0;
  }
  const files = new Set(violations.map(({ file }) => file));
  process.stdout.write(`guards: ${plural(violations.length, 'violation')} in ${plural(files.size, 'file')}\n`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
