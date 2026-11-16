import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DYNAMIC_CODE_MODULES,
  DYNAMIC_CODE_NAMES,
  NETWORK_MODULES,
  NETWORK_NAMES,
  scanText,
} from '../../build/lib/scan.mjs';

const violationsOf = (text, guard) => scanText(text).filter((violation) => violation.guard === guard);

test('the import guard passes node: imports, written on one line or on several', () => {
  const text = "import { createHash } from 'node:crypto';\nimport {\n  readFileSync,\n  appendFileSync,\n} from 'node:fs';\nconst m = await import('node:path');\n";
  assert.deepEqual(violationsOf(text, 'imports'), []);
});

test('the import guard ignores the text of an import that is not a statement', () => {
  assert.deepEqual(violationsOf("const s = \"import left from 'left-pad'\";\n", 'imports'), []);
});

for (const [label, text] of [
  ['a bare package', "import left from 'left-pad';\n"],
  ['a double-quoted bare package without a semicolon', 'import left from "left-pad"\n'],
  ['a relative module left behind by the generator', "import { a } from './a.mjs';\n"],
  ['a parent-relative module', "import { a } from '../a.mjs';\n"],
  ['a side-effect import', "import 'polyfill';\n"],
  ['a built-in without the node: prefix', "import { readFileSync } from 'fs';\n"],
  ['a URL', "import x from 'https://example.com/x.mjs';\n"],
  ['a re-export', "export { a } from 'lodash';\n"],
  ['a dynamic import of a package', "const m = await import('lodash');\n"],
  ['a dynamic import with a computed specifier', 'const m = await import(name);\n'],
  ['a require of a package', "const r = require('lodash');\n"],
  ['a require with a computed specifier', 'const r = require(name);\n'],
]) {
  test(`the import guard refuses ${label}`, () => {
    const found = violationsOf(`const first = 1;\nconst second = 2;\n${text}`, 'imports');
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0].line, 3);
  });
}

test('the import guard names the specifier it refused', () => {
  const [violation] = violationsOf("import left from 'left-pad';\n", 'imports');
  assert.equal(violation.message, "import of 'left-pad' is not node:-prefixed");
});

for (const name of NETWORK_NAMES) {
  test(`the network guard refuses the name ${name}`, () => {
    const found = violationsOf(`const first = 1;\nconst second = 2;\nvoid ${name};\n`, 'network');
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0].line, 3);
    assert.equal(found[0].message, `network API name "${name}"`);
  });
}

for (const name of NETWORK_MODULES) {
  for (const [form, text] of [
    ['a static import', `import * as m from 'node:${name}';`],
    ['a dynamic import', `const m = await import('node:${name}');`],
    ['a require', `const m = require('node:${name}');`],
    ['an unprefixed import', `import * as m from '${name}';`],
  ]) {
    test(`the network guard refuses ${form} of the ${name} module`, () => {
      const found = violationsOf(`const first = 1;\nconst second = 2;\n${text}\n`, 'network');
      assert.equal(found.length, 1, JSON.stringify(found));
      assert.equal(found[0].line, 3);
      assert.equal(found[0].message, `network module "${name}"`);
    });
  }
}

test('the network guard passes names that only contain a network name', () => {
  const text = "const prefetch = 1;\nconst fetched = 2;\nconst MyWebSocketLike = 3;\nconst net = 4;\nimport { readFileSync } from 'node:fs';\n";
  assert.deepEqual(violationsOf(text, 'network'), []);
});

for (const name of DYNAMIC_CODE_NAMES) {
  test(`the dynamic-code guard refuses the name ${name}`, () => {
    const found = violationsOf(`const first = 1;\nconst second = 2;\nvoid ${name};\n`, 'dynamic-code');
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0].line, 3);
    assert.equal(found[0].message, `dynamic code name "${name}"`);
  });
}

for (const name of DYNAMIC_CODE_MODULES) {
  test(`the dynamic-code guard refuses the ${name} module`, () => {
    const found = violationsOf(`const first = 1;\nconst second = 2;\nimport * as m from 'node:${name}';\n`, 'dynamic-code');
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0].line, 3);
    assert.equal(found[0].message, `dynamic code module "${name}"`);
  });
}

test('the dynamic-code guard refuses new Function and a call to eval', () => {
  assert.equal(violationsOf("const f = new Function('return 1');\n", 'dynamic-code').length, 1);
  assert.equal(violationsOf("const v = eval('1');\n", 'dynamic-code').length, 1);
});

test('the dynamic-code guard passes a hyphenated word that ends in a dynamic-code name', () => {
  const text = "const types = ['g-eval', 'eval-score', 'x-function', 'function-call'];\n";
  assert.deepEqual(violationsOf(text, 'dynamic-code'), []);
});

test('the dynamic-code guard still refuses a dynamic-code name beside a hyphenated word', () => {
  const found = violationsOf("const types = ['g-eval'];\nconst v = eval('1');\n", 'dynamic-code');
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].line, 2);
});

test('the dynamic-code guard passes names that only contain eval or function', () => {
  const text = "const evaluate = 1;\nconst label = 'evals-baseline';\nconst medieval = 2;\nconst kind = typeof evaluate === 'function';\nconst functionName = 3;\n";
  assert.deepEqual(violationsOf(text, 'dynamic-code'), []);
});

test('reports every occurrence, each on its own line', () => {
  const text = "void fetch;\nconst ok = 1;\nvoid fetch;\n";
  assert.deepEqual(
    violationsOf(text, 'network').map((violation) => violation.line),
    [1, 3],
  );
});

test('a clean text has no violation from any guard', () => {
  assert.deepEqual(scanText("import { createHash } from 'node:crypto';\nconst a = createHash;\n"), []);
});

test('the lists keep the names that make a script a network client or a dynamic-code runner', () => {
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
    assert.ok(NETWORK_NAMES.includes(name), `${name} left NETWORK_NAMES`);
  }
  for (const name of ['http', 'https', 'http2', 'net', 'tls', 'dgram', 'dns']) {
    assert.ok(NETWORK_MODULES.includes(name), `${name} left NETWORK_MODULES`);
  }
  assert.deepEqual(DYNAMIC_CODE_NAMES, ['eval', 'Function']);
});
