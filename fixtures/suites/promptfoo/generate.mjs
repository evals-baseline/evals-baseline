import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const promptfooVersion = '0.125.1';
const suiteDirectory = dirname(fileURLToPath(import.meta.url));
const workDirectory = '/tmp/evals-baseline-promptfoo-run';

const fourCases = [
  ['France', 'Paris'],
  ['Japan', 'Tokyo'],
  ['Peru', 'Lima'],
  ['Kenya', 'Nairobi'],
];
const italy = ['Italy', 'Rome'];

const accuracy = (capital) => ({ type: 'contains', value: capital, metric: 'accuracy' });
const format = { type: 'regex', value: '^[A-Z][a-z]+$', metric: 'format' };
const bothMetrics = (capital) => [accuracy(capital), format];

const makeConfig = ({ cases = fourCases, assertions = bothMetrics, providers, prompts = ['Capital of {{country}}?'] }) => ({
  description: 'capitals',
  prompts,
  providers: providers ?? [{ id: 'file://agent.mjs', label: 'agent', config: {} }],
  tests: cases.map(([country, capital]) => ({ vars: { country }, assert: assertions(capital) })),
});

const withAgentConfig = (agentConfig) => [{ id: 'file://agent.mjs', label: 'agent', config: agentConfig }];
const wrongAboutKenya = { answers: { Kenya: 'Mombasa' } };

const hostileMetric = 'bad\n::error::pwned\u001b[31m';

const variants = {
  good: () => makeConfig({}),
  'good-again': () => makeConfig({}),
  cost: () =>
    makeConfig({
      providers: withAgentConfig({ cost: 0.002 }),
      assertions: (capital) => [
        accuracy(capital),
        { type: 'cost', metric: 'cost', weight: 0 },
        { type: 'cost', threshold: 0.003, metric: 'within-budget' },
      ],
    }),
  worse: () => makeConfig({ providers: withAgentConfig(wrongAboutKenya) }),
  nometric: () => makeConfig({ assertions: (capital) => [accuracy(capital)] }),
  extra: () => makeConfig({ assertions: (capital) => [...bothMetrics(capital), { ...accuracy(capital), type: 'icontains', metric: 'extra' }] }),
  '3tests': () => makeConfig({ cases: fourCases.slice(0, 3) }),
  swapped: () => makeConfig({ cases: [...fourCases.slice(0, 3), italy] }),
  'error-one': () => makeConfig({ providers: withAgentConfig({ failOn: 'Peru' }) }),
  unnamed: () => makeConfig({ assertions: (capital) => [{ type: 'contains', value: capital }, { type: 'regex', value: '^[A-Z][a-z]+$' }] }),
  weighted: () =>
    makeConfig({
      providers: withAgentConfig(wrongAboutKenya),
      assertions: (capital) => [accuracy(capital), { type: 'regex', value: '^[A-Z]', metric: 'accuracy', weight: 3 }, format],
    }),
  injection: () =>
    makeConfig({ assertions: (capital) => [...bothMetrics(capital), { ...accuracy(capital), type: 'icontains', metric: hostileMetric }] }),
  'two-prompts': () => makeConfig({ prompts: ['Capital of {{country}}?', 'Answer briefly: Capital of {{country}}?'] }),
  'two-providers': () =>
    makeConfig({
      providers: [
        { id: 'file://agent.mjs', label: 'agent', config: {} },
        { id: 'file://agent.mjs', label: 'agent-b', config: wrongAboutKenya },
      ],
    }),
};

const [variantName, outputArgument] = process.argv.slice(2);
if (variants[variantName] === undefined || outputArgument === undefined) {
  process.stderr.write(`usage: node generate.mjs <${Object.keys(variants).join('|')}> <output-file>\n`);
  process.exit(2);
}

rmSync(workDirectory, { recursive: true, force: true });
mkdirSync(workDirectory, { recursive: true });
copyFileSync(join(suiteDirectory, 'agent.mjs'), join(workDirectory, 'agent.mjs'));
writeFileSync(join(workDirectory, 'promptfooconfig.json'), JSON.stringify(variants[variantName](), null, 2));

const environment = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  PROMPTFOO_DISABLE_TELEMETRY: '1',
  PROMPTFOO_DISABLE_UPDATE: '1',
  PROMPTFOO_FAILED_TEST_EXIT_CODE: '0',
  PROMPTFOO_CONFIG_DIR: join(workDirectory, 'state'),
};
const run = spawnSync(
  'npx',
  ['--yes', `promptfoo@${promptfooVersion}`, 'eval', '-c', 'promptfooconfig.json', '-o', 'run.json', '--no-cache', '--no-progress-bar', '--no-table', '--no-share'],
  { cwd: workDirectory, env: environment, stdio: 'inherit' },
);
if (run.status === 0) {
  writeFileSync(resolve(outputArgument), readFileSync(join(workDirectory, 'run.json')));
}
rmSync(workDirectory, { recursive: true, force: true });
process.exitCode = run.status ?? 1;
