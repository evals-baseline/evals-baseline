import { cli } from '../../src/command.mjs';

{
  function ignoreClosedReader(error) {
    if (error.code !== 'EPIPE') {
      throw error;
    }
  }

  process.stdout.on('error', ignoreClosedReader);
  process.stderr.on('error', ignoreClosedReader);

  const outcome = cli(process.argv.slice(2));
  for (const line of outcome.stdout) process.stdout.write(`${line}\n`);
  for (const line of outcome.stderr) process.stderr.write(`${line}\n`);
  process.exitCode = outcome.code;
}
