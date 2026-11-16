import { miniSources } from './mini-sources.mjs';

const COMMAND = [
  "import { readFileSync, writeFileSync } from 'node:fs';",
  "import { specificationVersion } from './read-baseline.mjs';",
  "import { packageVersion } from './render.mjs';",
  '',
  "const USAGE = 'usage: mini <check|record> <run-file> [--baseline <path>] [--strict]';",
  "const DEFAULT_BASELINE = 'evals-baseline.json';",
  '',
  'function parse(argv) {',
  '  const [verb, ...rest] = argv;',
  '  const options = { verb, runFile: undefined, baseline: DEFAULT_BASELINE, strict: false };',
  '  for (let index = 0; index < rest.length; index += 1) {',
  "    if (rest[index] === '--strict') options.strict = true;",
  "    else if (rest[index] === '--baseline') {",
  '      options.baseline = rest[index + 1];',
  '      index += 1;',
  '    } else if (options.runFile === undefined) options.runFile = rest[index];',
  '    else return null;',
  '  }',
  "  const known = ['check', 'record'].includes(verb);",
  '  return known && options.runFile !== undefined && options.baseline !== undefined ? options : null;',
  '}',
  '',
  'const silent = (stdout, code) => ({ stdout, stderr: [], code, findings: [], failing: [] });',
  '',
  'export function cli(argv) {',
  "  if (argv[0] === '--version') return silent([`evals-baseline ${packageVersion} (specification ${specificationVersion})`], 0);",
  '  const options = parse(argv);',
  '  if (options === null) return { stdout: [], stderr: [USAGE], code: 2, findings: [], failing: [] };',
  '  const today = new Date().toISOString().slice(0, 10);',
  "  if (options.verb === 'record') {",
  "    const record = { recordedAt: new Date().toISOString(), run: readFileSync(options.runFile, 'utf8') };",
  '    writeFileSync(options.baseline, `${JSON.stringify(record)}\\n`);',
  '    return silent([`mini record: wrote ${options.baseline} on ${today}`], 0);',
  '  }',
  "  const lines = readFileSync(options.runFile, 'utf8').split('\\n');",
  "  const findings = lines.filter((line) => line.startsWith('finding ') || line.startsWith('soft '));",
  "  const echoed = lines.filter((line) => line.startsWith('echo ')).map((line) => line.slice(5));",
  "  const failing = findings.filter((line) => line.startsWith('finding '));",
  "  const plural = findings.length === 1 ? 'finding' : 'findings';",
  '  const stops = options.strict && failing.length > 0;',
  '  const summary = findings.length === 0',
  "    ? 'evals-baseline: no findings'",
  "    : stops ? `evals-baseline: ${findings.length} ${plural}; exit 1 (--strict)` : `evals-baseline: ${findings.length} ${plural}; warning only, exit 0 (pass --strict to exit 1)`;",
  '  return {',
  '    stdout: [`mini check ${options.baseline} on ${today}`, ...echoed, ...findings, summary],',
  '    stderr: [],',
  '    code: stops ? 1 : 0,',
  '    findings,',
  '    failing,',
  '  };',
  '}',
  '',
].join('\n');

const BIN = [
  '#!/usr/bin/env node',
  "import { cli } from './command.mjs';",
  '',
  'const outcome = cli(process.argv.slice(2));',
  'for (const line of outcome.stdout) process.stdout.write(`${line}\\n`);',
  'for (const line of outcome.stderr) process.stderr.write(`${line}\\n`);',
  'process.exitCode = outcome.code;',
  '',
].join('\n');

export const miniToolSources = () => ({ ...miniSources(), command: COMMAND, cli: BIN });

export const MINI_FIXTURES = {
  'fixtures/mini/run-clean.txt': 'nothing wrong\n',
  'fixtures/mini/run-findings.txt': 'finding agent :: accuracy: 0.75 is below the baseline 1\nfinding agent :: format: missing\n',
  'fixtures/mini/run-soft.txt': 'soft cases-changed: the baseline was recorded from 4 cases\n',
  'fixtures/mini/run-mixed.txt': 'soft cases-changed: the baseline was recorded from 4 cases\nfinding agent :: accuracy: 0.75 is below the baseline 1\n',
  'fixtures/mini/run-escapes.txt': 'finding agent :: 100% done: a,b\r\n',
  'fixtures/mini/-dash.txt': 'nothing wrong\n',
  'fixtures/mini/run-hostile.txt': 'echo ::error::pwned\necho ##[add-mask]secret\nfinding agent :: accuracy: 0.75 is below the baseline 1\n',
};

export const MINI_DIRECTORY = 'fixtures/mini';
export const MINI_DEFAULT_BASELINE = 'evals-baseline.json';
export const MINI_INSTANTS = ['2001-02-03T04:05:06.000Z', '2002-02-03T04:05:06.000Z'];

const reading = (run, baseline = MINI_DEFAULT_BASELINE) => ({ run, baseline });

export const MINI_CASES = [
  { id: 'clean', argv: ['check', 'run-clean.txt'], ...reading('run-clean.txt') },
  { id: 'findings', argv: ['check', 'run-findings.txt'], ...reading('run-findings.txt') },
  { id: 'findings-strict', argv: ['check', 'run-findings.txt', '--strict'], now: MINI_INSTANTS[1], ...reading('run-findings.txt') },
  { id: 'soft', argv: ['check', 'run-soft.txt'], ...reading('run-soft.txt') },
  { id: 'soft-strict', argv: ['check', 'run-soft.txt', '--strict'], ...reading('run-soft.txt') },
  { id: 'baseline-flag', argv: ['check', 'run-clean.txt', '--baseline', 'other.json'], ...reading('run-clean.txt', 'other.json') },
  { id: 'escapes', argv: ['check', 'run-escapes.txt'], ...reading('run-escapes.txt') },
  { id: 'record', argv: ['record', 'run-findings.txt'], ...reading('run-findings.txt') },
  { id: 'usage', argv: ['check'] },
  { id: 'usage-two-run-files', argv: ['check', 'run-clean.txt', 'run-soft.txt'] },
  { id: 'version', argv: ['--version'] },
];

export const miniActionYml = ({ baseline = MINI_DEFAULT_BASELINE, strict = 'false' } = {}) =>
  [
    'name: mini',
    'description: The mini tool.',
    'inputs:',
    '  run-file:',
    '    required: true',
    '  baseline:',
    `    default: ${baseline}`,
    '  strict:',
    `    default: '${strict}'`,
    'outputs:',
    '  findings:',
    '    description: The number of findings, as a string.',
    'runs:',
    '  using: node24',
    '  main: dist/action.mjs',
    '',
  ].join('\n');

const USAGE_RESULT = '{ stdout: [], stderr: [USAGE], code: 2,';
const STDOUT_TAIL = '...findings, summary]';
const BEFORE_OPTIONS = 'const options = parse(argv);';
const BEFORE_STOPS = 'const stops = options.strict';
const FS = "process.getBuiltinModule('node:fs')";
const HEADER = '`mini check ${options.baseline} on ${today}`';
const before = (spot, statement) => [spot, `${statement} ${spot}`];

export const MINI_PLANTS = {
  usageToStdout: [USAGE_RESULT, '{ stdout: [USAGE], stderr: [], code: 2,'],
  noUsage: [USAGE_RESULT, '{ stdout: [], stderr: [], code: 2,'],
  exitTwoAsOne: ['stderr: [USAGE], code: 2,', 'stderr: [USAGE], code: 1,'],
  otherBanner: ['(specification ${specificationVersion})', '(specification v${specificationVersion})'],
  otherFinding: [STDOUT_TAIL, "...findings.map((line) => line.replace('below', 'under')), summary]"],
  shortReport: [STDOUT_TAIL, '...findings]'],
  movedHeader: [HEADER, '`mini check ${options.baseline === DEFAULT_BASELINE ? options.baseline : "moved.json"} on ${today}`'],
  otherRecord: ['JSON.stringify(record)', "JSON.stringify({ ...record, run: '' })"],
  noRecord: ['writeFileSync(options.baseline, ', 'String('],
  realClock: ['const today = new Date()', 'const today = new Date(performance.timeOrigin)'],
  leaksFile: before(BEFORE_STOPS, "writeFileSync('leak.txt', 'x');"),
  removesRunFile: before(BEFORE_STOPS, `${FS}.rmSync(options.runFile);`),
  readsBesideRepository: before(BEFORE_STOPS, `${FS}.readFileSync(new URL('../package.json', import.meta.url));`),
  noticesLeftover: before(BEFORE_STOPS, `if (${FS}.existsSync(options.baseline)) return silent(['stale baseline'], 0);`),
  throwsEarly: before(BEFORE_OPTIONS, "throw new Error('boom');"),
  killsItself: before(BEFORE_OPTIONS, "if (argv[1] === 'run-clean.txt') process.kill(process.pid, 'SIGKILL');"),
  slowForBaseline: before(BEFORE_OPTIONS, "if (argv.includes('--baseline')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);"),
  stderrToStdout: ['outcome.stderr) process.stderr.write(', 'outcome.stderr) process.stdout.write('],
  exitTwoAsOneInBin: ['process.exitCode = outcome.code;', 'process.exitCode = outcome.code === 2 ? 1 : outcome.code;'],
  exitCodePlusOne: ['process.exitCode = outcome.code;', 'process.exitCode = outcome.code + 1;'],
  stderrWithoutNewline: ['for (const line of outcome.stderr) process.stderr.write(`${line}\\n`);', "process.stderr.write(outcome.stderr.join('\\n'));"],
  stdoutWithoutNewline: ['for (const line of outcome.stdout) process.stdout.write(`${line}\\n`);', "process.stdout.write(outcome.stdout.join('\\n'));"],
};
