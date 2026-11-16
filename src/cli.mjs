#!/usr/bin/env node
import { cli } from './command.mjs';

function ignoreClosedReader(error) {
  if (error.code !== 'EPIPE') {
    throw error;
  }
}

process.stdout.on('error', ignoreClosedReader);
process.stderr.on('error', ignoreClosedReader);

const { stdout, stderr, code } = cli(process.argv.slice(2));
for (const line of stdout) {
  process.stdout.write(`${line}\n`);
}
for (const line of stderr) {
  process.stderr.write(`${line}\n`);
}
process.exitCode = code;
