import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import { readBaseline, specificationVersion } from '../src/read-baseline.mjs';
import { packageVersion } from '../src/render.mjs';
import { assertSafeOutput, hostilePrinted, hostileText, plantedNames, promptfooFile, promptfooIo, quoted, usage } from './support/command.mjs';
import { makeIo } from './support/io.mjs';

test('--version prints the package version and the specification version and nothing else', () => {
  assert.deepEqual(cli(['--version']), {
    stdout: [`evals-baseline ${packageVersion} (specification ${specificationVersion})`],
    stderr: [],
    code: 0,
    findings: [],
    failing: [],
  });
});

test('usage errors print nothing to stdout, exit 2 and put the text on stderr', () => {
  const bare = [[], ['check'], ['record'], ['show'], ['check', 'a.json', 'b.json'], ['frobnicate', 'a.json'], ['--version', 'a.json'], ['check', 'a.json', '--baseline', 'x.json', 'b.json']];
  for (const argv of bare) {
    assert.deepEqual(cli(argv, makeIo()), { stdout: [], stderr: [usage], code: 2, findings: [], failing: [] }, JSON.stringify(argv));
  }
});

test('a flag or a value that is wrong ends stderr with the usage line, prints nothing to stdout and exits 2', () => {
  const table = [
    ['check', 'a.json', '--frobnicate'],
    ['check', 'a.json', '--version'],
    ['check', 'a.json', '-x'],
    ['check', 'a.json', '--tolerance', '0.1'],
    ['check', 'a.json', '--tolerance=0.1'],
    ['record', 'a.json', '--strict'],
    ['show', 'a.json', '--baseline', 'b.json'],
    ['show', 'a.json', '--strict'],
    ['check', 'a.json', '--baseline'],
    ['check', 'a.json', '--baseline', '--strict'],
    ['check', 'a.json', '--baseline', 'x.json', '--baseline', 'y.json'],
    ['check', 'a.json', '--strict', '--strict'],
    ['record', 'a.json', '--tolerance'],
    ['record', 'a.json', '--tolerance', 'abc'],
    ['record', 'a.json', '--tolerance', '-0.1'],
    ['record', 'a.json', '--tolerance', ''],
    ['record', 'a.json', '--tolerance', '0x10'],
    ['record', 'a.json', '--tolerance', 'Infinity'],
    ['record', 'a.json', '--tolerance', '1e3'],
    ['record', 'a.json', '--tolerance', '99999999999'],
    ['record', 'a.json', '--tolerance', '4000000001'],
    ['record', 'a.json', '--tolerance', '4000000000.000001'],
    ['record', 'a.json', '--tolerance', '9000000000'],
    ['record', 'a.json', '--tolerance', '0.1', '--tolerance', '0.2'],
  ];
  for (const argv of table) {
    const output = cli(argv, makeIo());
    assert.deepEqual(output.stdout, [], JSON.stringify(argv));
    assert.equal(output.code, 2, JSON.stringify(argv));
    assert.equal(output.stderr.at(-1), usage, JSON.stringify(argv));
    assert.deepEqual([output.findings, output.failing], [[], []], JSON.stringify(argv));
  }
});

test('a flag value that came from the command line is escaped before it is printed', () => {
  const output = cli(['check', 'a.json', '--bad\u001b[31m\n::error::x'], makeIo());
  const text = output.stderr.join('\n');
  assert.equal(text.includes('\u001b'), false);
  assert.equal(text.includes('\n::error::x'), false);
  assert.equal(output.stderr.length, 2);
  assert.equal(output.stderr[0], 'evals-baseline: unknown flag "--bad\\u001b[31m\\u000a::error::x"');
  assert.equal(output.stderr.at(-1), usage);
});

test('numbers that are plain decimals and at least 0 are accepted as a tolerance', () => {
  for (const value of ['0', '0.0', '1', '0.02', '.5', '5.', '000.25', '4000000000']) {
    const output = cli(['record', 'run-good-again.json', '--tolerance', value], makeIo({ 'run-good-again.json': promptfooFile('run-good-again.json') }));
    assert.equal(output.code, 0, value);
  }
});

test('a tolerance of 4000000000 is written to the baseline and read back, and 4000000001 is refused with the number it was given', () => {
  const recording = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  assert.equal(cli(['record', 'run-good.json', '--tolerance', '4000000000'], recording).code, 0);
  assert.deepEqual(
    readBaseline(recording.writes.at(-1)[1], 'evals-baseline.json').metrics.map((metric) => metric.tolerance),
    [4000000000, 4000000000],
  );
  const refusing = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  const refused = cli(['record', 'run-good.json', '--tolerance', '4000000001'], refusing);
  assert.deepEqual([refused.stdout, refused.code, refused.findings, refused.failing], [[], 2, [], []]);
  assert.equal(refused.stderr.at(-1), usage);
  assert.equal(refused.stderr[0].includes('4000000001'), true);
  assert.deepEqual(refusing.writes, []);
});

for (const { label, name, printed } of plantedNames) {
  test(`usage errors print ${label}, given as a flag or as a tolerance, escaped on stderr and start every line with a fixed word`, () => {
    const unknownFlag = cli(['check', 'a.json', `--${name}`], makeIo());
    assert.deepEqual(unknownFlag, { stdout: [], stderr: [`evals-baseline: unknown flag ${quoted(`--${printed}`)}`, usage], code: 2, findings: [], failing: [] });
    const badTolerance = cli(['record', 'a.json', '--tolerance', name], makeIo());
    assert.deepEqual(badTolerance, {
      stdout: [],
      stderr: [`evals-baseline: --tolerance needs a number of at least 0, got "${printed}"`, usage],
      code: 2,
      findings: [],
      failing: [],
    });
    assertSafeOutput(unknownFlag, 'flag');
    assertSafeOutput(badTolerance, 'tolerance');
  });
}

test('a flag and a tolerance that carry every kind of hostile text are escaped on stderr, and nothing reaches stdout', () => {
  const unknownFlag = cli(['show', 'a.json', `--${hostileText}`], makeIo());
  assert.deepEqual(unknownFlag.stderr, [`evals-baseline: unknown flag ${quoted(`--${hostilePrinted}`)}`, usage]);
  const badTolerance = cli(['record', 'a.json', '--tolerance', hostileText], makeIo());
  assert.deepEqual(badTolerance.stderr, [`evals-baseline: --tolerance needs a number of at least 0, got "${hostilePrinted}"`, usage]);
  for (const output of [unknownFlag, badTolerance]) {
    assert.deepEqual([output.stdout, output.code], [[], 2]);
    assertSafeOutput(output);
  }
});

test('a flag with a double quote or a backslash prints both as escapes inside the delimiters', () => {
  const output = cli(['check', 'a.json', '--a"b\\c'], makeIo());
  assert.deepEqual(output.stderr, ['evals-baseline: unknown flag "--a\\u0022b\\\\c"', usage]);
  assert.deepEqual(output.stdout, []);
});
