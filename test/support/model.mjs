export const findingFields = {
  'missing-metric': ['baseline.samples', 'baseline.value', 'key'],
  'unreadable-metric': ['key', 'reason'],
  'below-baseline': ['baseline.samples', 'baseline.tolerance', 'baseline.value', 'drop', 'key', 'run.samples', 'run.value'],
  'sample-count': ['baseline.samples', 'key', 'run.samples'],
  'cases-changed': ['baseline.count', 'baseline.digest', 'run.count', 'run.digest'],
  'no-baseline': ['file'],
  'bad-baseline/cannot-read': ['cause', 'failure', 'file'],
  'bad-baseline/refused': ['cause', 'file', 'problem'],
  'bad-run/cannot-read': ['cause', 'failure', 'file'],
  'bad-run/refused': ['cause', 'file', 'problem'],
  'bad-run/other-tool': ['baseline.shape', 'baseline.tool', 'cause', 'file', 'run.shape', 'run.tool'],
  'internal-error': ['message'],
};

export const noteFields = {
  'metrics-only-in-run': ['keys'],
  'more-samples': ['baseline.samples', 'key', 'run.samples'],
  'run-error': ['text'],
  'refused-metric': ['key', 'reason'],
  'tool-version-changed': ['baseline.toolVersion', 'run.toolVersion', 'tool'],
};

export const spanFields = {
  'missing-metric': ['key'],
  'unreadable-metric': ['key'],
  'below-baseline': ['key'],
  'sample-count': ['key'],
  'cases-changed': [],
  'no-baseline': ['file'],
  'bad-baseline/cannot-read': ['file'],
  'bad-baseline/refused': ['file'],
  'bad-run/cannot-read': ['file'],
  'bad-run/refused': ['file'],
  'bad-run/other-tool': ['file'],
  'internal-error': ['message'],
  'metrics-only-in-run': ['keys'],
  'more-samples': ['key'],
  'run-error': [],
  'refused-metric': ['key'],
  'tool-version-changed': ['baseline.toolVersion', 'run.toolVersion'],
};

export const givenFields = {
  'missing-metric': [],
  'unreadable-metric': ['reason'],
  'below-baseline': [],
  'sample-count': [],
  'cases-changed': ['baseline.digest', 'run.digest'],
  'no-baseline': [],
  'bad-baseline/cannot-read': ['failure'],
  'bad-baseline/refused': ['problem'],
  'bad-run/cannot-read': ['failure'],
  'bad-run/refused': ['problem'],
  'bad-run/other-tool': ['baseline.shape', 'baseline.tool', 'run.shape', 'run.tool'],
  'internal-error': [],
  'metrics-only-in-run': [],
  'more-samples': [],
  'run-error': ['text'],
  'refused-metric': ['reason'],
  'tool-version-changed': ['tool'],
};

const isBranch = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const isText = (value) => typeof value === 'string' || Array.isArray(value);

function leafPaths(value, prefix = '') {
  if (!isBranch(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([name, member]) => leafPaths(member, prefix === '' ? name : `${prefix}.${name}`));
}

const withoutIdentity = (record) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== 'id' && name !== 'kind'));

const valueAt = (record, path) => path.split('.').reduce((member, name) => member[name], record);

export const fieldsOf = (record) => leafPaths(withoutIdentity(record)).sort();

export const textFields = (record) => fieldsOf(record).filter((path) => path !== 'cause' && isText(valueAt(record, path)));

export function variantOf(record) {
  const tag = record.kind ?? record.id;
  return record.cause === undefined ? tag : `${tag}/${record.cause}`;
}

export function withValue(record, path, value) {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) {
    return { ...record, [head]: value };
  }
  return { ...record, [head]: withValue(record[head], rest.join('.'), value) };
}

export const hostileFindings = (text) => [
  { id: 'missing-metric', key: text, baseline: { value: 1000000, samples: 4 } },
  { id: 'unreadable-metric', key: text, reason: text },
  { id: 'below-baseline', key: text, baseline: { value: 1000000, samples: 4, tolerance: 0 }, run: { value: 750000, samples: 4 }, drop: 250000 },
  { id: 'sample-count', key: text, baseline: { samples: 4 }, run: { samples: 3 } },
  { id: 'cases-changed', baseline: { count: 4, digest: text }, run: { count: 3, digest: text } },
  { id: 'no-baseline', file: text },
  { id: 'bad-baseline', file: text, cause: 'cannot-read', failure: text },
  { id: 'bad-baseline', file: text, cause: 'refused', problem: text },
  { id: 'bad-run', file: text, cause: 'cannot-read', failure: text },
  { id: 'bad-run', file: text, cause: 'refused', problem: text },
  { id: 'bad-run', file: text, cause: 'other-tool', baseline: { tool: text, shape: text }, run: { tool: text, shape: text } },
  { id: 'internal-error', message: text },
];

export const hostileNotes = (text) => [
  { kind: 'metrics-only-in-run', keys: [text, text] },
  { kind: 'more-samples', key: text, baseline: { samples: 4 }, run: { samples: 8 } },
  { kind: 'run-error', text },
  { kind: 'refused-metric', key: text, reason: text },
  { kind: 'tool-version-changed', tool: text, baseline: { toolVersion: text }, run: { toolVersion: text } },
];
