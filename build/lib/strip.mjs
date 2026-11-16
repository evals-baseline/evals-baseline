import { posix } from 'node:path';

export class BuildRefusal extends Error {}

const SUPPORTED_EXPORT = '(?:async\\s+function|function|const|let|class)\\b';
const IMPORT_STATEMENT = /^import\b([^'"]*?)(['"])([^'"\n]+)\2[ \t]*;?[ \t]*(?:\r?\n|$)/gm;
const EXPORT_DECLARATION = new RegExp(`^export (?=${SUPPORTED_EXPORT})`, 'gm');
const UNSUPPORTED_EXPORT = new RegExp(`^export\\b(?! ${SUPPORTED_EXPORT}).*`, 'gm');
const NAMED_IMPORT_CLAUSE = /^\s*\{[^}]*\}\s*from\s*$/;
const IMPORT_META = /\bimport\.meta\b/g;
const DYNAMIC_IMPORT = /\bimport\s*\(/g;

const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;
const isRelative = (specifier) => specifier.startsWith('./') || specifier.startsWith('../');

function refuse(path, text, offset, reason) {
  return new BuildRefusal(`${path}:${lineOf(text, offset)}: ${reason}`);
}

function refuseUnsupportedSyntax(path, text) {
  for (const match of text.matchAll(UNSUPPORTED_EXPORT)) {
    throw refuse(path, text, match.index, `unsupported export: ${match[0].trim()}`);
  }
  for (const match of text.matchAll(IMPORT_META)) {
    throw refuse(path, text, match.index, 'import.meta changes meaning inside a concatenated file');
  }
  for (const match of text.matchAll(DYNAMIC_IMPORT)) {
    throw refuse(path, text, match.index, 'a dynamic import has no module to resolve inside a concatenated file');
  }
}

function checkRelativeImport({ path, text, offset, clause, specifier, earlier }) {
  const where = (reason) => refuse(path, text, offset, reason);
  if (!NAMED_IMPORT_CLAUSE.test(clause)) {
    throw where(`${specifier} must be a named import, as import { name } from '${specifier}'`);
  }
  if (/\bas\b/.test(clause)) {
    throw where(`an alias on an import from ${specifier} does not survive concatenation`);
  }
  const target = posix.normalize(posix.join(posix.dirname(path), specifier));
  if (!earlier.has(target)) {
    throw where(`imports ${target}, which does not come earlier in the file this part is concatenated into`);
  }
}

export function stripPart({ path, text, earlier }) {
  refuseUnsupportedSyntax(path, text);
  const withoutImports = text.replace(IMPORT_STATEMENT, (statement, clause, quote, specifier, offset) => {
    if (specifier.startsWith('node:')) return statement;
    if (!isRelative(specifier)) {
      throw refuse(path, text, offset, `imports '${specifier}'; only node: built-ins and relative modules are allowed`);
    }
    checkRelativeImport({ path, text, offset, clause, specifier, earlier });
    return '';
  });
  return withoutImports.replace(EXPORT_DECLARATION, '');
}
