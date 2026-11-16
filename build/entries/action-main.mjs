import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { cli } from '../../src/command.mjs';
import { actionArgv, annotations, readInputs } from './action-lib.mjs';

{
  const usageErrorCode = 2;
  const inputs = readInputs(process.env);
  const outcome = cli(actionArgv(inputs));
  if (outcome.stdout.length > 0) {
    const token = randomUUID();
    process.stdout.write(`::stop-commands::${token}\n`);
    for (const line of outcome.stdout) process.stdout.write(`${line}\n`);
    process.stdout.write(`::${token}::\n`);
  }
  for (const line of outcome.stderr) process.stderr.write(`${line}\n`);
  const commands = annotations({ findings: outcome.findings, failing: outcome.failing, code: outcome.code });
  for (const command of commands) process.stdout.write(`${command}\n`);
  if (process.env.GITHUB_OUTPUT && outcome.code !== usageErrorCode) {
    appendFileSync(process.env.GITHUB_OUTPUT, `findings=${outcome.findings.length}\n`);
  }
  process.exitCode = outcome.code;
}
