import { datum } from './printable.mjs';

export class Unreadable extends Error {
  constructor(message, problem) {
    super(message);
    this.name = 'Unreadable';
    this.problem = problem;
  }
}

export const refusalSentence = (name, problem) => `${datum(name)}: ${problem}`;

export const refuse = (name, problem) => new Unreadable(refusalSentence(name, problem), problem);

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findRepeatedKey(text) {
  const keysOfOpenContainers = [];
  let stringStart = -1;
  let lastString = '';
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (stringStart >= 0) {
      if (character === '\\') {
        index += 1;
      } else if (character === '"') {
        lastString = text.slice(stringStart, index + 1);
        stringStart = -1;
      }
    } else if (character === '"') {
      stringStart = index;
    } else if (character === '{') {
      keysOfOpenContainers.push(new Set());
    } else if (character === '[') {
      keysOfOpenContainers.push(null);
    } else if (character === '}' || character === ']') {
      keysOfOpenContainers.pop();
    } else if (character === ':') {
      const key = JSON.parse(lastString);
      const keysOfObject = keysOfOpenContainers.at(-1);
      if (keysOfObject.has(key)) {
        return key;
      }
      keysOfObject.add(key);
    }
  }
  return undefined;
}

export function parseJson(text, name) {
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw refuse(name, 'not JSON');
    }
    throw error;
  }
  const repeatedKey = findRepeatedKey(text);
  if (repeatedKey !== undefined) {
    throw refuse(name, `the key ${datum(repeatedKey)} appears twice in one object`);
  }
  return document;
}

export function compareText(left, right) {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

export const byKey = (left, right) => compareText(left.key, right.key);
