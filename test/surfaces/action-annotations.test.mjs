import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { snapshotDirectory } from '../../build/lib/scratch.mjs';
import { ROOT, UUID_V4, runAction, scratchDirectory } from './support.mjs';

const PACKAGE_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const VECTORS = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'vectors.json'), 'utf8')).vectors;
const FINDING = /^(?:missing-metric|below-baseline|sample-count|cases-changed|no-baseline|bad-baseline|bad-run|unreadable-metric|internal-error)[ :]/;
const SUMMARY = /^evals-baseline: (?:no findings$|(\d+) findings?; )/;

const escapeData = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const severityOf = (line, code) => (code !== 0 && !line.startsWith('cases-changed') ? 'error' : 'warning');

function inputsOf(argv) {
  const at = argv.indexOf('--baseline');
  const [runFile = ''] = argv.filter((token, index) => index > 0 && !token.startsWith('--') && index !== at + 1);
  return { 'run-file': runFile, baseline: at === -1 ? '' : argv[at + 1], strict: argv.includes('--strict') ? 'true' : 'false' };
}

function realRun(t, id) {
  const vector = VECTORS.find((entry) => entry.id === id);
  assert.ok(vector, `fixtures/vectors.json has no vector with the id ${id}`);
  const workspace = scratchDirectory(t, 'workspace');
  cpSync(join(ROOT, vector.dir), join(workspace, vector.dir), { recursive: true });
  const before = snapshotDirectory(workspace);
  const inputs = inputsOf(vector.argv);
  const result = runAction(t, ROOT, inputs, { cwd: join(workspace, vector.dir), instant: vector.now });
  return { vector, workspace, strict: inputs.strict === 'true', result, before, after: snapshotDirectory(workspace) };
}

function expectationOf({ vector }) {
  const summary = SUMMARY.exec(vector.stdout.at(-1) ?? '');
  assert.ok(summary, `${vector.id} ends with ${JSON.stringify(vector.stdout.at(-1))}, which is no summary line`);
  const findings = vector.stdout.filter((line) => FINDING.test(line));
  assert.equal(findings.length, Number(summary[1] ?? 0), `${vector.id}: its finding lines do not add up to its summary line`);
  const annotations = findings.map((line) => `::${severityOf(line, vector.code)} title=evals-baseline::${escapeData(line)}`);
  const failing = annotations.some((line) => line.startsWith('::error '));
  assert.equal(failing, vector.code !== 0, `${vector.id}: its exit code does not match its findings`);
  const banner = vector.stdout[0].replace('<package version>', PACKAGE_VERSION);
  return { report: [banner, ...vector.stdout.slice(1)], annotations, count: findings.length };
}

const FINDING_VECTORS = [
  'S2-promptfoo-one-case-wrong',
  'S2-promptfoo-one-case-wrong-strict',
  'S4-promptfoo-three-cases',
  'S4-promptfoo-three-cases-strict',
];

for (const id of FINDING_VECTORS) {
  test(`for ${id}, prints the report of the vector in the fence, nothing on stderr, and writes nothing in the workspace`, (t) => {
    const run = realRun(t, id);
    assert.match(run.result.token, UUID_V4);
    assert.deepEqual(run.result.report, expectationOf(run).report);
    assert.equal(run.result.stderr, '');
    assert.deepEqual(run.after, run.before);
  });

  test(`for ${id}, annotates each finding line in order at the level the exit code of the vector calls for, and exits with that code`, (t) => {
    const run = realRun(t, id);
    assert.deepEqual(run.result.annotations, expectationOf(run).annotations);
    assert.equal(run.result.code, run.vector.code);
  });

  test(`for ${id}, writes findings=<number of finding lines> to GITHUB_OUTPUT`, (t) => {
    const run = realRun(t, id);
    assert.equal(run.result.githubOutput, `findings=${expectationOf(run).count}\n`);
  });
}

test('under strict, S4-promptfoo-three-cases-strict gives cases-changed a warning and every other finding an error, and exits 1', (t) => {
  const run = realRun(t, 'S4-promptfoo-three-cases-strict');
  const findings = run.vector.stdout.filter((line) => FINDING.test(line));
  const kinds = run.result.annotations.map((line) => /^::(warning|error) /.exec(line)?.[1]);
  assert.deepEqual(kinds, findings.map((line) => severityOf(line, run.vector.code)));
  assert.deepEqual([...new Set(kinds)].sort(), ['error', 'warning']);
  assert.equal(run.result.code, 1);
});

test('fences the report of S1-promptfoo-same-suite-twice, which has no finding, gives it no annotation and writes findings=0', (t) => {
  const run = realRun(t, 'S1-promptfoo-same-suite-twice');
  const expected = expectationOf(run);
  assert.equal(expected.count, 0);
  assert.match(run.result.token, UUID_V4);
  assert.deepEqual(run.result.report, expected.report);
  assert.deepEqual(run.result.annotations, []);
  assert.equal(run.result.githubOutput, 'findings=0\n');
  assert.equal(run.result.code, run.vector.code);
});

test('exits 2 with the usage of X-usage-no-run-file on stderr when run-file is empty, with no stdout and an untouched GITHUB_OUTPUT', (t) => {
  const run = realRun(t, 'X-usage-no-run-file');
  assert.equal(run.vector.code, 2);
  assert.equal(run.result.code, run.vector.code);
  assert.equal(run.result.stdout, '');
  assert.equal(run.result.stderr, run.vector.stderr.map((line) => `${line}\n`).join(''));
  assert.equal(run.result.githubOutput, '');
});

test('prints a metric label with a newline, a workflow command and an escape character as visible text, never as a raw line or byte', (t) => {
  const run = realRun(t, 'S10-hostile-metric-finding');
  const labels = Object.keys(JSON.parse(readFileSync(join(run.workspace, run.vector.baseline), 'utf8')).metrics);
  const isHostile = (label) => label.includes('\n::error::') && label.includes('\u001b');
  assert.ok(labels.some(isHostile), 'the baseline carries no hostile label any more, so this run proves nothing');
  const expected = expectationOf(run);
  const { result } = run;
  assert.deepEqual(result.report, expected.report);
  assert.ok(!result.stdout.includes('\u001b'), JSON.stringify(result.stdout));
  const commands = result.stdout.split('\n').filter((line) => line.startsWith('::'));
  assert.deepEqual(commands, [`::stop-commands::${result.token}`, `::${result.token}::`, ...expected.annotations]);
});

test('escapes the percent sign of a real finding in its annotation, and prints the finding as it is in the report', (t) => {
  const directory = join(scratchDirectory(t, 'workspace'), 'promptfoo');
  cpSync(join(ROOT, 'fixtures', 'promptfoo'), directory, { recursive: true });
  const baselinePath = join(directory, 'evals-baseline.json');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const [label] = Object.keys(baseline.metrics);
  baseline.metrics[`${label} 100%`] = baseline.metrics[label];
  delete baseline.metrics[label];
  writeFileSync(baselinePath, JSON.stringify(baseline));
  const result = runAction(t, ROOT, { 'run-file': 'run-good.json', baseline: '', strict: 'false' }, { cwd: directory });
  const findings = result.report.filter((line) => FINDING.test(line));
  assert.equal(findings.filter((line) => line.includes('100%')).length, 1);
  assert.deepEqual(result.annotations, findings.map((line) => `::warning title=evals-baseline::${escapeData(line)}`));
  assert.ok(result.annotations.some((line) => line.includes('100%25')));
});
