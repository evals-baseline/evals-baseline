import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { repositoryRoot } from './support/fixtures.mjs';
import { checkDay, checkDayAYearLater, expectedFor, rowsOf, runRow, specimenIndexText, strictCodeOf } from './support/specimen-run.mjs';
import { specimens } from './support/specimen-table.mjs';

const rows = specimens.flatMap((specimen) => rowsOf(specimen).map((row, index) => ({ specimen, row, strict: index === 1 })));
const checkRows = rows.filter(({ specimen }) => specimen.kind === 'check');
const usageErrorCode = 2;

test('fixtures/specimens.json is exactly the table of the specimens, one row per line', () => {
  assert.equal(readFileSync(join(repositoryRoot, 'fixtures', 'specimens.json'), 'utf8'), specimenIndexText(specimens));
});

test('every row has an id nobody else has, a directory that exists, and, unless its arguments are refused, an argv that starts with a verb', () => {
  const ids = rows.map(({ row }) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const { specimen, row } of rows) {
    assert.equal(existsSync(join(repositoryRoot, row.dir)), true, row.id);
    assert.match(row.dir, /^fixtures(\/(promptfoo|deepeval))?$/);
    if (specimen.code !== usageErrorCode) assert.match(row.argv[0], /^(check|record|show)$/);
  }
});

test('the table holds a specimen for every guard of 9.1 that an argument list can express', () => {
  const prefixes = new Set(specimens.flatMap(({ id }) => /^(S\d+b?)-/.exec(id)?.slice(1) ?? []));
  assert.deepEqual([...prefixes].sort(), ['S1', 'S10', 'S11', 'S13', 'S14', 'S15', 'S16', 'S2', 'S2b', 'S3', 'S4', 'S5', 'S8', 'S9']);
});

test('the table holds specimens for arguments the command refuses, and each expects nothing on stdout and text on stderr', () => {
  const refused = specimens.filter((specimen) => specimen.code === usageErrorCode);
  assert.equal(refused.length > 0, true);
  for (const specimen of refused) {
    assert.deepEqual(specimen.stdout, [], specimen.id);
    assert.equal(specimen.stderr.length > 0, true, specimen.id);
  }
});

for (const { specimen, row, strict } of rows) {
  test(`${row.id}: ${row.argv.join(' ')} prints the expected report and exits as expected`, () => {
    assert.deepEqual(runRow(cli, row), expectedFor(specimen, strict));
  });
}

test('S6: no check exits non-zero without --strict, and with --strict exactly the checks that found something that can fail do, with 1 for a regression and 3 for a finding that could not be evaluated', () => {
  for (const { specimen, row, strict } of checkRows) {
    const outcome = runRow(cli, row);
    assert.equal(outcome.code, strict ? strictCodeOf(specimen.failing) : 0, row.id);
    assert.deepEqual(outcome.writes, [], row.id);
  }
  const strictCodes = new Set(checkRows.filter(({ strict }) => strict).map(({ specimen }) => strictCodeOf(specimen.failing)));
  assert.deepEqual([...strictCodes].sort(), [0, 1, 3]);
  const failingBases = specimens.filter((specimen) => specimen.kind === 'check' && specimen.failing.length > 0);
  const guards = new Set(failingBases.map((specimen) => /^(S\d+b?)-/.exec(specimen.id)[1]));
  assert.deepEqual([...guards].sort(), ['S1', 'S10', 'S11', 'S16', 'S2', 'S2b', 'S4', 'S8', 'S9']);
  const advisoryOnly = specimens.filter((specimen) => specimen.kind === 'check' && specimen.findings.length > 0 && specimen.failing.length === 0);
  assert.deepEqual(
    advisoryOnly.map((specimen) => specimen.id),
    ['S5-promptfoo-case-swapped', 'S5-deepeval-case-swapped'],
  );
});

test('S8: every unreadable input is exactly one finding of the right id and is never reported as no findings', () => {
  const inputProblems = specimens.filter((specimen) => specimen.id.startsWith('S8-'));
  assert.equal(inputProblems.length, 14);
  for (const specimen of inputProblems) {
    assert.equal(specimen.findings.length, 1, specimen.id);
    assert.match(specimen.findings[0], /^(no-baseline|bad-baseline|bad-run)[: ]/, specimen.id);
    for (const strict of [false, true]) {
      const { stdout } = runRow(cli, rowsOf(specimen)[strict ? 1 : 0]);
      assert.equal(stdout.includes('evals-baseline: no findings'), false, specimen.id);
      assert.equal(stdout.at(-1).startsWith('evals-baseline: 1 finding; '), true, specimen.id);
    }
  }
});

test('S7: the same baseline and run checked a year apart give the same exit code, findings and lines, except the date line', () => {
  for (const { specimen, row } of checkRows) {
    const early = runRow(cli, row, checkDay);
    const late = runRow(cli, row, checkDayAYearLater);
    assert.equal(late.code, early.code, row.id);
    assert.deepEqual(late.findings, early.findings, row.id);
    assert.deepEqual(late.failing, early.failing, row.id);
    assert.equal(late.stdout.length, early.stdout.length, row.id);
    const differing = early.stdout.flatMap((line, index) => (line === late.stdout[index] ? [] : [index]));
    const readBaseline = specimen.head.length === 2;
    assert.deepEqual(differing, readBaseline ? [1] : [], row.id);
    if (readBaseline) {
      assert.match(early.stdout[1], /, 70 days before this check on 2026-11-11$/);
      assert.match(late.stdout[1], /, 435 days before this check on 2027-11-11$/);
    }
  }
});
