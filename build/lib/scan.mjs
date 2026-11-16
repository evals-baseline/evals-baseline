export const NETWORK_NAMES = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'sendBeacon'];
export const NETWORK_MODULES = ['http', 'https', 'http2', 'net', 'tls', 'dgram', 'dns', 'dns/promises', 'quic'];
export const DYNAMIC_CODE_NAMES = ['eval', 'Function'];
export const DYNAMIC_CODE_MODULES = ['vm'];

const LITERAL_SPECIFIERS = [
  /^import\s*(['"])([^'"\n]+)\1/gm,
  /^(?:import|export)\b[^'";]*?\bfrom\s*(['"])([^'"\n]+)\1/gm,
  /\bimport\s*\(\s*(['"])([^'"\n]+)\1/g,
  /\brequire\s*\(\s*(['"])([^'"\n]+)\1/g,
];

const COMPUTED_SPECIFIERS = [
  { form: 'dynamic import', pattern: /\bimport\s*\(\s*(?![\s'"])/g },
  { form: 'require', pattern: /\brequire\s*\(\s*(?![\s'"])/g },
];

const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const withoutNodePrefix = (specifier) => specifier.replace(/^node:/, '');

function specifiersIn(text) {
  return LITERAL_SPECIFIERS.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => ({ specifier: match[2], line: lineAt(text, match.index) })),
  );
}

function namesIn(text, names) {
  return names.flatMap((name) =>
    [...text.matchAll(new RegExp(`(?<![-\\w$])${name}(?![-\\w$])`, 'g'))].map((match) => ({ name, line: lineAt(text, match.index) })),
  );
}

function importViolations(text) {
  const prefixed = specifiersIn(text)
    .filter(({ specifier }) => !specifier.startsWith('node:'))
    .map(({ specifier, line }) => ({ line, message: `import of '${specifier}' is not node:-prefixed` }));
  const computed = COMPUTED_SPECIFIERS.flatMap(({ form, pattern }) =>
    [...text.matchAll(pattern)].map((match) => ({ line: lineAt(text, match.index), message: `${form} with a computed specifier` })),
  );
  return [...prefixed, ...computed];
}

const moduleViolations = (text, modules, label) =>
  specifiersIn(text)
    .filter(({ specifier }) => modules.includes(withoutNodePrefix(specifier)))
    .map(({ specifier, line }) => ({ line, message: `${label} module "${withoutNodePrefix(specifier)}"` }));

const nameViolations = (text, names, label) =>
  namesIn(text, names).map(({ name, line }) => ({ line, message: `${label} name "${name}"` }));

const GUARDS = [
  { guard: 'imports', violations: importViolations },
  {
    guard: 'network',
    violations: (text) => [
      ...nameViolations(text, NETWORK_NAMES, 'network API'),
      ...moduleViolations(text, NETWORK_MODULES, 'network'),
    ],
  },
  {
    guard: 'dynamic-code',
    violations: (text) => [
      ...nameViolations(text, DYNAMIC_CODE_NAMES, 'dynamic code'),
      ...moduleViolations(text, DYNAMIC_CODE_MODULES, 'dynamic code'),
    ],
  },
];

export const GUARD_COUNT = GUARDS.length;

export function scanText(text) {
  return GUARDS.flatMap(({ guard, violations }) =>
    violations(text)
      .sort((a, b) => a.line - b.line)
      .map((violation) => ({ guard, ...violation })),
  );
}
