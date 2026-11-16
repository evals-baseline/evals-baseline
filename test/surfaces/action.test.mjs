import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { snapshotDirectory } from '../../build/lib/scratch.mjs';
import { MINI_FIXTURES, miniToolSources } from './mini-tool.mjs';
import { builtRepository } from './mini-repository.mjs';
import { UUID_V4, runAction } from './support.mjs';

const WORSE = 'finding agent :: accuracy: 0.75 is below the baseline 1';
const FORMAT = 'finding agent :: format: missing';
const SOFT = 'soft cases-changed: the baseline was recorded from 4 cases';
const HEADER = 'mini check evals-baseline.json on 2026-11-11';
const WARNING_ONLY = 'warning only, exit 0 (pass --strict to exit 1)';

const asWarning = (line) => `::warning title=evals-baseline::${line}`;
const asError = (line) => `::error title=evals-baseline::${line}`;

const mini = (t) => builtRepository(t, { sources: miniToolSources(), files: MINI_FIXTURES });

const defaults = (runFile, extra = {}) => ({ 'run-file': runFile, baseline: 'evals-baseline.json', strict: 'false', ...extra });

test('prints the report, then one warning per finding, and writes the number of findings', (t) => {
  const result = runAction(t, mini(t), defaults('run-findings.txt'));
  assert.deepEqual(result.report, [HEADER, WORSE, FORMAT, `evals-baseline: 2 findings; ${WARNING_ONLY}`]);
  assert.deepEqual(result.annotations, [asWarning(WORSE), asWarning(FORMAT)]);
  assert.equal(result.code, 0);
  assert.equal(result.githubOutput, 'findings=2\n');
  assert.equal(result.stderr, '');
});

test('under strict gives an error for each finding that fails the run and exits 1', (t) => {
  const result = runAction(t, mini(t), defaults('run-findings.txt', { strict: 'true' }));
  assert.deepEqual(result.annotations, [asError(WORSE), asError(FORMAT)]);
  assert.equal(result.code, 1);
  assert.equal(result.githubOutput, 'findings=2\n');
});

test('under strict keeps a finding that never fails the run a warning, and still fails for the one that does', (t) => {
  const result = runAction(t, mini(t), defaults('run-mixed.txt', { strict: 'true' }));
  assert.deepEqual(result.annotations, [asWarning(SOFT), asError(WORSE)]);
  assert.equal(result.code, 1);
});

test('under strict, when only a finding that never fails the run is present, gives a warning and exits 0', (t) => {
  const result = runAction(t, mini(t), defaults('run-soft.txt', { strict: 'true' }));
  assert.deepEqual(result.annotations, [asWarning(SOFT)]);
  assert.equal(result.code, 0);
  assert.equal(result.githubOutput, 'findings=1\n');
});

test('fences the report of a clean run, gives it no annotation and writes findings=0', (t) => {
  const result = runAction(t, mini(t), defaults('run-clean.txt', { strict: 'true' }));
  assert.match(result.token, UUID_V4);
  assert.deepEqual(result.report, [HEADER, 'evals-baseline: no findings']);
  assert.deepEqual(result.annotations, []);
  assert.equal(result.code, 0);
  assert.equal(result.githubOutput, 'findings=0\n');
});

for (const value of ['TRUE', 'True', '1', 'yes', 'on', 'false', '', 'truee']) {
  test(`reads strict ${JSON.stringify(value)} as off: no error annotation and exit 0, because only true is on`, (t) => {
    const result = runAction(t, mini(t), defaults('run-findings.txt', { strict: value }));
    assert.equal(result.code, 0);
    assert.deepEqual(result.annotations, [asWarning(WORSE), asWarning(FORMAT)]);
  });
}

test('escapes a percent sign and a carriage return in an annotation, and leaves the colon and the comma of the message alone', (t) => {
  const result = runAction(t, mini(t), defaults('run-escapes.txt'));
  assert.equal(result.report[1], 'finding agent :: 100% done: a,b\r');
  assert.deepEqual(result.annotations, ['::warning title=evals-baseline::finding agent :: 100%25 done: a,b%0D']);
});

test('passes the baseline input to the command', (t) => {
  const result = runAction(t, mini(t), defaults('run-clean.txt', { baseline: 'other.json' }));
  assert.equal(result.report[0], 'mini check other.json on 2026-11-11');
});

test('reads a run file whose name starts with a dash as a path, not as a flag', (t) => {
  const result = runAction(t, mini(t), defaults('-dash.txt'));
  assert.equal(result.code, 0);
  assert.equal(result.report.at(-1), 'evals-baseline: no findings');
});

test('exits 2 with the usage on stderr when run-file is empty, and prints no fence, no annotation and no output', (t) => {
  const result = runAction(t, mini(t), defaults(''));
  assert.equal(result.code, 2);
  assert.match(result.stderr, /^usage: /);
  assert.equal(result.stdout, '');
  assert.equal(result.token, null);
  assert.equal(result.githubOutput, '');
});

test('runs without GITHUB_OUTPUT, as it does outside a workflow, and still annotates', (t) => {
  const result = runAction(t, mini(t), defaults('run-findings.txt'), { withOutput: false });
  assert.equal(result.code, 0);
  assert.deepEqual(result.annotations, [asWarning(WORSE), asWarning(FORMAT)]);
  assert.equal(result.githubOutput, '');
});

test('writes nothing in the workspace', (t) => {
  const root = mini(t);
  const before = snapshotDirectory(join(root, 'fixtures'));
  runAction(t, root, defaults('run-findings.txt', { strict: 'true' }));
  assert.deepEqual(snapshotDirectory(join(root, 'fixtures')), before);
});

test('ignores the inputs of another step and any variable it does not read', (t) => {
  const result = runAction(t, mini(t), defaults('run-clean.txt'), { env: { INPUT_STRICTNESS: 'true', STRICT: 'true', GITHUB_TOKEN: 'x' } });
  assert.deepEqual(result.report, [HEADER, 'evals-baseline: no findings']);
  assert.deepEqual(result.annotations, []);
});

const hostile = (t) => runAction(t, mini(t), defaults('run-hostile.txt'));

test('prints a report line that looks like a workflow command verbatim between the opener and the closer, and starts no other line outside the fence with ::', (t) => {
  const result = hostile(t);
  assert.deepEqual(result.report, [HEADER, '::error::pwned', '##[add-mask]secret', WORSE, `evals-baseline: 1 finding; ${WARNING_ONLY}`]);
  assert.deepEqual(result.annotations, [asWarning(WORSE)]);
  const commands = result.stdout.split('\n').filter((line) => line.startsWith('::'));
  assert.deepEqual(commands, [`::stop-commands::${result.token}`, '::error::pwned', `::${result.token}::`, asWarning(WORSE)]);
});

test('opens with a token that has the shape of a UUID, differs on every run and never occurs inside the report', (t) => {
  const root = mini(t);
  const runs = [runAction(t, root, defaults('run-hostile.txt')), runAction(t, root, defaults('run-hostile.txt'))];
  for (const { token } of runs) assert.match(token, UUID_V4);
  assert.notEqual(runs[0].token, runs[1].token);
  for (const { token, report } of runs) assert.deepEqual(report.filter((line) => line.includes(token)), []);
});

test('closes the report with exactly ::<token>::, so that the token is on two lines of stdout only, the opener and the closer', (t) => {
  const result = hostile(t);
  const tokenLines = result.stdout.split('\n').filter((line) => line.includes(result.token));
  assert.deepEqual(tokenLines, [`::stop-commands::${result.token}`, `::${result.token}::`]);
});

test('prints the annotations after the closer, never inside the fence, where the runner would ignore them', (t) => {
  const result = runAction(t, mini(t), defaults('run-findings.txt', { strict: 'true' }));
  const lines = result.stdout.split('\n');
  const closerAt = lines.indexOf(`::${result.token}::`);
  const annotatedAt = lines.flatMap((line, index) => (/^::(warning|error) /.test(line) ? [index] : []));
  assert.equal(annotatedAt.length, 2);
  assert.ok(annotatedAt.every((index) => index > closerAt), `the annotations are on lines ${annotatedAt}, the closer on ${closerAt}`);
});
