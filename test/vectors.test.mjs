import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { specificationVersion } from '../src/read-baseline.mjs';
import { repositoryRoot } from './support/fixtures.mjs';
import { extraRows } from './support/vector-extras.mjs';
import { vectorProblems } from './support/vector-run.mjs';
import { coverOrder, countsOf, specimenRows, vectorDocument, vectorText } from './support/vectors.mjs';

const committedText = readFileSync(join(repositoryRoot, 'fixtures', 'vectors.json'), 'utf8');
const document = JSON.parse(committedText);
const { vectors } = document;

const namedPathsOf = (candidate) =>
  [...new Set(candidate.vectors.flatMap((vector) => [vector.baseline, vector.run]).filter((path) => path !== null))].sort();
const existsOnDisk = (path) => existsSync(join(repositoryRoot, path));
const textOnDisk = (path) => readFileSync(join(repositoryRoot, path), 'utf8');
const filesOnDisk = Object.fromEntries(namedPathsOf(document).filter(existsOnDisk).map((path) => [path, textOnDisk(path)]));
const filesNamedBy = (vector, files) =>
  Object.fromEntries([vector.baseline, vector.run].filter((path) => path !== null && Object.hasOwn(files, path)).map((path) => [path, files[path]]));
const textOutsideReports = (value) =>
  typeof value === 'string'
    ? [value]
    : Object.entries(value ?? {}).flatMap(([key, item]) => (key === 'stdout' || key === 'stderr' ? [] : textOutsideReports(item)));

const byId = (id) => vectors.find((vector) => vector.id === id);
const problemsAfter = (id, edit) => {
  const copy = structuredClone(byId(id));
  edit(copy);
  return vectorProblems(copy, filesOnDisk);
};

test('the vectors belong to the specification this implementation implements', () => {
  assert.equal(document.specification, specificationVersion);
  assert.equal(document.specification, '1.0');
});

test('fixtures/vectors.json is exactly what the generator writes, byte for byte, and reads back to the same document', () => {
  const generated = vectorDocument();
  assert.equal(committedText, vectorText(generated));
  assert.deepEqual(document, generated);
});

test('every specimen row has a vector with the same id, directory and arguments, in the same order, and the extra vectors follow them', () => {
  const rows = specimenRows();
  assert.equal(rows.length > 0, true);
  const identity = ({ id, dir, argv }) => ({ id, dir, argv });
  assert.deepEqual(vectors.slice(0, rows.length).map(identity), rows.map(identity));
  assert.deepEqual(
    vectors.slice(rows.length).map((vector) => vector.id),
    extraRows.map((row) => row.id),
  );
});

test('vector ids are unique and every directory a vector names exists', () => {
  assert.equal(new Set(vectors.map((vector) => vector.id)).size, vectors.length);
  for (const vector of vectors) {
    assert.equal(existsSync(join(repositoryRoot, vector.dir)), true, vector.id);
  }
});

for (const vector of vectors) {
  test(`${vector.id}: from the files it names alone, the report is the one the implementation prints and the one written by hand`, () => {
    assert.deepEqual(vectorProblems(vector, filesNamedBy(vector, document.files)), []);
  });
}

test('every vector pins its own instant at noon UTC, and no expected line carries the package version of the implementation', () => {
  for (const vector of vectors) {
    assert.match(vector.now, /^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/, vector.id);
    assert.equal(
      vector.stdout.some((line) => /^evals-baseline \d/.test(line)),
      false,
      vector.id,
    );
  }
  assert.deepEqual([...new Set(vectors.map((vector) => vector.now))].sort(), ['2026-11-11T12:00:00.000Z', '2027-11-11T12:00:00.000Z']);
});

test('S7: a vector checked a year later differs from its base vector in the date line alone', () => {
  const baseOf = {
    'S7-promptfoo-one-case-wrong-a-year-later': 'S2-promptfoo-one-case-wrong',
    'S7-promptfoo-one-case-wrong-a-year-later-strict': 'S2-promptfoo-one-case-wrong-strict',
  };
  for (const [laterId, baseId] of Object.entries(baseOf)) {
    const later = byId(laterId);
    const base = byId(baseId);
    assert.equal(later.code, base.code);
    assert.equal(later.stdout.length, base.stdout.length);
    const differing = later.stdout.flatMap((line, index) => (line === base.stdout[index] ? [] : [index]));
    assert.deepEqual(differing, [1]);
    assert.match(base.stdout[1], /, 70 days before this check on 2026-11-11$/);
    assert.match(later.stdout[1], /, 435 days before this check on 2027-11-11$/);
  }
});

test('a vector pair exists for each of rules 1 to 4, the binding check and each refusal, and all but internal-error can be reproduced elsewhere', () => {
  assert.deepEqual(coverOrder, [
    'rule-1',
    'rule-2',
    'rule-3',
    'rule-4',
    'binding-check',
    'no-baseline',
    'bad-baseline',
    'bad-run',
    'unreadable-metric',
    'internal-error',
  ]);
  for (const token of coverOrder) {
    const having = vectors.filter((vector) => vector.covers.includes(token));
    assert.equal(having.length > 0, true, token);
    const portable = having.filter((vector) => vector.referenceOnly === undefined);
    assert.equal(portable.length > 0, token !== 'internal-error', token);
  }
});

test('the vectors that print an internal-error finding or a reason line before the usage line are reference only, no other vector is, and each says why', () => {
  const worded = (vector) => vector.covers.includes('internal-error') || (vector.code === 2 && vector.stderr.length > 1);
  for (const vector of vectors) {
    assert.equal(vector.referenceOnly !== undefined, worded(vector), vector.id);
    if (vector.referenceOnly !== undefined) {
      assert.match(vector.referenceOnly, /message of the exception|wording of why the arguments were refused/);
    }
  }
});

test('the counts block is what the vectors add up to', () => {
  assert.deepEqual(document.counts, countsOf(vectors));
  assert.equal(document.counts.vectors, vectors.length);
});

const candidates = [
  ['the committed file', () => document],
  ['the generator', () => vectorDocument()],
];

for (const [label, load] of candidates) {
  test(`${label}: files comes last and holds the exact text of every baseline and run path that names a file, once each, in code-unit order`, () => {
    const candidate = load();
    assert.equal(Object.keys(candidate).at(-1), 'files');
    const named = namedPathsOf(candidate);
    assert.equal(
      named.some((path) => !existsOnDisk(path)),
      true,
      'no vector names a file that does not exist, so the rule that such a path is no key is not exercised',
    );
    assert.deepEqual(Object.keys(candidate.files), named.filter(existsOnDisk));
    for (const [path, text] of Object.entries(candidate.files)) {
      assert.equal(text, textOnDisk(path), path);
    }
  });

  test(`${label}: about has one entry that says what files is and how to run a vector from it`, () => {
    const entries = load().about.filter((text) => /\bfiles maps\b/.test(text));
    assert.equal(entries.length, 1);
    const recipe = [
      /not a key names a file that does not exist/,
      /fresh directory/,
      /removing dir and the slash after it from the key/,
      /clock set to now/,
    ];
    for (const wording of recipe) {
      assert.match(entries[0], wording);
    }
  });

  test(`${label}: no text in the document, apart from the reports it quotes, cites a section number of the design document`, () => {
    assert.deepEqual(textOutsideReports(load()).flatMap((text) => text.match(/\b(specification|section) \d+(\.\d+)*/gi) ?? []), []);
  });
}

test('every baseline and run path starts with the dir of its vector, so removing dir and the slash after it leaves a path inside dir', () => {
  for (const vector of vectors) {
    for (const path of [vector.baseline, vector.run].filter((named) => named !== null)) {
      assert.equal(path.startsWith(`${vector.dir}/`), true, `${vector.id}: ${path}`);
    }
  }
});

const splitOrReorderCharacters = [
  [0x80, 0x9f],
  [0x2028, 0x2029],
  [0x61c, 0x61c],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
].flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, offset) => String.fromCharCode(first + offset)));
const escapeOf = (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
const rawNeighbours = String.fromCharCode(0xa1, 0x61b, 0x61d, 0x2010, 0x2027, 0x2030);
const invisibleNeighbours = String.fromCharCode(0x7f, 0xa0, 0x200d, 0x202f, 0x2065, 0x206a);

test('vectorText writes no line separator, control or direction mark raw, touches no character next to them, and reads back to the same document', () => {
  const hostile = splitOrReorderCharacters.join('');
  const synthetic = {
    specification: '1.0',
    about: [`a${hostile}`, `\\${hostile}\\`],
    counts: { vectors: 1 },
    vectors: [{ id: 'x', stdout: [`b${hostile}`] }],
    files: { [`dir/${hostile}.json`]: `c${hostile}${rawNeighbours}${invisibleNeighbours}` },
  };
  const text = vectorText(synthetic);
  assert.deepEqual(splitOrReorderCharacters.filter((character) => text.includes(character)).map(escapeOf), []);
  assert.deepEqual(splitOrReorderCharacters.filter((character) => !text.includes(escapeOf(character))).map(escapeOf), []);
  assert.deepEqual([...rawNeighbours].filter((character) => !text.includes(character)).map(escapeOf), []);
  assert.deepEqual([...invisibleNeighbours].filter((character) => text.includes(character)).map(escapeOf), []);
  assert.deepEqual([...invisibleNeighbours].filter((character) => !text.includes(escapeOf(character))).map(escapeOf), []);
  assert.deepEqual(JSON.parse(text), synthetic);
});

test('the committed file holds no line separator, control or direction mark raw', () => {
  assert.deepEqual(splitOrReorderCharacters.filter((character) => committedText.includes(character)).map(escapeOf), []);
});

test('the check can fail: an edited line, a dropped line, another exit code, another instant, another command line, stale covers, a baked-in package version, lost writes and an unknown id are each reported', () => {
  const worse = 'S2-promptfoo-one-case-wrong';
  const rerecord = 'S13-promptfoo-record-over-regression';
  const planted = [
    [worse, (vector) => (vector.stdout[2] = vector.stdout[2].replace('0.75', '0.76')), 'stdout against'],
    [worse, (vector) => vector.stdout.pop(), 'stdout against'],
    [worse, (vector) => (vector.code = 1), 'code against'],
    [worse, (vector) => (vector.now = '2027-11-11T12:00:00.000Z'), 'stdout against'],
    [worse, (vector) => (vector.argv = [...vector.argv, '--strict']), 'code against'],
    [worse, (vector) => (vector.covers = ['rule-1']), 'covers'],
    [worse, (vector) => (vector.stdout[0] = vector.stdout[0].replace('<package version>', '1.0.0')), 'stdout against'],
    [rerecord, (vector) => (vector.writes = []), 'writes against'],
    [rerecord, (vector) => (vector.writes[0].content = vector.writes[0].content.replace('0.75', '0.76')), 'writes against'],
    [worse, (vector) => (vector.baseline = 'fixtures/promptfoo/elsewhere.json'), 'baseline'],
    [worse, (vector) => (vector.id = 'S2-promptfoo-no-such-specimen'), 'no hand-written report'],
  ];
  for (const [id, edit, mention] of planted) {
    const problems = problemsAfter(id, edit);
    assert.equal(
      problems.some((problem) => problem.includes(mention)),
      true,
      `${id} after ${edit}: ${JSON.stringify(problems)}`,
    );
  }
});

test('the check reads the files and nothing else: a key removed from files or one byte changed in a text is reported', () => {
  const planted = [
    ['S2-promptfoo-one-case-wrong', (files, vector) => delete files[vector.baseline]],
    ['S2-promptfoo-one-case-wrong', (files, vector) => delete files[vector.run]],
    ['S13-promptfoo-record-over-regression', (files, vector) => delete files[vector.baseline]],
    ['S13-promptfoo-record-over-regression', (files, vector) => delete files[vector.run]],
    ['S2-promptfoo-one-case-wrong', (files, vector) => (files[vector.baseline] = files[vector.baseline].replace('2026-09-02', '2026-09-03'))],
    ['S2-deepeval-one-case-wrong', (files, vector) => (files[vector.run] = files[vector.run].replace('"score": 1.0', '"score": 0.0'))],
  ];
  for (const [id, edit] of planted) {
    const vector = byId(id);
    assert.deepEqual(vectorProblems(vector, filesOnDisk), [], id);
    const files = { ...filesOnDisk };
    edit(files, vector);
    const problems = vectorProblems(vector, files);
    assert.equal(
      problems.some((problem) => problem.includes('against the implementation')),
      true,
      `${id} after ${edit}: ${JSON.stringify(problems)}`,
    );
  }
});
