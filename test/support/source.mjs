import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot } from './fixtures.mjs';

export const concatenatedModules = ['printable', 'unreadable', 'digest', 'quantise', 'direction', 'read-run', 'read-baseline', 'compare', 'describe', 'record', 'render', 'command'];

export const readSource = (name) => readFileSync(join(repositoryRoot, 'src', `${name}.mjs`), 'utf8');

const importPattern = /^import\s+([\s\S]*?)\s+from\s+'([^']+)';/gm;
const declarationPattern = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
const destructuringPattern = /^(?:export\s+)?(?:const|let)\s+\[([^\]]+)\]/gm;

export function importsOf(source) {
  return [...source.matchAll(importPattern)].map((match) => {
    const clause = match[1].trim();
    const named = /^\{([\s\S]*)\}$/.exec(clause);
    const bindings = named === null ? [clause] : named[1].split(',').map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean);
    return { specifier: match[2], bindings };
  });
}

export function topLevelNames(source) {
  const names = [...source.matchAll(declarationPattern)].map((match) => match[1]);
  for (const match of source.matchAll(destructuringPattern)) {
    names.push(...match[1].split(',').map((part) => part.trim()).filter(Boolean));
  }
  return names;
}

export const forbiddenInPureModules = [/\bDate\b/, /\bMath\.random\b/, /\bprocess\b/, /\bperformance\b/, /\bIntl\b/, /\bTemporal\b/];

export function namesForbiddenInPureModules(source) {
  return forbiddenInPureModules.filter((pattern) => pattern.test(source)).map((pattern) => pattern.source);
}
