export const MINI_VERSION_LINE = 'evals-baseline 1.0.0 (specification 1.0)';

export const miniSources = () => ({
  printable: 'export const printable = (text) => text;\n',
  unreadable: 'export class Unreadable extends Error {}\n',
  digest: [
    "import { createHash } from 'node:crypto';",
    "import { Unreadable } from './unreadable.mjs';",
    '',
    "export const digestOf = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12) || Unreadable;",
    '',
  ].join('\n'),
  quantise: 'export const quantise = (value) => Math.round(value * 1000000);\n',
  direction: 'export const direction = (value) => value;\n',
  'read-run': "import { Unreadable } from './unreadable.mjs';\nexport const readRun = (text) => text || new Unreadable('empty');\n",
  'read-baseline':
    "import { Unreadable } from './unreadable.mjs';\nexport const specificationVersion = '1.0';\nexport const readBaseline = (text) => text || new Unreadable('empty');\n",
  compare: "import { quantise } from './quantise.mjs';\nexport const compare = (a, b) => quantise(a) - quantise(b);\n",
  describe: 'export const describeFinding = (finding) => `${finding.id}`;\n',
  record: "import { digestOf } from './digest.mjs';\nexport const record = (run) => digestOf(run);\n",
  render: "export const packageVersion = '1.0.0';\nexport const render = (lines) => lines.join('\\n');\n",
  command: [
    "import { readRun } from './read-run.mjs';",
    "import { specificationVersion } from './read-baseline.mjs';",
    "import { packageVersion, render } from './render.mjs';",
    '',
    'export function cli(argv) {',
    '  const version = `evals-baseline ${packageVersion} (specification ${specificationVersion})`;',
    "  const stdout = argv[0] === '--version' ? [version] : [render(argv)];",
    "  return { stdout, stderr: [], code: 0, findings: [], failing: [], run: readRun('x') };",
    '}',
    '',
  ].join('\n'),
  cli: "#!/usr/bin/env node\nimport { cli } from './command.mjs';\ncli(process.argv.slice(2));\n",
});
