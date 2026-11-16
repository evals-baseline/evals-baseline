import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isEscapedCode } from './support/command.mjs';
import { repositoryRoot } from './support/fixtures.mjs';

function jsonFilesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return jsonFilesUnder(path);
    }
    return entry.name.endsWith('.json') ? [path] : [];
  });
}

const hiddenCodePoints = (text) =>
  [...text].filter((character) => character !== '\n' && isEscapedCode(character.codePointAt(0))).map((character) => character.codePointAt(0).toString(16));

test('no committed fixture, table or vector file holds a character that printable would replace, so text handed to a reader or a review agent never carries a payload nobody can see', () => {
  const files = jsonFilesUnder(join(repositoryRoot, 'fixtures'));
  assert.equal(files.length > 50, true);
  assert.equal(files.some((file) => file.endsWith('vectors.json')), true);
  for (const file of files) {
    assert.deepEqual(hiddenCodePoints(readFileSync(file, 'utf8')), [], file);
  }
});

test('the check of this test sees a character in the Tags block, a joiner and a soft hyphen', () => {
  assert.deepEqual(hiddenCodePoints('a\u{e0069}b\u200dc\u00add'), ['e0069', '200d', 'ad']);
  assert.deepEqual(hiddenCodePoints('plain text, \u00e9 \u65e5\u672c\n'), []);
});
