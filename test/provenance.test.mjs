import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { assertSafeOutput, deepevalFile, promptfooFile } from './support/command.mjs';
import { editedFixture } from './support/fixtures.mjs';
import { makeIo } from './support/io.mjs';
import { instruction, payloads } from './support/payloads.mjs';

const promptfooRun = (edit) => editedFixture('promptfoo', 'run-good.json', edit);
const promptfooBaseline = (edit) => editedFixture('promptfoo', 'evals-baseline.json', edit);
const deepevalRun = (edit) => editedFixture('deepeval', 'run-good.json', edit);
const promptfooMetrics = (run) => run.results.prompts[0].metrics;

const goodRun = promptfooFile('run-good.json');
const goodBaseline = promptfooFile('evals-baseline.json');
const goodDeepevalRun = deepevalFile('run-good.json');
const goodDeepevalBaseline = deepevalFile('evals-baseline.json');

const withBaseline = (run) => ({ 'run-good.json': run, 'evals-baseline.json': goodBaseline });
const withDeepevalBaseline = (run) => ({ 'run-good.json': run, 'evals-baseline.json': goodDeepevalBaseline });
const check = ['check', 'run-good.json'];
const show = ['show', 'run-good.json'];
const record = ['record', 'run-good.json', '--baseline', 'fresh.json', '--tolerance', '0'];
const recordOver = ['record', 'run-good.json'];
const exception = (text) => new TypeError(text);

const inventory = [
  {
    field: 'the provider label of a promptfoo run',
    files: (text) => withBaseline(promptfooRun((run) => { run.results.prompts[0].provider = text; })),
    commands: [check, show],
  },
  {
    field: 'the name of a promptfoo metric',
    files: (text) =>
      withBaseline(
        promptfooRun((run) => {
          Object.assign(promptfooMetrics(run).namedScores, { [text]: 4 });
          Object.assign(promptfooMetrics(run).namedScoresCount, { [text]: 4 });
        }),
      ),
    commands: [check, show],
  },
  {
    field: 'a promptfoo weight that is a string',
    files: (text) => withBaseline(promptfooRun((run) => { promptfooMetrics(run).namedScoreWeights.accuracy = text; })),
    commands: [check, show, record],
  },
  {
    field: 'a promptfoo weight that is an object',
    files: (text) => withBaseline(promptfooRun((run) => { promptfooMetrics(run).namedScoreWeights.accuracy = { [text]: 1 }; })),
    commands: [check, show, record],
  },
  {
    field: 'the version of promptfoo that wrote a run',
    files: (text) => withBaseline(promptfooRun((run) => { run.metadata.promptfooVersion = text; })),
    commands: [check, show, record],
  },
  {
    field: 'the provider label of a promptfoo run that holds errored tests',
    files: (text) =>
      withBaseline(
        promptfooRun((run) => {
          run.results.prompts[0].provider = text;
          promptfooMetrics(run).testErrorCount = 1;
        }),
      ),
    commands: [check, show],
  },
  {
    field: 'two promptfoo prompts that share a provider label',
    files: (text) =>
      withBaseline(
        promptfooRun((run) => {
          run.results.prompts[0].provider = text;
          run.results.prompts.push({ ...run.results.prompts[0] });
        }),
      ),
    commands: [check, show, record],
  },
  {
    field: 'the name of a DeepEval metric',
    files: (text) =>
      withDeepevalBaseline(
        deepevalRun((run) => {
          run.metricsScores.push({ metric: text, scores: [1, 1, 1, 1], passes: 4, fails: 0, errors: 0 });
        }),
      ),
    commands: [check, show],
  },
  {
    field: 'the name of a DeepEval metric whose samples errored',
    files: (text) =>
      withDeepevalBaseline(
        deepevalRun((run) => {
          run.metricsScores = [{ metric: text, scores: [1, 1, 1], passes: 3, fails: 0, errors: 1 }];
        }),
      ),
    commands: [check, show, record],
  },
  {
    field: 'the tool version in a baseline',
    files: (text) => ({
      'run-good.json': goodRun,
      'evals-baseline.json': promptfooBaseline((baseline) => { baseline.source.toolVersion = text; }),
    }),
    commands: [check],
  },
  {
    field: 'a metric key in a baseline',
    files: (text) => ({
      'run-good.json': goodRun,
      'evals-baseline.json': promptfooBaseline((baseline) => { baseline.metrics[text] = baseline.metrics['agent :: accuracy']; }),
    }),
    commands: [check],
  },
  {
    field: 'an unknown key in a baseline',
    files: (text) => ({
      'run-good.json': goodRun,
      'evals-baseline.json': promptfooBaseline((baseline) => { baseline.source[text] = 1; }),
    }),
    commands: [check, recordOver],
  },
  {
    field: 'the specification member of a baseline',
    files: (text) => ({
      'run-good.json': goodRun,
      'evals-baseline.json': promptfooBaseline((baseline) => { baseline.spec = text; }),
    }),
    commands: [check, recordOver],
  },
  {
    field: 'a key that a baseline holds twice',
    files: (text) => ({
      'run-good.json': goodRun,
      'evals-baseline.json': `{"spec": "1.0", ${JSON.stringify(text)}: 1, ${JSON.stringify(text)}: 2}`,
    }),
    commands: [check, recordOver],
  },
  {
    field: 'a top-level key of a run that neither tool wrote',
    files: (text) => ({ 'run-good.json': JSON.stringify({ [text]: 1 }), 'evals-baseline.json': goodBaseline }),
    commands: [check, show],
  },
  {
    field: 'a key that a run holds twice',
    files: (text) => ({
      'run-good.json': `{${JSON.stringify(text)}: 1, ${JSON.stringify(text)}: 2}`,
      'evals-baseline.json': goodBaseline,
    }),
    commands: [check, show],
  },
  {
    field: 'the path of a run that is not there',
    files: () => ({ 'evals-baseline.json': goodBaseline }),
    commands: (text) => [['check', text], ['show', text], ['record', text]],
  },
  {
    field: 'the path of a baseline that is not there',
    files: () => ({ 'run-good.json': goodRun }),
    commands: (text) => [['check', 'run-good.json', '--baseline', text], ['record', 'run-good.json', '--baseline', text, '--tolerance', '0']],
  },
  {
    field: 'a flag that no verb has',
    files: () => ({ 'run-good.json': goodRun }),
    commands: (text) => [['check', 'run-good.json', `-${text}`]],
  },
  {
    field: 'the value of --tolerance',
    files: () => ({ 'run-good.json': goodRun }),
    commands: (text) => [['record', 'run-good.json', '--tolerance', text]],
  },
  {
    field: 'the message of an exception',
    files: (text) => ({ 'evals-baseline.json': goodBaseline, 'run-good.json': exception(text) }),
    commands: [check, show, record],
  },
  {
    field: 'the message of an exception from a deepeval run',
    files: (text) => ({ 'evals-baseline.json': goodDeepevalBaseline, 'run-good.json': exception(text) }),
    commands: [check],
  },
];

const outputLines = (output) => [...output.stdout, ...output.stderr, ...output.findings, ...output.failing];
const insideQuotes = (line) => line.split('"').filter((_, index) => index % 2 === 1);
const outsideQuotes = (line) => line.split('"').filter((_, index) => index % 2 === 0);

function spansHonouringBackslashes(line) {
  const spans = [];
  let open = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (open === null) {
      open = character === '"' ? '' : null;
    } else if (character === '\\') {
      open += character + line[index + 1];
      index += 1;
    } else if (character === '"') {
      spans.push(open);
      open = null;
    } else {
      open += character;
    }
  }
  return open === null ? spans : [...spans, open];
}

function assertDelimited(lines, needle, where) {
  for (const line of lines) {
    const shown = `${where}: ${JSON.stringify(line)}`;
    assert.equal(line.split('"').length % 2, 1, `${shown} holds an unpaired double quote`);
    assert.equal(outsideQuotes(line).some((part) => part.includes(needle)), false, `${shown} prints the text outside a pair of double quotes`);
    assert.deepEqual(spansHonouringBackslashes(line), insideQuotes(line), `${shown} ends a span in one reading and not in the other`);
  }
}

for (const { field, files, commands } of inventory) {
  for (const { name, text, needle, forbidden } of payloads) {
    test(`${field}, set to ${name}, is printed between double quotes by every verb that prints it, with no character left that a reader could not see`, () => {
      const argvs = typeof commands === 'function' ? commands(text) : commands;
      for (const argv of argvs) {
        const output = cli(argv, makeIo(files(text)));
        const lines = outputLines(output);
        const where = `${field}: ${argv[0]}`;
        assert.equal(lines.some((line) => line.includes(needle)), true, `${where} does not print the text`);
        assertDelimited(lines, needle, where);
        assert.equal(lines.some((line) => forbidden !== undefined && line.includes(forbidden)), false, `${where} prints a double quote that the text holds`);
        assertSafeOutput(output, where);
      }
    });
  }
}

test('the inventory names every verb at least once and every field at least once', () => {
  const verbs = new Set(inventory.flatMap(({ commands }) => (typeof commands === 'function' ? commands('x') : commands).map((argv) => argv[0])));
  assert.deepEqual([...verbs].sort(), ['check', 'record', 'show']);
  assert.equal(new Set(inventory.map(({ field }) => field)).size, inventory.length);
});

test('the check of these tests refuses a sentence printed outside a pair of double quotes, a quote that is not paired and a quote that a backslash could hide', () => {
  const needle = instruction;
  assert.doesNotThrow(() => assertDelimited([`missing-metric "${needle}": gone`, `note: "a" and "${needle}"`], needle, 'accepted'));
  assert.throws(() => assertDelimited([`missing-metric ${needle}: gone`], needle, 'bare'), assert.AssertionError);
  assert.throws(() => assertDelimited([`note: "a" ${needle} "b"`], needle, 'between two spans'), assert.AssertionError);
  assert.throws(() => assertDelimited([`note: "${needle}`], needle, 'unpaired'), assert.AssertionError);
  assert.throws(() => assertDelimited([`note: "a\\" x "${needle}"`], needle, 'hidden quote'), assert.AssertionError);
});
