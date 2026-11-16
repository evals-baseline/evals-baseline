import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli } from '../src/command.mjs';
import {
  assertSafeOutput,
  banner,
  baselineWithMetric,
  deepevalIo,
  erroredNote,
  hostilePrinted,
  hostileText,
  inversionReason,
  isEscapedCode,
  plantedNames,
  promptfooFile,
  quoted,
  runErroringMetric,
  runOfMetric,
  runRefusingMetric,
} from './support/command.mjs';
import { editedFixture } from './support/fixtures.mjs';
import { failure, makeIo } from './support/io.mjs';

for (const { label, name, printed } of plantedNames) {
  test(`record prints ${label}, used as a metric name, escaped when it refuses, when it refuses to replace, when nothing changed and when it replaces findings`, () => {
    const refusedRun = cli(['record', 'run-good.json'], makeIo({ 'run-good.json': runErroringMetric(name) }));
    assert.deepEqual(refusedRun.stdout, [
      `${banner} record: refused: the run has errored samples (${erroredNote(printed)}); fix them and run the suite again; nothing written`,
    ]);
    assert.equal(refusedRun.code, 3);

    const notRecorded = `note: ${quoted(printed)} not recorded: ${inversionReason}`;
    const io = makeIo({ 'run-inverted.json': runRefusingMetric(name) });
    const wrote = cli(['record', 'run-inverted.json', '--tolerance', '0'], io);
    assert.deepEqual(wrote.stdout, [`${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, deepeval version unknown)`, notRecorded]);
    const unchanged = cli(['record', 'run-inverted.json'], io);
    assert.deepEqual(unchanged.stdout, [
      `${banner} record: unchanged: "evals-baseline.json" already holds these values; not rewritten (recorded 2026-11-11)`,
      notRecorded,
    ]);

    const holdingTheName = () => deepevalIo('run-good.json', { 'evals-baseline.json': baselineWithMetric(name) });
    const declining = cli(['record', 'run-good.json'], holdingTheName());
    assert.deepEqual(declining.stdout, [
      `${banner} record: refused: "evals-baseline.json" already holds a baseline of 3 metrics and 4 cases, recorded 2026-09-02; this run would replace it with a baseline of 2 metrics and 4 cases; pass --replace to replace it; nothing written`,
      `note: ${quoted(printed)}: would be removed; the baseline holds 1 over 4 samples, with the tolerance 0`,
    ]);

    const replacing = cli(['record', 'run-good.json', '--replace'], holdingTheName());
    assert.deepEqual(replacing.stdout, [
      `${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, deepeval version unknown)`,
      'replaced: the previous baseline would have reported 1 finding against this run:',
      `  missing-metric ${quoted(printed)}: the baseline names it (1 over 4 samples) and this run has no such metric`,
    ]);

    assert.deepEqual([wrote.code, unchanged.code, replacing.code], [0, 0, 0]);
    assert.equal(declining.code, refusedRun.code);
    for (const [outcome, output] of [['refused', refusedRun], ['wrote', wrote], ['unchanged', unchanged], ['declined', declining], ['replaced', replacing]]) {
      assertSafeOutput(output, outcome);
    }
  });
}

const goodRun = promptfooFile('run-good.json');

const versionedRun = editedFixture('promptfoo', 'run-good.json', (run) => {
  run.metadata.promptfooVersion = hostileText;
});

const toHostileBaseline = ['record', 'run-good.json', '--baseline', hostileText, '--tolerance', '0'];

const hostileSlots = [
  ['the path of a run that is not there', ['record', hostileText], {}, 3, [`${banner} record: refused: cannot read ${quoted(hostilePrinted)}: not found; nothing written`]],
  ['the path of a run that is not JSON', ['record', hostileText], { [hostileText]: 'not json' }, 3, [`${banner} record: refused: ${quoted(hostilePrinted)}: not JSON; nothing written`]],
  ['the path of the baseline that is written', toHostileBaseline, { 'run-good.json': goodRun }, 0, [`${banner} record: wrote ${quoted(hostilePrinted)} (2 metrics, 4 cases, promptfoo "0.125.1")`]],
  [
    'the path and the error code of a baseline that cannot be opened',
    toHostileBaseline,
    { 'run-good.json': goodRun, [hostileText]: failure(hostileText) },
    3,
    [`${banner} record: refused: cannot read ${quoted(hostilePrinted)}: ${hostilePrinted}; nothing written`],
  ],
  [
    'the path and the error code of a baseline that cannot be written',
    toHostileBaseline,
    { 'run-good.json': goodRun, [`write:${hostileText}`]: failure(hostileText) },
    3,
    [`${banner} record: refused: cannot write ${quoted(hostilePrinted)}: ${hostilePrinted}; nothing written`],
  ],
  ['the tool version of the run', ['record', 'run-good.json', '--tolerance', '0'], { 'run-good.json': versionedRun }, 0, [`${banner} record: wrote "evals-baseline.json" (2 metrics, 4 cases, promptfoo ${quoted(hostilePrinted)})`]],
  ['the message of an exception', ['record', 'run-good.json'], { 'run-good.json': new TypeError(hostileText) }, 3, [`${banner} record: refused: internal-error: ${quoted(hostilePrinted)}; nothing written`]],
];

for (const [slot, argv, files, code, stdout] of hostileSlots) {
  test(`record prints hostile text in ${slot} escaped, and starts every line with a fixed word`, () => {
    const output = cli(argv, makeIo(files));
    assert.deepEqual(output, { stdout, stderr: [], code, findings: [], failing: [] });
    assertSafeOutput(output, slot);
  });
}

test('record twice into a baseline path with hostile text is unchanged the second time and names the path escaped', () => {
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json') });
  const argv = ['record', 'run-good.json', '--baseline', hostileText, '--tolerance', '0'];
  cli(argv, io);
  const output = cli(argv, io);
  assert.deepEqual(output.stdout, [`${banner} record: unchanged: ${quoted(hostilePrinted)} already holds these values; not rewritten (recorded 2026-11-11)`]);
  assertSafeOutput(output);
});

test('record over a baseline the reader refuses prints the hostile path and the hostile key in the reader reason escaped', () => {
  const baseline = JSON.stringify({ spec: '1.0', [hostileText]: 1 });
  const io = makeIo({ 'run-good.json': promptfooFile('run-good.json'), [hostileText]: baseline });
  const output = cli(['record', 'run-good.json', '--baseline', hostileText], io);
  assert.equal(output.stdout.length, 1);
  assert.equal(output.stdout[0].startsWith(`${banner} record: refused: ${quoted(hostilePrinted)}: unknown key ${quoted(hostilePrinted)} in the baseline`), true);
  assert.equal(output.code, 3);
  assertSafeOutput(output);
});

test('record writes a hostile metric key as JSON escapes: the file reads back to the key and holds no character that would be escaped', () => {
  const key = `${hostileText}\u200d\u{e0069}`;
  const io = makeIo({ 'run-good.json': runOfMetric(key) });
  assert.equal(cli(['record', 'run-good.json', '--tolerance', '0'], io).code, 0);
  const [[, text]] = io.writes;
  assert.deepEqual(Object.keys(JSON.parse(text).metrics), [key]);
  for (const character of text.replaceAll('\n', '')) {
    assert.equal(isEscapedCode(character.codePointAt(0)), false, JSON.stringify(character));
  }
  assert.equal(text.includes('\\u200d\\udb40\\udc69'), true);
});
