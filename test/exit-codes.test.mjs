import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { exitCode, render } from '../src/render.mjs';
import { promptfooIo } from './support/command.mjs';
import { makeIo } from './support/io.mjs';
import { findingFields } from './support/model.mjs';
import { belowBaseline, casesChanged, checked, sampleCount, today } from './support/render.mjs';

const key = 'agent :: accuracy';

const FINDINGS = {
  'missing-metric': { id: 'missing-metric', key, baseline: { value: 1000000, samples: 4 } },
  'below-baseline': belowBaseline,
  'sample-count': sampleCount(key),
  'unreadable-metric': { id: 'unreadable-metric', key, reason: 'its weight total is not a number above zero' },
  'no-baseline': { id: 'no-baseline', file: 'evals-baseline.json' },
  'bad-baseline': { id: 'bad-baseline', file: 'evals-baseline.json', cause: 'refused', problem: 'not JSON' },
  'bad-run': { id: 'bad-run', file: 'run.json', cause: 'cannot-read', failure: 'ENOENT' },
  'internal-error': { id: 'internal-error', message: 'boom' },
  'cases-changed': casesChanged,
};

const REGRESSION = 1;
const NOT_EVALUATED = 3;
const STRICT_CODE_OF = {
  'missing-metric': REGRESSION,
  'below-baseline': REGRESSION,
  'sample-count': REGRESSION,
  'unreadable-metric': NOT_EVALUATED,
  'no-baseline': NOT_EVALUATED,
  'bad-baseline': NOT_EVALUATED,
  'bad-run': NOT_EVALUATED,
  'internal-error': NOT_EVALUATED,
  'cases-changed': 0,
};

const outputOf = (findings, strict) => render(checked({ findings }), strict, today);
const lastLine = (output) => output.lines.at(-1);

test('the exit codes are 0 for pass, 1 for a regression, 2 for a usage error and 3 for could not evaluate', () => {
  assert.deepEqual(exitCode, { pass: 0, regression: 1, usage: 2, notEvaluated: 3 });
});

test('this table classifies every finding id the comparison and the readers can raise, and no other', () => {
  const raised = [...new Set(Object.keys(findingFields).map((variant) => variant.split('/')[0]))].sort();
  assert.deepEqual(Object.keys(FINDINGS).sort(), raised);
  assert.deepEqual(Object.keys(STRICT_CODE_OF).sort(), raised);
});

for (const [id, finding] of Object.entries(FINDINGS)) {
  test(`${id} alone exits ${STRICT_CODE_OF[id]} under --strict and 0 without it`, () => {
    assert.equal(outputOf([finding], true).code, STRICT_CODE_OF[id]);
    assert.equal(outputOf([finding], false).code, 0);
  });
}

test('a regression and a finding that could not be evaluated together exit 1, so a regression is never hidden behind a blind metric', () => {
  const both = [FINDINGS['unreadable-metric'], FINDINGS['below-baseline']];
  assert.equal(outputOf(both, true).code, REGRESSION);
  assert.equal(outputOf([...both].reverse(), true).code, REGRESSION);
});

test('cases-changed beside a finding that could not be evaluated exits 3, and beside a regression exits 1', () => {
  assert.equal(outputOf([FINDINGS['cases-changed'], FINDINGS['bad-run']], true).code, NOT_EVALUATED);
  assert.equal(outputOf([FINDINGS['cases-changed'], FINDINGS['sample-count']], true).code, REGRESSION);
});

test('the summary names the exit code that --strict gives, 1 for a regression and 3 for a finding that could not be evaluated', () => {
  assert.equal(lastLine(outputOf([FINDINGS['below-baseline']], true)), 'evals-baseline: 1 finding; exit 1 (--strict)');
  assert.equal(lastLine(outputOf([FINDINGS['below-baseline']], false)), 'evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 1)');
  assert.equal(lastLine(outputOf([FINDINGS['bad-run']], true)), 'evals-baseline: 1 finding; exit 3 (--strict)');
  assert.equal(lastLine(outputOf([FINDINGS['bad-run']], false)), 'evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 3)');
});

test('the summary of a regression beside a finding that could not be evaluated names exit 1, the code the run gets', () => {
  const both = [FINDINGS['no-baseline'], FINDINGS['missing-metric']];
  assert.equal(lastLine(outputOf(both, true)), 'evals-baseline: 2 findings; exit 1 (--strict)');
  assert.equal(lastLine(outputOf(both, false)), 'evals-baseline: 2 findings; warning only, exit 0 (pass --strict to exit 1)');
});

test('the summary of cases-changed alone names no code to pass, because it never fails the run', () => {
  const summary = 'evals-baseline: 1 finding; warning only, exit 0 (cases-changed never fails --strict)';
  assert.equal(lastLine(outputOf([FINDINGS['cases-changed']], true)), summary);
  assert.equal(lastLine(outputOf([FINDINGS['cases-changed']], false)), summary);
});

test('a command that finds a regression exits 1 with the report on stdout and nothing on stderr', () => {
  const output = cli(['check', 'run-worse.json', '--strict'], promptfooIo('run-worse.json'));
  assert.deepEqual([output.code, output.stderr], [1, []]);
});

test('a strict check of a run file that does not exist exits 3, because nothing was compared', () => {
  const output = cli(['check', 'missing.json', '--strict'], promptfooIo('run-good.json'));
  assert.deepEqual([output.code, output.stderr, output.failing.length], [3, [], 1]);
});

test('a strict check against a baseline that does not exist exits 3', () => {
  const output = cli(['check', 'run-good.json', '--baseline', 'nowhere.json', '--strict'], promptfooIo('run-good.json'));
  assert.equal(output.code, 3);
});

test('a strict check whose reader throws exits 3, and a check without --strict exits 0', () => {
  const throwing = { readFile: () => { throw new RangeError('boom'); }, writeFile: () => {}, now: makeIo().now };
  assert.equal(cli(['check', 'run-good.json', '--strict'], throwing).code, 3);
  assert.equal(cli(['check', 'run-good.json'], throwing).code, 0);
});

test('show exits 3 when it cannot read its run, and prints the refusal on stdout alone', () => {
  const output = cli(['show', 'missing.json'], promptfooIo('run-good.json'));
  assert.deepEqual([output.code, output.stderr, output.stdout.length], [3, [], 1]);
});

test('record exits 3 when it refuses, and writes nothing', () => {
  const io = promptfooIo('run-good.json');
  const output = cli(['record', 'missing.json'], io);
  assert.deepEqual([output.code, output.stderr, io.writes], [3, [], []]);
});

test('a usage error still exits 2, with the text on stderr and nothing on stdout', () => {
  const output = cli(['check'], makeIo());
  assert.deepEqual([output.code, output.stdout, output.stderr.length > 0], [2, [], true]);
});
