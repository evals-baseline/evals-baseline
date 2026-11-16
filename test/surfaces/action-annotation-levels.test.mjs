import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { MINI_FIXTURES, miniToolSources } from './mini-tool.mjs';
import { miniRepository } from './mini-repository.mjs';
import { ROOT, runAction, runNode } from './support.mjs';

const MANY = 12;
const SHOWN = 10;
const ENTRY = 'build/entries/action-lib.mjs';

const findingLine = (index) => `finding agent :: metric ${index}: below the baseline`;
const manyLines = Array.from({ length: MANY }, (_, index) => findingLine(index + 1));
const FILES = { ...MINI_FIXTURES, 'fixtures/mini/run-many.txt': `${manyLines.join('\n')}\n` };

const asError = (line) => `::error title=evals-baseline::${line}`;
const asWarning = (line) => `::warning title=evals-baseline::${line}`;
const notice = `::notice title=evals-baseline::Not shown as annotations: ${MANY - SHOWN} findings. GitHub shows at most ${SHOWN} error annotations and ${SHOWN} warning annotations for each step. Read the report in the log of this step to see every finding.`;

const inputs = (runFile, strict) => ({ 'run-file': runFile, baseline: 'evals-baseline.json', strict });

function builtRepository(t, entryText) {
  const root = miniRepository(t, { sources: miniToolSources(), files: FILES });
  if (entryText !== undefined) writeFileSync(join(root, ENTRY), entryText);
  const built = runNode(['build/build.mjs'], { cwd: root });
  assert.equal(built.code, 0, built.output);
  return root;
}

function plantedRepository(t, plant) {
  const original = readFileSync(join(ROOT, ENTRY), 'utf8');
  const planted = plant(original);
  assert.notEqual(planted, original, 'the plant changed nothing');
  return builtRepository(t, planted);
}

function assertLevelsAndCap(t, root) {
  const strict = runAction(t, root, inputs('run-many.txt', 'true'));
  assert.deepEqual(strict.annotations, [...manyLines.slice(0, SHOWN).map(asError), notice]);
  assert.equal(strict.code, 1);
  assert.deepEqual(strict.report.filter((line) => line.startsWith('finding ')), manyLines);

  const lenient = runAction(t, root, inputs('run-many.txt', 'false'));
  assert.deepEqual(lenient.annotations, [...manyLines.slice(0, SHOWN).map(asWarning), notice]);
  assert.equal(lenient.code, 0);

  const few = runAction(t, root, inputs('run-findings.txt', 'false'));
  assert.deepEqual(few.annotations, [
    asWarning('finding agent :: accuracy: 0.75 is below the baseline 1'),
    asWarning('finding agent :: format: missing'),
  ]);
  assert.equal(few.code, 0);
}

test('a run that fails prints an error for each finding up to 10, then one notice with the count it left out, and the log keeps every finding', (t) => {
  assertLevelsAndCap(t, builtRepository(t));
});

const PLANTS = [
  [
    'colours every finding as an error, whether or not the run failed',
    (text) => text.replace('new Set(code === PASSED ? [] : failing)', 'new Set(failing)'),
  ],
  [
    'colours no finding as an error, even when the run failed',
    (text) => text.replace('new Set(code === PASSED ? [] : failing)', 'new Set([])'),
  ],
  ['says nothing when it leaves findings out', (text) => text.replace(/if \(notShown > 0\) \{[\s\S]*?\n  \}\n/, '')],
  ['does not cap', (text) => text.replace('const ANNOTATIONS_PER_LEVEL = 10;', 'const ANNOTATIONS_PER_LEVEL = 1000;')],
  ['counts one finding too many as left out', (text) => text.replace('notShownText(notShown)', 'notShownText(notShown + 1)')],
];

for (const [name, plant] of PLANTS) {
  test(`goes red when the action ${name}`, (t) => {
    const planted = plantedRepository(t, plant);
    assert.throws(() => assertLevelsAndCap(t, planted), assert.AssertionError);
  });
}
