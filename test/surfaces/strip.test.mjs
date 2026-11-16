import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BuildRefusal, stripPart } from '../../build/lib/strip.mjs';

const strip = (text, { path = 'src/command.mjs', earlier = ['src/render.mjs', 'src/compare.mjs'] } = {}) =>
  stripPart({ path, text, earlier: new Set(earlier) });

const refusal = (text, options) => {
  try {
    strip(text, options);
  } catch (error) {
    assert.ok(error instanceof BuildRefusal, `expected a BuildRefusal, got ${error}`);
    return error.message;
  }
  return assert.fail('expected the part to be refused');
};

test('removes a relative named import and leaves every other byte alone', () => {
  const text = "import { render } from './render.mjs';\n\nconst shown = render('  keep   spacing ');\n";
  assert.equal(strip(text), "\nconst shown = render('  keep   spacing ');\n");
});

test('removes a multi-line relative import', () => {
  const text = "import {\n  render,\n  compare,\n} from './render.mjs';\nconst a = 1;\n";
  assert.equal(strip(text), 'const a = 1;\n');
});

test('removes a relative import written without a semicolon', () => {
  assert.equal(strip("import { render } from './render.mjs'\nconst a = 1\n"), 'const a = 1\n');
});

test('removes a relative import in a file with carriage-return line endings', () => {
  assert.equal(strip("import { render } from './render.mjs';\r\nconst a = 1;\r\n"), 'const a = 1;\r\n');
});

test('resolves a parent-relative import against the path of the part', () => {
  const text = "import { cli } from '../../src/command.mjs';\ncli();\n";
  assert.equal(strip(text, { path: 'build/entries/copy-main.mjs', earlier: ['src/command.mjs'] }), 'cli();\n');
});

test('keeps a node: import exactly where it stands', () => {
  const text = "const a = 1;\nimport { createHash } from 'node:crypto';\nconst b = createHash;\n";
  assert.equal(strip(text), text);
});

test('removes the export keyword from every supported declaration form', () => {
  const text = [
    'export function one() {}',
    'export async function two() {}',
    'export function* three() {}',
    'export const four = 4;',
    'export let five = 5;',
    'export class Six extends Error {}',
    '',
  ].join('\n');
  const expected = [
    'function one() {}',
    'async function two() {}',
    'function* three() {}',
    'const four = 4;',
    'let five = 5;',
    'class Six extends Error {}',
    '',
  ].join('\n');
  assert.equal(strip(text), expected);
});

test('leaves the word export alone when it is not a declaration at the start of a line', () => {
  const text = "const label = 'export default';\n  // export const x = 1;\nconst exported = 1;\n";
  assert.equal(strip(text), text);
});

test('refuses an import from a bare specifier and names the file and line', () => {
  const message = refusal("const a = 1;\nimport left from 'left-pad';\n");
  assert.match(message, /^src\/command\.mjs:2: /);
  assert.match(message, /left-pad/);
});

test('refuses a built-in imported without the node: prefix', () => {
  assert.match(refusal("import { readFileSync } from 'fs';\n"), /'fs'/);
});

const REFUSED = [
  ['a default import of a relative module', "import render from './render.mjs';\n"],
  ['a namespace import of a relative module', "import * as render from './render.mjs';\n"],
  ['an aliased import of a relative module', "import { render as show } from './render.mjs';\n"],
  ['a side-effect import of a relative module', "import './render.mjs';\n"],
  ['export default', 'export default function () {}\n'],
  ['a re-export', "export * from './render.mjs';\n"],
  ['import.meta', 'const here = import.meta.url;\n'],
  ['a dynamic import', "const m = await import('./render.mjs');\n"],
];

for (const [name, text] of REFUSED) {
  test(`refuses ${name}`, () => {
    refusal(text);
  });
}

test('refuses a relative import of a part that does not come earlier in the file', () => {
  const message = refusal("import { later } from './later.mjs';\n");
  assert.match(message, /src\/later\.mjs/);
});

test('refuses an export list', () => {
  assert.match(refusal('const a = 1;\nexport { a };\n'), /^src\/command\.mjs:2: .*export \{ a \}/);
});
