import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CONCATENATED_MODULES, SOURCE_SET } from '../build/lib/layout.mjs';
import { repositoryRoot } from './support/fixtures.mjs';
import { findingFields } from './support/model.mjs';
import { concatenatedModules, importsOf, namesForbiddenInPureModules, readSource, topLevelNames } from './support/source.mjs';

const sources = new Map(concatenatedModules.map((name) => [name, readSource(name)]));

test('every top-level name is declared in exactly one module, because the generator joins the modules into one scope', () => {
  const owners = new Map();
  for (const [name, source] of sources) {
    for (const declared of topLevelNames(source)) {
      owners.set(declared, [...(owners.get(declared) ?? []), name]);
    }
  }
  const duplicated = [...owners].filter(([, modules]) => modules.length > 1).map(([declared, modules]) => `${declared}: ${modules.join(', ')}`);
  assert.deepEqual(duplicated, []);
  assert.equal(owners.size > 40, true);
});

test('every name imported from a node: module is imported by exactly one module', () => {
  const owners = new Map();
  for (const [name, source] of sources) {
    for (const { specifier, bindings } of importsOf(source)) {
      if (specifier.startsWith('node:')) {
        for (const binding of bindings) {
          owners.set(binding, [...(owners.get(binding) ?? []), name]);
        }
      }
    }
  }
  const duplicated = [...owners].filter(([, modules]) => modules.length > 1).map(([binding, modules]) => `${binding}: ${modules.join(', ')}`);
  assert.deepEqual(duplicated, []);
  assert.deepEqual([...owners.keys()].sort(), ['createHash', 'readFileSync', 'renameSync', 'rmSync', 'writeFileSync']);
});

test('every import specifier is a node: module or a sibling named ./name.mjs that comes earlier in the concatenation order', () => {
  concatenatedModules.forEach((name, position) => {
    for (const { specifier } of importsOf(sources.get(name))) {
      if (specifier.startsWith('node:')) {
        continue;
      }
      const sibling = /^\.\/([a-z-]+)\.mjs$/.exec(specifier);
      assert.notEqual(sibling, null, `${name} imports ${specifier}`);
      const earlier = concatenatedModules.indexOf(sibling[1]);
      assert.equal(earlier >= 0 && earlier < position, true, `${name} imports ${specifier}, which does not come earlier in the order`);
    }
  });
});

test('no module uses import.meta, export default, export { }, or export * from, which the generator cannot strip', () => {
  for (const [name, source] of sources) {
    assert.equal(/import\.meta/.test(source), false, `${name} names import.meta`);
    assert.equal(/^export\s+(default|\{|\*)/m.test(source), false, `${name} has an export form the generator refuses`);
  }
});

test('every export is written as export function, export async function, export const, export let or export class at the start of a line', () => {
  for (const [name, source] of sources) {
    const exportLines = source.split('\n').filter((line) => /\bexport\b/.test(line) && !/^\s*(\/\/|\*)/.test(line));
    for (const line of exportLines) {
      assert.match(line, /^export (async function|function|const|let|class) /, `${name}: ${line}`);
    }
  }
});

test('no module names a network, dynamic-code or evaluation facility', () => {
  const forbidden = [/\bfetch\b/, /\bhttps?\b/, /\bnet\b/, /\bdns\b/, /\btls\b/, /\bFunction\b/, /\beval\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bchild_process\b/];
  for (const [name, source] of sources) {
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${name} matches ${pattern}`);
    }
  }
});

test('the modules that compute a result name no clock, no random source, no process and no performance timer', () => {
  const pure = concatenatedModules.filter((name) => name !== 'command');
  for (const name of pure) {
    assert.deepEqual(namesForbiddenInPureModules(sources.get(name)), [], name);
  }
});

test('the source guard for the pure modules reports a clock read, a random read, a process read and a timer read when one is planted', () => {
  assert.deepEqual(namesForbiddenInPureModules('const a = new Date();'), ['\\bDate\\b']);
  assert.deepEqual(namesForbiddenInPureModules('const a = Date.now();'), ['\\bDate\\b']);
  assert.deepEqual(namesForbiddenInPureModules('const a = Math.random();'), ['\\bMath\\.random\\b']);
  assert.deepEqual(namesForbiddenInPureModules('const a = process.env.HOME;'), ['\\bprocess\\b']);
  assert.deepEqual(namesForbiddenInPureModules('const a = performance.now();'), ['\\bperformance\\b']);
  assert.deepEqual(namesForbiddenInPureModules('const a = Intl.DateTimeFormat();'), ['\\bIntl\\b']);
  assert.deepEqual(namesForbiddenInPureModules('const a = 1;'), []);
});

test('the command module reads the clock through its io, and its default io is the only place that builds a Date', () => {
  const lines = sources.get('command').split('\n');
  const clockLines = lines.filter((line) => /\bDate\b/.test(line));
  assert.deepEqual(clockLines, ['  now: () => new Date(),']);
});

test('src/cli.mjs imports the command module and nothing else', () => {
  const entry = readSource('cli');
  assert.deepEqual(importsOf(entry).map((entryImport) => entryImport.specifier), ['./command.mjs']);
  assert.match(entry, /^#!\/usr\/bin\/env node\n/);
});

test('src holds exactly the files of the source set, so the manifest covers every file the package ships', () => {
  const present = readdirSync(join(repositoryRoot, 'src')).sort();
  assert.deepEqual(present, SOURCE_SET.map((name) => `${name}.mjs`).sort());
});

test('the order of modules this file reads is the order the generator joins them in', () => {
  assert.deepEqual(concatenatedModules, CONCATENATED_MODULES);
});

test('the module that decides what a comparison found composes no string and imports nothing that quotes, and the module that words one imports nothing that decides', () => {
  const specifiersOf = (name) => importsOf(sources.get(name)).map(({ specifier }) => specifier).sort();
  assert.deepEqual(specifiersOf('compare'), ['./quantise.mjs', './unreadable.mjs']);
  assert.deepEqual(specifiersOf('describe'), ['./printable.mjs', './quantise.mjs', './unreadable.mjs']);
  assert.equal(sources.get('compare').includes('`'), false);
});

const findingIds = [...new Set(Object.keys(findingFields).map((variant) => variant.split('/')[0]))];

const fixedWording = [
  'and this run has no such metric',
  'is below the baseline',
  'more than the tolerance',
  'and this run holds',
  'the baseline was recorded from',
  'this run was written by',
  'nothing was compared',
  're-record if the change is intended',
  'only in this run, not compared',
  'are never a finding',
  'cannot be read:',
  'cannot read ',
];

test('a finding or a note is worded in describe and nowhere else: no other module names a finding id except as the quoted id, and none repeats a piece of the wording', () => {
  assert.equal(findingIds.length, 9);
  for (const wording of fixedWording) {
    assert.equal(sources.get('describe').includes(wording), true, `describe no longer words ${JSON.stringify(wording)}`);
  }
  for (const [name, source] of sources) {
    if (name === 'describe') {
      continue;
    }
    for (const id of findingIds) {
      assert.equal(source.replaceAll(`'${id}'`, '').includes(id), false, `${name} names ${id} other than as the quoted id of a record`);
    }
    for (const wording of fixedWording) {
      assert.equal(source.includes(wording), false, `${name} words ${JSON.stringify(wording)}`);
    }
  }
});

test('the guard above tells a legitimate use from a leak: the advisory id is a quoted literal in render, and the record advice in command says cannot be read with a comma', () => {
  assert.equal(sources.get('render').includes("'cases-changed'"), true);
  assert.equal(sources.get('command').includes('cannot be read,'), true);
  assert.equal(fixedWording.includes('cannot be read'), false);
});
