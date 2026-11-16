import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { COMMITTED_DIRECTORY } from './lib/layout.mjs';
import { isRefusal, runParity } from './lib/parity.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const USAGE = 'usage: node build/parity.mjs [--dist <directory>]';

function parseOptions(argv) {
  try {
    return parseArgs({ args: argv, options: { dist: { type: 'string' } }, strict: true, allowPositionals: false }).values;
  } catch {
    return null;
  }
}

async function main(argv) {
  const options = parseOptions(argv);
  if (options === null) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  try {
    const { ok, lines } = await runParity({ root: ROOT, distDir: resolve(options.dist ?? join(ROOT, COMMITTED_DIRECTORY)) });
    for (const line of lines) process.stdout.write(`${line}\n`);
    return ok ? 0 : 1;
  } catch (error) {
    if (!isRefusal(error)) throw error;
    process.stderr.write(`parity: refused: ${error.message}\n`);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
