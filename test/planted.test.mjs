import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fixturePath, readFixtureText } from './support/fixtures.mjs';
import { planted } from './support/planted.mjs';

const sourceTextOf = ({ tool, source }) => (source === null ? '' : readFixtureText(tool, source));

for (const entry of planted) {
  const name = `${entry.tool}/planted/${entry.file}`;

  test(`${name} matches what its derivation produces`, () => {
    const committed = readFileSync(fixturePath(entry.tool, 'planted', entry.file));
    assert.deepEqual(Buffer.from(entry.derive(sourceTextOf(entry)), 'utf8'), committed);
  });

  test(`${name} derives to the same text every time`, () => {
    const sourceText = sourceTextOf(entry);
    assert.equal(entry.derive(sourceText), entry.derive(sourceText));
  });

  test(`${name} is committed`, () => {
    assert.ok(existsSync(fixturePath(entry.tool, 'planted', entry.file)));
  });
}

for (const tool of ['promptfoo', 'deepeval']) {
  test(`every file in ${tool}/planted is listed`, () => {
    const listed = planted.filter((entry) => entry.tool === tool).map((entry) => entry.file).sort();
    const onDisk = existsSync(fixturePath(tool, 'planted')) ? readdirSync(fixturePath(tool, 'planted')).sort() : [];
    assert.deepEqual(onDisk, listed);
  });
}
