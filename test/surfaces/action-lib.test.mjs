import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  actionArgv,
  annotations,
  escapeData,
  escapeProperty,
  readInputs,
  workflowCommand,
} from '../../build/entries/action-lib.mjs';

test('escapeData escapes the percent sign, the carriage return and the newline, as the toolkit does', () => {
  assert.equal(escapeData('plain'), 'plain');
  assert.equal(escapeData('100%'), '100%25');
  assert.equal(escapeData('a\r\nb'), 'a%0D%0Ab');
  assert.equal(escapeData('a\nb'), 'a%0Ab');
});

test('escapeData escapes the percent sign first, so an escape sequence in data stays data', () => {
  assert.equal(escapeData('%0A'), '%250A');
});

test('escapeData leaves the colon and the comma alone', () => {
  assert.equal(escapeData('agent :: accuracy: 0.75, below'), 'agent :: accuracy: 0.75, below');
});

test('escapeProperty escapes the colon and the comma as well', () => {
  assert.equal(escapeProperty('a:b,c'), 'a%3Ab%2Cc');
  assert.equal(escapeProperty('100%:,'), '100%25%3A%2C');
  assert.equal(escapeProperty('x\ny\rz'), 'x%0Ay%0Dz');
});

test('workflowCommand prints a command with no property', () => {
  assert.equal(workflowCommand('warning', {}, 'message'), '::warning::message');
});

test('workflowCommand prints properties before the message, separated by commas', () => {
  assert.equal(workflowCommand('error', { file: 'a.json', title: 'evals-baseline' }, 'message'), '::error file=a.json,title=evals-baseline::message');
});

test('workflowCommand escapes the message as data and every property value as a property', () => {
  assert.equal(workflowCommand('warning', { title: 'a:b,c' }, 'x:y,z\n::error::pwned'), '::warning title=a%3Ab%2Cc::x:y,z%0A::error::pwned');
});

test('readInputs reads the three inputs from the variables the runner sets', () => {
  const env = { 'INPUT_RUN-FILE': 'run.json', INPUT_BASELINE: 'base.json', INPUT_STRICT: 'true' };
  assert.deepEqual(readInputs(env), { runFile: 'run.json', baseline: 'base.json', strict: true });
});

test('readInputs gives empty values and a strict of false when nothing is set', () => {
  assert.deepEqual(readInputs({}), { runFile: '', baseline: '', strict: false });
});

test('readInputs trims the whitespace around a value, as the toolkit does', () => {
  const env = { 'INPUT_RUN-FILE': ' run.json\n', INPUT_BASELINE: '\tbase.json ', INPUT_STRICT: ' true ' };
  assert.deepEqual(readInputs(env), { runFile: 'run.json', baseline: 'base.json', strict: true });
});

for (const value of ['false', 'FALSE', 'TRUE', 'True', '1', 'yes', 'on', '', 'tru', 'truee', 'true false']) {
  test(`readInputs reads strict ${JSON.stringify(value)} as off, because only the value true is on`, () => {
    assert.equal(readInputs({ INPUT_STRICT: value }).strict, false);
  });
}

test('actionArgv builds the check command with the run file, the baseline and the strict flag', () => {
  assert.deepEqual(actionArgv({ runFile: 'run.json', baseline: 'base.json', strict: true }), [
    'check',
    'run.json',
    '--baseline',
    'base.json',
    '--strict',
  ]);
});

test('actionArgv leaves out the strict flag when strict is off', () => {
  assert.deepEqual(actionArgv({ runFile: 'run.json', baseline: 'base.json', strict: false }), ['check', 'run.json', '--baseline', 'base.json']);
});

test('actionArgv leaves the baseline to the command default when the input is empty', () => {
  assert.deepEqual(actionArgv({ runFile: 'run.json', baseline: '', strict: false }), ['check', 'run.json']);
});

test('actionArgv passes no run file when the input is empty, so the command reports its own usage error', () => {
  assert.deepEqual(actionArgv({ runFile: '', baseline: 'base.json', strict: false }), ['check', '--baseline', 'base.json']);
});

test('actionArgv keeps a value that starts with a dash from being read as a flag', () => {
  assert.deepEqual(actionArgv({ runFile: '--strict', baseline: '-b.json', strict: false }), ['check', './--strict', '--baseline', './-b.json']);
});

const WORSE = 'below-baseline agent :: accuracy: 0.75 is below the baseline 1 by 0.25, more than the tolerance 0';
const CASES = 'cases-changed: the baseline was recorded from 4 cases (digest e6c6ecf167ab); this run holds 3 cases (digest b4826cd2872c); re-record if the change is intended';
const UNREADABLE = 'bad-run: cannot read "run.json": not found';

const PASSED = 0;
const REGRESSION = 1;
const NOT_EVALUATED = 3;

const warning = (line) => `::warning title=evals-baseline::${line}`;
const error = (line) => `::error title=evals-baseline::${line}`;
const notice = (text) => `::notice title=evals-baseline::${text}`;

const manyFindings = (howMany, label = 'metric') =>
  Array.from({ length: howMany }, (_, index) => `below-baseline ${label} ${index + 1}: 0.5 is below the baseline 1 by 0.5, more than the tolerance 0`);

const notShown = (howMany) =>
  `Not shown as annotations: ${howMany}. GitHub shows at most 10 error annotations and 10 warning annotations for each step. Read the report in the log of this step to see every finding.`;

test('annotations gives no line when there is no finding', () => {
  assert.deepEqual(annotations({ findings: [], failing: [], code: PASSED }), []);
});

test('annotations gives one warning per finding when the run did not fail, even for a finding that would fail a strict run', () => {
  assert.deepEqual(annotations({ findings: [WORSE, CASES], failing: [WORSE], code: PASSED }), [warning(WORSE), warning(CASES)]);
});

for (const [name, code] of [
  ['a regression, exit 1', REGRESSION],
  ['a finding that could not be evaluated, exit 3', NOT_EVALUATED],
]) {
  test(`annotations gives an error for each finding that fails the run, when the run failed on ${name}`, () => {
    assert.deepEqual(annotations({ findings: [WORSE, UNREADABLE], failing: [WORSE, UNREADABLE], code }), [error(WORSE), error(UNREADABLE)]);
  });
}

test('annotations reads the level from the exit code of the run and from nothing else', () => {
  const levels = [PASSED, REGRESSION, NOT_EVALUATED].map((code) => annotations({ findings: [WORSE], failing: [WORSE], code }));
  assert.deepEqual(levels, [[warning(WORSE)], [error(WORSE)], [error(WORSE)]]);
});

test('annotations keeps cases-changed a warning when the run failed, because it never fails the run (owner decision 12B)', () => {
  assert.deepEqual(annotations({ findings: [CASES, WORSE], failing: [WORSE], code: REGRESSION }), [warning(CASES), error(WORSE)]);
});

test('annotations gives only warnings when no finding fails the run', () => {
  assert.deepEqual(annotations({ findings: [CASES], failing: [], code: PASSED }), [warning(CASES)]);
});

test('annotations escapes a finding so that data cannot start a second command', () => {
  const finding = 'missing-metric agent :: 100%\n::error::pwned: the baseline names it';
  assert.deepEqual(annotations({ findings: [finding], failing: [finding], code: PASSED }), [
    '::warning title=evals-baseline::missing-metric agent :: 100%25%0A::error::pwned: the baseline names it',
  ]);
});

test('annotations gives every finding its annotation when there are 10 of one level, and no notice', () => {
  const findings = manyFindings(10);
  assert.deepEqual(annotations({ findings, failing: findings, code: REGRESSION }), findings.map(error));
});

test('annotations gives the first 10 errors and one notice with the count left out when 13 findings fail the run', () => {
  const findings = manyFindings(13);
  assert.deepEqual(annotations({ findings, failing: findings, code: REGRESSION }), [...findings.slice(0, 10).map(error), notice(notShown('3 findings'))]);
});

test('annotations gives the first 10 warnings and one notice when 12 findings pass the run', () => {
  const findings = manyFindings(12);
  assert.deepEqual(annotations({ findings, failing: findings, code: PASSED }), [...findings.slice(0, 10).map(warning), notice(notShown('2 findings'))]);
});

test('annotations names one finding left out in the singular', () => {
  const findings = manyFindings(11);
  assert.deepEqual(annotations({ findings, failing: findings, code: REGRESSION }).at(-1), notice(notShown('1 finding')));
});

test('annotations counts the cap for each level, so 10 errors and 10 warnings both fit', () => {
  const failing = manyFindings(10, 'failing');
  const advisory = manyFindings(10, 'advisory');
  assert.deepEqual(annotations({ findings: [...failing, ...advisory], failing, code: REGRESSION }), [...failing.map(error), ...advisory.map(warning)]);
});

test('annotations adds up what the cap left out of each level into one notice', () => {
  const failing = manyFindings(11, 'failing');
  const advisory = manyFindings(12, 'advisory');
  const commands = annotations({ findings: [...failing, ...advisory], failing, code: REGRESSION });
  assert.equal(commands.length, 21);
  assert.deepEqual(commands.slice(0, 10), failing.slice(0, 10).map(error));
  assert.deepEqual(commands.slice(10, 20), advisory.slice(0, 10).map(warning));
  assert.equal(commands.at(-1), notice(notShown('3 findings')));
});

test('annotations gives the notice of the cap a level of its own, so that the cap of errors and of warnings cannot hide it', () => {
  const findings = manyFindings(40);
  const commands = annotations({ findings, failing: findings, code: REGRESSION });
  assert.equal(commands.filter((command) => command.startsWith('::error ')).length, 10);
  assert.equal(commands.filter((command) => command.startsWith('::notice ')).length, 1);
});
