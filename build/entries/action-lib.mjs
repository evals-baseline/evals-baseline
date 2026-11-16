const ANNOTATION_TITLE = 'evals-baseline';
const ANNOTATIONS_PER_LEVEL = 10;
const PASSED = 0;

export function escapeData(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export function escapeProperty(value) {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

export function workflowCommand(command, properties, message) {
  const pairs = Object.entries(properties).map(([key, value]) => `${key}=${escapeProperty(value)}`);
  const head = pairs.length === 0 ? command : `${command} ${pairs.join(',')}`;
  return `::${head}::${escapeData(message)}`;
}

const inputOf = (env, name) => (env[`INPUT_${name.toUpperCase()}`] ?? '').trim();

export function readInputs(env) {
  return {
    runFile: inputOf(env, 'run-file'),
    baseline: inputOf(env, 'baseline'),
    strict: inputOf(env, 'strict') === 'true',
  };
}

const asPath = (value) => (value.startsWith('-') ? `./${value}` : value);

export function actionArgv({ runFile, baseline, strict }) {
  return [
    'check',
    ...(runFile === '' ? [] : [asPath(runFile)]),
    ...(baseline === '' ? [] : ['--baseline', asPath(baseline)]),
    ...(strict ? ['--strict'] : []),
  ];
}

const notShownText = (count) =>
  `Not shown as annotations: ${count} ${count === 1 ? 'finding' : 'findings'}. ` +
  `GitHub shows at most ${ANNOTATIONS_PER_LEVEL} error annotations and ${ANNOTATIONS_PER_LEVEL} warning annotations for each step. ` +
  'Read the report in the log of this step to see every finding.';

export function annotations({ findings, failing, code }) {
  const failed = new Set(code === PASSED ? [] : failing);
  const shown = { error: 0, warning: 0 };
  const commands = [];
  let notShown = 0;
  for (const line of findings) {
    const level = failed.has(line) ? 'error' : 'warning';
    if (shown[level] === ANNOTATIONS_PER_LEVEL) {
      notShown += 1;
      continue;
    }
    shown[level] += 1;
    commands.push(workflowCommand(level, { title: ANNOTATION_TITLE }, line));
  }
  if (notShown > 0) {
    commands.push(workflowCommand('notice', { title: ANNOTATION_TITLE }, notShownText(notShown)));
  }
  return commands;
}
