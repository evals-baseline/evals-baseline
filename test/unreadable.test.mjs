import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Unreadable, byKey, compareText, isPlainObject, parseJson, refusalSentence, refuse } from '../src/unreadable.mjs';

const refusalMessage = (text, name = 'dup.json') => {
  try {
    parseJson(text, name);
  } catch (error) {
    assert.equal(error instanceof Unreadable, true, `expected Unreadable, got ${error}`);
    return error.message;
  }
  return assert.fail('expected parseJson to refuse');
};
const repeatedKeyMessage = (spelledKey) => `"dup.json": the key "${spelledKey}" appears twice in one object`;

test('Unreadable is an Error that names itself and carries the message', () => {
  const refusal = new Unreadable('run.json: not JSON');
  assert.equal(refusal instanceof Error, true);
  assert.equal(refusal.name, 'Unreadable');
  assert.equal(refusal.message, 'run.json: not JSON');
});

test('a refusal carries the problem apart from the message, so the file the message names is not read back out of it', () => {
  const refusal = refuse('p"\\.json', 'cases.count must be a positive integer');
  assert.equal(refusal instanceof Unreadable, true);
  assert.equal(refusal.message, '"p\\u0022\\\\.json": cases.count must be a positive integer');
  assert.equal(refusal.problem, 'cases.count must be a positive integer');
});

test('the sentence of a refusal is the file between double quotes, a colon and the problem, and it is what the refusal carries as its message', () => {
  assert.equal(refusalSentence('p"\\.json', 'bad'), '"p\\u0022\\\\.json": bad');
  assert.equal(refuse('p"\\.json', 'bad').message, refusalSentence('p"\\.json', 'bad'));
});

test('every refusal parseJson raises carries the problem that follows the file in its message', () => {
  for (const text of ['not json', '{"a":1,"a":2}']) {
    assert.throws(
      () => parseJson(text, 'some.json'),
      (error) => error instanceof Unreadable && typeof error.problem === 'string' && error.message === `"some.json": ${error.problem}`,
    );
  }
});

test('parseJson returns the parsed value', () => {
  assert.deepEqual(parseJson('{"a":[1,2]}', 'run.json'), { a: [1, 2] });
});

test('parseJson turns a syntax error into an Unreadable that names the file and not the parser message', () => {
  for (const text of ['', 'not json', '{"a":', 'SQLite format 3\u0000']) {
    assert.throws(
      () => parseJson(text, 'some.json'),
      (error) => error instanceof Unreadable && error.message === '"some.json": not JSON',
    );
  }
});

test('parseJson lets an error that is not a syntax error through', () => {
  assert.throws(() => parseJson(Symbol('x'), 'run.json'), (error) => !(error instanceof Unreadable));
});

test('parseJson refuses a key that appears twice in one object, and names the file and the key', () => {
  assert.equal(refusalMessage('{"accuracy":1,"accuracy":2}', 'runs/one.json'), '"runs/one.json": the key "accuracy" appears twice in one object');
  assert.equal(refusalMessage('{"a":1,"b":2,"a":3}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a":1,"a":1}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage(' { "a" : 1 , "a" : 2 } '), repeatedKeyMessage('a'));
});

test('parseJson refuses a repeated key at any depth: in a nested object, below an array and inside an array element', () => {
  assert.equal(refusalMessage('{"outer":{"a":1,"a":2}}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('[{"a":1,"a":2}]'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('[{"a":1},{"b":1,"b":2}]'), repeatedKeyMessage('b'));
  assert.equal(refusalMessage('{"list":[1,[{"x":{"a":1},"y":{"b":1,"b":2}}]]}'), repeatedKeyMessage('b'));
  assert.equal(refusalMessage('{"a":{"b":{"c":{"d":1,"d":2}}}}'), repeatedKeyMessage('d'));
});

test('parseJson refuses a key that comes back after a nested object or array between the two has closed', () => {
  assert.equal(refusalMessage('{"a":{"x":1},"a":2}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a":{},"a":2}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a":[1,2],"a":3}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a":[{"x":1}],"a":2}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a":[[]],"b":{"c":[{}]},"a":2}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"list":[{"x":1},{"x":2}],"list":3}'), repeatedKeyMessage('list'));
});

test('parseJson compares keys after decoding the escapes in them', () => {
  assert.equal(refusalMessage('{"a":1,"\\u0061":2}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"\\u0061":1,"a":2}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"ab":1,"a\\u0062":2}'), repeatedKeyMessage('ab'));
  assert.equal(refusalMessage('{"é":1,"\\u00e9":2}'), repeatedKeyMessage('é'));
  assert.equal(refusalMessage('{"\u{1d11e}":1,"\\ud834\\udd1e":2}'), repeatedKeyMessage('\u{1d11e}'));
  assert.equal(refusalMessage('{"/":1,"\\/":2}'), repeatedKeyMessage('/'));
  assert.equal(refusalMessage('{"\\"":1,"\\u0022":2}'), repeatedKeyMessage('\\u0022'));
  assert.equal(refusalMessage('{"\\\\":1,"\\u005c":2}'), repeatedKeyMessage('\\\\'));
  assert.equal(refusalMessage('{"a\\nb":1,"a\\u000ab":2}'), repeatedKeyMessage('a\\u000ab'));
});

test('parseJson refuses __proto__ twice, and reads __proto__ once as an ordinary key', () => {
  assert.equal(refusalMessage('{"__proto__":1,"__proto__":2}'), repeatedKeyMessage('__proto__'));
  assert.equal(refusalMessage('{"a":{"__proto__":{},"__proto__":{}}}'), repeatedKeyMessage('__proto__'));
  const parsed = parseJson('{"__proto__":1,"b":2}', 'ok.json');
  assert.equal(Object.hasOwn(parsed, '__proto__'), true);
  assert.equal(parsed.b, 2);
});

test('parseJson reads sibling objects, array elements and nested levels that reuse the same keys', () => {
  const texts = [
    '{"left":{"a":1,"b":2},"right":{"a":3,"b":4}}',
    '[{"a":1},{"a":2},{"a":3}]',
    '{"a":{"a":{"a":1}}}',
    '{"a":[{"a":1}],"b":[{"a":2}]}',
    '{"a":[{"a":1,"b":2},{"a":3,"b":4}],"b":{"a":5}}',
    '[[{"a":1}],[{"a":2}]]',
  ];
  for (const text of texts) {
    assert.deepEqual(parseJson(text, 'ok.json'), JSON.parse(text), text);
  }
});

test('parseJson counts a string value that equals a key as a value, and not as a key', () => {
  for (const text of ['{"a":"a","b":"b"}', '{"a":"b","b":"a"}', '["a","a",{"a":"a"}]', '{"a":["a","a"],"b":"a"}']) {
    assert.deepEqual(parseJson(text, 'ok.json'), JSON.parse(text), text);
  }
});

test('parseJson reads a string that holds a repeated key as text', () => {
  const holdingRepeat = '{"a":1,"a":2}';
  const texts = [
    JSON.stringify(holdingRepeat),
    JSON.stringify([holdingRepeat, holdingRepeat]),
    JSON.stringify({ text: holdingRepeat }),
    JSON.stringify({ first: holdingRepeat, second: holdingRepeat }),
    JSON.stringify({ nested: { text: holdingRepeat } }),
    '{"text":"{\\"a\\":1,\\"a\\":2}"}',
  ];
  for (const text of texts) {
    assert.deepEqual(parseJson(text, 'ok.json'), JSON.parse(text), text);
  }
  assert.equal(parseJson(texts[0], 'ok.json'), holdingRepeat);
});

test('parseJson reads a top-level string that holds structure characters, and top-level numbers and literals', () => {
  for (const text of ['"a:b"', '"{"', '"}"', '"[]"', '"a,b"', '"\\"a\\":1"', ' "x" ', '12', '-1.5e3', 'true', 'false', 'null']) {
    assert.deepEqual(parseJson(text, 'ok.json'), JSON.parse(text), text);
  }
});

test('parseJson reads distinct keys that hold colons, commas, braces, brackets, quotes and backslashes', () => {
  const keys = ['a:b', 'a,b', 'a{b', 'a}b', 'a[b', 'a]b', 'a"b', '"', '\\', 'a\\', '{"a":1,"a":2}', '"a":', ',"a":', '', ' ', 'a\nb', '\u2028'];
  const text = JSON.stringify(Object.fromEntries(keys.map((key, index) => [key, index])));
  assert.equal(Object.keys(JSON.parse(text)).length, keys.length);
  assert.deepEqual(parseJson(text, 'ok.json'), JSON.parse(text));
});

test('parseJson refuses a repeated key that holds colons, commas, braces, brackets, quotes and backslashes', () => {
  const keys = [
    ['a:b', 'a:b'],
    ['a,b', 'a,b'],
    ['{', '{'],
    ['}', '}'],
    ['[', '['],
    [']', ']'],
    ['"', '\\u0022'],
    ['\\', '\\\\'],
    ['\\"', '\\\\\\u0022'],
    ['{"a":1,"a":2}', '{\\u0022a\\u0022:1,\\u0022a\\u0022:2}'],
    ['"a":1,', '\\u0022a\\u0022:1,'],
  ];
  for (const [key, spelledKey] of keys) {
    const spelled = JSON.stringify(key);
    assert.equal(refusalMessage(`{${spelled}:1,${spelled}:2}`), repeatedKeyMessage(spelledKey), key);
  }
});

test('parseJson keeps its place in the structure when a key or a string value holds a brace or a bracket', () => {
  assert.equal(refusalMessage('{"}":1,"a":2,"a":3}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"{":{"x":1},"a":2,"a":3}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"]":[1],"a":2,"a":3}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('[{"[":1},{"a":2,"a":3}]'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a":"}","a":1}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a":"{","b":{"c":"]"},"a":1}'), repeatedKeyMessage('a'));
});

test('parseJson ends a string at its closing quote when the string ends in an escaped backslash or holds an escaped quote', () => {
  assert.equal(refusalMessage('{"a":"\\\\","a":1}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a":"x\\"","a":1}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"a\\\\":1,"a\\\\":2}'), repeatedKeyMessage('a\\\\'));
  assert.deepEqual(parseJson('{"a\\\\":1,"a":2}', 'ok.json'), { 'a\\': 1, a: 2 });
  assert.deepEqual(parseJson('{"\\\\":"\\\\","b":"\\\\\\""}', 'ok.json'), { '\\': '\\', b: '\\"' });
});

test('parseJson scans a string of three million characters and a string of a million escapes', () => {
  const plain = 'a'.repeat(3_000_000);
  const escapes = '"\\\n'.repeat(333_333);
  const text = JSON.stringify({ [plain]: plain, [escapes]: escapes, tail: [plain, escapes] });
  assert.deepEqual(parseJson(text, 'ok.json'), JSON.parse(text));
  const repeating = `${text.slice(0, -1)},${JSON.stringify(escapes)}:1}`;
  const message = refusalMessage(repeating);
  assert.equal(message.startsWith('"dup.json": the key "'), true);
  assert.equal(message.endsWith('" appears twice in one object'), true);
});

test('parseJson reads eleven thousand levels of nested arrays without recursing', () => {
  const depth = 11000;
  let level = parseJson(`${'['.repeat(depth)}1${']'.repeat(depth)}`, 'deep.json');
  let levels = 0;
  while (Array.isArray(level)) {
    level = level[0];
    levels += 1;
  }
  assert.equal(levels, depth);
  assert.equal(level, 1);
});

test('parseJson finds a repeated key at the bottom of twenty thousand nested objects and arrays', () => {
  const depth = 20000;
  assert.equal(refusalMessage(`${'{"a":'.repeat(depth)}{"b":1,"b":2}${'}'.repeat(depth)}`), repeatedKeyMessage('b'));
  assert.equal(refusalMessage(`${'['.repeat(depth)}{"b":1,"b":2}${']'.repeat(depth)}`), repeatedKeyMessage('b'));
  assert.equal(refusalMessage(`${'[{"a":'.repeat(depth)}{"b":1,"b":2}${'}]'.repeat(depth)}`), repeatedKeyMessage('b'));
});

test('parseJson names the key whose second appearance comes first when several keys repeat', () => {
  assert.equal(refusalMessage('{"a":1,"a":2,"b":3,"b":4}'), repeatedKeyMessage('a'));
  assert.equal(refusalMessage('{"b":1,"b":2,"a":3,"a":4}'), repeatedKeyMessage('b'));
  assert.equal(refusalMessage('{"a":1,"b":2,"b":3,"a":4}'), repeatedKeyMessage('b'));
  assert.equal(refusalMessage('{"x":{"y":1,"y":2},"a":1,"a":2}'), repeatedKeyMessage('y'));
  assert.equal(refusalMessage('{"a":1,"a":2,"x":{"y":1,"y":2}}'), repeatedKeyMessage('a'));
});

test('parseJson judges syntax first: a text that is not JSON is refused as not JSON even when it repeats a key', () => {
  for (const text of ['{"a":1,"a":2', '{"a":1,"a":2,}', '{"a":1,"a":2}}', '{"a":1,"a":2} x', "{'a':1,'a':2}", '{"a":1 "a":2}']) {
    assert.equal(refusalMessage(text), '"dup.json": not JSON', text);
  }
});

test('parseJson reads empty objects and empty arrays, alone and nested', () => {
  for (const text of ['{}', '[]', ' \n{ }\t', '{"a":{},"b":{},"c":[],"d":[]}', '[{},{},[],[[]]]', '{"a":{"a":{}},"b":{"a":{}}}']) {
    assert.deepEqual(parseJson(text, 'ok.json'), JSON.parse(text), text);
  }
});

test('isPlainObject is true for objects only', () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject({ a: 1 }), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject('x'), false);
  assert.equal(isPlainObject(1), false);
  assert.equal(isPlainObject(undefined), false);
});

test('compareText orders by UTF-16 code unit and does not depend on any locale', () => {
  assert.equal(compareText('a', 'b'), -1);
  assert.equal(compareText('b', 'a'), 1);
  assert.equal(compareText('a', 'a'), 0);
  assert.equal(compareText('10', '9'), -1);
  assert.equal(compareText('Z', 'a'), -1);
  assert.equal(compareText('_', 'a'), -1);
  assert.deepEqual(['b', 'B', 'a', 'A', 'é'].sort(compareText), ['A', 'B', 'a', 'b', 'é']);
});

test('byKey orders entries by their key with compareText, and leaves entries with equal keys in place', () => {
  const entries = [{ key: 'b', n: 1 }, { key: 'B', n: 2 }, { key: 'a', n: 3 }, { key: 'b', n: 4 }, { key: '10', n: 5 }, { key: '9', n: 6 }];
  assert.deepEqual(
    entries.sort(byKey).map((entry) => entry.n),
    [5, 6, 2, 3, 1, 4],
  );
  assert.equal(byKey({ key: 'a' }, { key: 'b' }), -1);
  assert.equal(byKey({ key: 'a' }, { key: 'a' }), 0);
});
