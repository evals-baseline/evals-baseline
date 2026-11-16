import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DYNAMIC_CODE_NAMES, NETWORK_MODULES, NETWORK_NAMES } from '../../build/lib/scan.mjs';
import { proveWithSpecimen, runNode, scratchDirectory } from './support.mjs';

const CLEAN_SCRIPT = "import { createHash } from 'node:crypto';\nconst digest = createHash('sha256');\nprocess.stdout.write(String(digest));\n";
const SCRIPTS = ['action.mjs', 'evals-baseline.mjs'];
const PLANTED_LINE = 4;

function distribution(test) {
  const dist = scratchDirectory(test, 'guards');
  for (const name of SCRIPTS) writeFileSync(join(dist, name), CLEAN_SCRIPT);
  writeFileSync(join(dist, 'manifest.json'), '{}\n');
  return dist;
}

const guards = (dist) => () => runNode(['build/guards.mjs', '--dist', dist]);

const planting = (dist, name, text) => () => {
  const path = join(dist, name);
  const pristine = readFileSync(path, 'utf8');
  writeFileSync(path, `${pristine}${text}\n`);
  return () => writeFileSync(path, pristine);
};

const SPECIMENS = [
  ['imports', "import left from 'left-pad';", "import of 'left-pad' is not node:-prefixed"],
  ['network', 'await fetch("https://example.com");', 'network API name "fetch"'],
  ['dynamic-code', "const f = new Function('return 1');", 'dynamic code name "Function"'],
];

test('passes the two scripts and says how many guards and files it covered', (t) => {
  const result = guards(distribution(t))();
  assert.equal(result.code, 0, result.output);
  assert.equal(result.output.trim(), 'guards: 3 guards over 2 files, no violations');
});

for (const name of SCRIPTS) {
  for (const [guard, text, message] of SPECIMENS) {
    test(`the ${guard} guard goes red on ${message} planted in ${name}, and green without it`, (t) => {
      const dist = distribution(t);
      const proof = proveWithSpecimen({ run: guards(dist), plant: planting(dist, name, text), token: message });
      assert.ok(proof.ok, proof.reason);

      const restore = planting(dist, name, text)();
      const planted = guards(dist)();
      restore();
      const expected = `guard ${guard}: ${join(dist, name)}:${PLANTED_LINE}: ${message}`;
      assert.ok(planted.output.split('\n').includes(expected), planted.output);
    });
  }
}

test('every network name, network module and dynamic-code name makes the guards go red', (t) => {
  const dist = distribution(t);
  const cases = [
    ...[...NETWORK_NAMES, ...DYNAMIC_CODE_NAMES].map((name) => ({
      name: 'evals-baseline.mjs',
      text: `void ${name};`,
      token: `"${name}"`,
    })),
    ...NETWORK_MODULES.map((name) => ({
      name: 'action.mjs',
      text: `import * as m from 'node:${name}';`,
      token: `network module "${name}"`,
    })),
  ];
  for (const { name, text, token } of cases) {
    const proof = proveWithSpecimen({ run: guards(dist), plant: planting(dist, name, text), token });
    assert.ok(proof.ok, `${text}: ${proof.reason}`);
  }
});

test('goes red when a generated script is missing, and says which', (t) => {
  const dist = distribution(t);
  rmSync(join(dist, 'action.mjs'));
  const result = guards(dist)();
  assert.equal(result.code, 1);
  assert.ok(result.output.split('\n').includes(`guard missing: ${join(dist, 'action.mjs')}: no such generated file`), result.output);
});

test('goes red on a directory with no generated script, because a green over nothing proves nothing', (t) => {
  const dist = scratchDirectory(t, 'guards-empty');
  mkdirSync(join(dist, 'nested'));
  const result = guards(dist)();
  assert.equal(result.code, 1);
  assert.match(result.output, /guard missing: .*evals-baseline\.mjs: no such generated file/);
  assert.match(result.output, /guard missing: .*action\.mjs: no such generated file/);
});

test('counts the violations and the files they are in', (t) => {
  const dist = distribution(t);
  planting(dist, 'action.mjs', 'void fetch;\nvoid eval;')();
  const result = guards(dist)();
  assert.equal(result.code, 1);
  assert.match(result.output, /^guards: 2 violations in 1 file$/m);
});

test('exits 2 with a usage line on an unknown flag', () => {
  const result = runNode(['build/guards.mjs', '--fix']);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /^usage: node build\/guards\.mjs \[--dist <directory>\]/);
});

test('scans the two generated scripts only; a stray file in the directory is the rebuild check to refuse', (t) => {
  const dist = distribution(t);
  writeFileSync(join(dist, 'extra.mjs'), 'void fetch;\n');
  assert.equal(guards(dist)().code, 0);
});
