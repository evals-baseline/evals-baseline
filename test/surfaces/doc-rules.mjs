import { parseActionYml } from '../../build/lib/action-yml.mjs';
import { COMMITTED_DIRECTORY, COPY_FILE } from '../../build/lib/layout.mjs';

export const SPECIFICATION_ADDRESS = 'https://meshin.co/spec/evals-baseline/1.0';
export const CITATION = `This project guards its agent evaluations against regression as defined by the [evals-baseline specification 1.0](${SPECIFICATION_ADDRESS}).`;
export const COUNTS_LINE =
  'Counts that will not grow within 1.x: three surfaces, two readers, three verbs and one version flag, four rules, one binding check, and nine finding ids.';
export const ONE_LINE_ANSWER =
  'This is on the refusal list, which the specification fixes; changing it is a new major version of the specification, not a pull request.';
export const LEAVING_RULE = 'an entry leaves the list only by a new major version of the specification, never by a pull request.';
export const REFUSAL_HEADING = '## What this repository refuses, permanently';
export const COMMIT_PLACEHOLDER = '<full-length commit SHA>';
export const REFUSED = [
  'A hosted service, dashboard, account, database, or any network access',
  'A neutral run format, or a third reader',
  "A request to read another tool's output (Inspect, Ragas, LangSmith, Braintrust and the rest)",
  'Statistical significance, confidence intervals, retries, flaky-test handling',
  'Relative, global or auto-adjusting tolerance, or a tolerance given at check time',
  'Updating the baseline automatically, on a pass or on a fail',
  'Calling a model, a judge or any paid API',
  'Telemetry, an update check, any outbound request',
  'Pull-request comments, bots, chat messages, badges, status APIs',
  'Failing on a date, on baseline age, or on expiry',
  'Lower-is-better metrics, or a per-metric polarity setting, in 1.x',
  'A configuration file or environment variables',
  'JSON, SARIF or JUnit output of the report',
  'More than one run or suite in a baseline, merging baselines, per-branch baselines',
  'Saying which case regressed',
  'A second moving alias for the Action beyond `v1`, such as `latest` or a floating minor',
  'A `--ci`, `--fail`, `--exit-code` or similar flag that makes failure the default',
];

const COMMAND_NAME = 'evals-baseline';
const FLAGS_BY_VERB = { check: ['--baseline', '--strict'], record: ['--baseline', '--tolerance'], show: [] };
const COMMIT_PINNED_ACTION = new RegExp(`evals-baseline/evals-baseline@(?:${COMMIT_PLACEHOLDER}|[0-9a-f]{40})`);
const COMMIT_PINNED_COPY = new RegExp(
  `evals-baseline/evals-baseline/(?:${COMMIT_PLACEHOLDER}|[0-9a-f]{40})/${COMMITTED_DIRECTORY}/${COPY_FILE.replace('.', '\\.')}`,
);
const MESHIN_ADDRESS = /https?:\/\/(?:www\.)?meshin\.co[^\s)>\]'"`]*/g;
const LEFTOVER_MARKER = /\b(?:TODO|TBD|FIXME)\b/g;
const DECISION_OUTSIDE = /\bL\d{2}\b/g;
const SECTION_NUMBER = /\bsections? \d+(?:\.\d+)?/gi;
const NPM_SCRIPT = /\bnpm run ([\w:-]+)/g;
const TRAILING_PUNCTUATION = /[.,;:]+$/;
const REQUIRED_CELL = 'none, required';
const COMMAND = /^(?:npx )?(?:evals-baseline|node evals-baseline\.mjs)\s/;
const COMMAND_PARTS = /^(?:npx )?(?:evals-baseline|node evals-baseline\.mjs)\s+(\S+)(.*)$/;
const BANNER = /^(?:npx )?evals-baseline \d+\.\d+\.\d+\S* \(specification \d+\.\d+\)(?: |$)/;
const BARE_PROBLEM = 'the README shows evals-baseline without npx, which is not on the PATH after npm install --save-dev:';

const unique = (values) => [...new Set(values)];

const citationProblems = (readme) => (readme.includes(CITATION) ? [] : ['the README does not hold the citation block']);

function addressProblems(label, text) {
  return unique((text.match(MESHIN_ADDRESS) ?? []).map((address) => address.replace(TRAILING_PUNCTUATION, '')))
    .filter((address) => address !== SPECIFICATION_ADDRESS)
    .map((address) => `the ${label} holds an address on meshin.co that is not the specification's: ${address}`);
}

function installProblems(readme, packageJson) {
  const { name } = JSON.parse(packageJson);
  return readme.includes(`npm install --save-dev ${name}`) ? [] : [`the README does not hold an npm install line for ${name}`];
}

function pinProblems(readme) {
  const pinned = readme.search(COMMIT_PINNED_ACTION);
  const firstTag = readme.search(/\bv1\b/);
  return [
    pinned === -1 ? 'the README has no Action line pinned to a full-length commit SHA' : null,
    firstTag !== -1 && (pinned === -1 || firstTag < pinned) ? 'the README names the v1 tag before it names a commit' : null,
    readme.search(COMMIT_PINNED_COPY) === -1 ? 'the README has no copy line pinned to a full-length commit SHA' : null,
  ].filter((problem) => problem !== null);
}

function mentionProblems(readme) {
  const required = [
    ['contents: read', 'the README does not tell the reader to grant contents: read'],
    ['PROMPTFOO_FAILED_TEST_EXIT_CODE', 'the README does not mention PROMPTFOO_FAILED_TEST_EXIT_CODE'],
    ['if: always()', 'the README does not mention if: always()'],
  ];
  return required.filter(([text]) => !readme.includes(text)).map(([, problem]) => problem);
}

function tableRows(readme, headerPattern) {
  const lines = readme.split('\n');
  const header = lines.findIndex((line) => headerPattern.test(line));
  if (header === -1) return null;
  const rows = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(line.split('|').slice(1, -1).map((part) => part.trim()));
  }
  return rows;
}

function describeInputDifference(name, cell, declared) {
  const required = declared.required === 'true' && declared.default === undefined;
  const expected = required ? REQUIRED_CELL : `\`${declared.default}\``;
  if (cell === expected) return null;
  const readmeDefault = cell.replaceAll('`', '');
  if (required) return `the README gives the Action input ${name} the default ${readmeDefault}, and action.yml makes it required`;
  if (cell === REQUIRED_CELL) return `the README makes the Action input ${name} required, and action.yml gives it the default ${declared.default}`;
  return `the README gives the Action input ${name} the default ${readmeDefault}, and action.yml gives it ${declared.default}`;
}

function inputProblems(readme, actionYml) {
  const { inputs = {}, outputs = {} } = parseActionYml(actionYml);
  const rows = (tableRows(readme, /^\|\s*Input\s*\|\s*Default\s*\|/) ?? []).map(([name, cell]) => ({ name: name.replaceAll('`', ''), cell }));
  const listed = rows.flatMap(({ name, cell }) => {
    if (!(name in inputs)) return [`the README lists the Action input ${name}, and action.yml does not declare it`];
    return [describeInputDifference(name, cell, inputs[name])].filter((problem) => problem !== null);
  });
  const named = new Set(rows.map(({ name }) => name));
  const unlisted = Object.keys(inputs)
    .filter((name) => !named.has(name))
    .map((name) => `action.yml declares the input ${name}, and the README does not list it`);
  const outputsNotMentioned = Object.keys(outputs)
    .filter((name) => !readme.includes(`\`${name}\``))
    .map((name) => `the README does not mention the Action output ${name}`);
  return [...listed, ...unlisted, ...outputsNotMentioned];
}

function runtimeProblems(readme, actionYml) {
  const using = parseActionYml(actionYml).runs?.using;
  return using !== undefined && readme.includes(`\`${using}\``) ? [] : [`the README does not name the Action runtime ${using} that action.yml declares`];
}

function findingProblems(readme, findingIds) {
  const rows = tableRows(readme, /^\|\s*Finding\s*\|/);
  if (rows === null) return ['the README has no table of finding ids'];
  const listed = rows.map(([id]) => id.replaceAll('`', ''));
  return [
    ...findingIds.filter((id) => !listed.includes(id)).map((id) => `the tool prints the finding id ${id}, and the README table does not list it`),
    ...listed.filter((id) => !findingIds.includes(id)).map((id) => `the README table lists the finding id ${id}, and the tool never prints it`),
  ];
}

function commandsIn(readme) {
  const fenced = /^```[^\n]*\n([\s\S]*?)^```/gm;
  const lines = [...readme.matchAll(fenced)].flatMap(([, body]) => body.split('\n'));
  const spans = [...readme.replace(fenced, '').matchAll(/`([^`\n]+)`/g)].map(([, span]) => span);
  return [...lines, ...spans]
    .map((candidate) => candidate.trim().replace(/^\$ /, ''))
    .filter((candidate) => COMMAND.test(candidate) && !BANNER.test(candidate));
}

function commandProblem(command) {
  const [, verb, rest] = COMMAND_PARTS.exec(command);
  const known = Object.hasOwn(FLAGS_BY_VERB, verb);
  if (!known && verb !== '--version') return `the README shows a command with a verb that does not exist: ${command}`;
  const flags = rest.match(/--[a-z-]+/g) ?? [];
  if (known && !flags.every((flag) => FLAGS_BY_VERB[verb].includes(flag))) {
    return `the README shows a command with a flag its verb does not take: ${command}`;
  }
  return command.startsWith(`${COMMAND_NAME} `) ? `${BARE_PROBLEM} ${command}` : null;
}

const commandProblems = (readme) => commandsIn(readme).map(commandProblem).filter((problem) => problem !== null);

function nodeProblems(readme, packageJson) {
  const declared = JSON.parse(packageJson).engines?.node;
  if (declared === undefined) return ['package.json names no engines.node'];
  const said = /Node\.js (\d+) or later/.exec(readme)?.[1];
  if (said === undefined) return ['the README does not say which Node.js version it needs'];
  return declared === `>=${said}` ? [] : [`the README says Node.js ${said} or later, and package.json engines.node is ${declared}`];
}

function readmeProblems(readme, { actionYml, packageJson, findingIds }) {
  return [
    ...citationProblems(readme),
    ...addressProblems('README', readme),
    ...installProblems(readme, packageJson),
    ...pinProblems(readme),
    ...mentionProblems(readme),
    ...inputProblems(readme, actionYml),
    ...runtimeProblems(readme, actionYml),
    ...findingProblems(readme, findingIds),
    ...commandProblems(readme),
    ...nodeProblems(readme, packageJson),
  ];
}

function documentProblems(label, text) {
  const markers = unique(text.match(LEFTOVER_MARKER) ?? []).map((marker) => `the ${label} holds a leftover marker: ${marker}`);
  const outside = unique(text.match(DECISION_OUTSIDE) ?? []).map(
    (decision) => `the ${label} holds a reference to a decision outside this repository: ${decision}`,
  );
  const numbered = unique((text.match(SECTION_NUMBER) ?? []).map((citation) => citation.toLowerCase())).map(
    (citation) => `the ${label} cites "${citation}", and the published specification has no numbered sections`,
  );
  return [...markers, ...outside, ...numbered];
}

function refusalRows(contributing) {
  const lines = contributing.split('\n');
  const heading = lines.indexOf(REFUSAL_HEADING);
  if (heading === -1) return null;
  const table = [];
  for (const line of lines.slice(heading + 1)) {
    if (line.startsWith('|')) table.push(line);
    else if (table.length > 0) break;
  }
  return table.slice(2).map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function refusalProblems(contributing) {
  const rows = refusalRows(contributing);
  if (rows === null) return [`the contributing file has no heading ${REFUSAL_HEADING}`];
  if (rows.length !== REFUSED.length) {
    return [`the contributing file holds ${rows.length} refusals, and the list in doc-rules.mjs holds ${REFUSED.length}`];
  }
  return rows
    .flatMap(([refused, reason], index) => [
      refused === REFUSED[index]
        ? null
        : `refusal ${index + 1} of the contributing file is "${refused}", and doc-rules.mjs has "${REFUSED[index]}"`,
      reason === '' ? `refusal ${index + 1} of the contributing file gives no reason` : null,
    ])
    .filter((problem) => problem !== null);
}

function contributingProblems(contributing) {
  const required = [
    ['the counts line', COUNTS_LINE],
    ['the one-line answer', ONE_LINE_ANSWER],
    ['the way an entry leaves the list', LEAVING_RULE],
  ];
  return [
    ...required.filter(([, text]) => !contributing.includes(text)).map(([name]) => `the contributing file does not hold ${name}`),
    ...(contributing.includes(SPECIFICATION_ADDRESS) ? [] : ['the contributing file does not link the specification']),
    ...addressProblems('contributing file', contributing),
    ...refusalProblems(contributing),
  ];
}

const securityProblems = (security) =>
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(security) ? [] : ['the security policy names no address to report to'];

function packageProblems(packageJson) {
  const manifest = JSON.parse(packageJson);
  const importable = ['exports', 'main', 'module'].filter((field) => field in manifest);
  return [
    ...importable.map(
      (field) => `package.json declares ${field}, which makes the package importable: its three surfaces are the command, the copied file and the Action`,
    ),
    ...(manifest.bin?.[COMMAND_NAME] === undefined ? [`package.json has no bin named ${COMMAND_NAME}, and the README tells the reader to run it`] : []),
  ];
}

function scriptProblems(packageJson, documents) {
  const declared = Object.keys(JSON.parse(packageJson).scripts ?? {});
  return documents.flatMap(([label, text]) =>
    unique([...text.matchAll(NPM_SCRIPT)].map(([, name]) => name))
      .filter((name) => !declared.includes(name))
      .map((name) => `the ${label} says npm run ${name}, and package.json declares no script of that name`),
  );
}

export function docProblems({ readme, contributing, security, actionYml, packageJson, findingIds }) {
  return [
    ...readmeProblems(readme, { actionYml, packageJson, findingIds }),
    ...documentProblems('README', readme),
    ...contributingProblems(contributing),
    ...documentProblems('contributing file', contributing),
    ...securityProblems(security),
    ...documentProblems('security policy', security),
    ...packageProblems(packageJson),
    ...scriptProblems(packageJson, [
      ['README', readme],
      ['contributing file', contributing],
    ]),
  ];
}
