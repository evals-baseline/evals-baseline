import { createHash } from 'node:crypto';

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const members = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${members.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function caseDigest(identities) {
  const texts = identities.map(canonicalJson).sort();
  return createHash('sha256').update(texts.join('\u0001')).digest('hex').slice(0, 12);
}
