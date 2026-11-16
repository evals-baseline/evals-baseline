import { datum } from './printable.mjs';
import { isQuantisable, largestQuantisable } from './quantise.mjs';
import { byKey, isPlainObject, parseJson, refuse } from './unreadable.mjs';

export const specificationVersion = '1.0';

const [implementedMajor, implementedMinor] = specificationVersion.split('.').map(Number);

const specificationPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const recordedAtPattern = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;
const digestPattern = /^[0-9a-f]{12}$/;
const shapeByTool = { promptfoo: 'promptfoo-results-3', deepeval: 'deepeval-test-run' };

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function lastDayOfMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isRealInstant(text) {
  const match = recordedAtPattern.exec(text);
  return match !== null && Number(match[3]) <= lastDayOfMonth(Number(match[1]), Number(match[2]));
}

function checkKeys(object, allowed, where, name) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      throw refuse(name, `unknown key ${datum(key)} in ${where}`);
    }
  }
  for (const key of allowed) {
    if (!Object.hasOwn(object, key)) {
      throw refuse(name, `missing key ${datum(key)} in ${where}`);
    }
  }
}

function checkSpecification(document, name) {
  if (!Object.hasOwn(document, 'spec')) {
    throw refuse(name, 'missing key "spec" in the baseline');
  }
  const { spec } = document;
  const match = typeof spec === 'string' ? specificationPattern.exec(spec) : null;
  if (match === null) {
    throw refuse(name, `spec must be MAJOR.MINOR with no third number and no leading zeros, such as "${specificationVersion}", got ${datum(spec)}`);
  }
  if (Number(match[1]) !== implementedMajor) {
    throw refuse(name, `specification ${spec} is not read by this implementation, which reads ${implementedMajor}.x up to ${specificationVersion}`);
  }
  if (Number(match[2]) > implementedMinor) {
    throw refuse(name, `specification ${spec} is newer than ${specificationVersion}, the newest this implementation reads`);
  }
}

function readSource(source, name) {
  checkKeys(source, ['tool', 'toolVersion', 'shape'], 'source', name);
  if (!Object.hasOwn(shapeByTool, source.tool)) {
    throw refuse(name, 'source.tool must be "promptfoo" or "deepeval"');
  }
  if (source.toolVersion !== null && typeof source.toolVersion !== 'string') {
    throw refuse(name, 'source.toolVersion must be a string or null');
  }
  if (source.shape !== shapeByTool[source.tool]) {
    throw refuse(name, `source.shape must be "${shapeByTool[source.tool]}" when source.tool is "${source.tool}"`);
  }
  return { tool: source.tool, toolVersion: source.toolVersion, shape: source.shape };
}

function readCases(cases, name) {
  checkKeys(cases, ['count', 'digest'], 'cases', name);
  if (!Number.isInteger(cases.count) || cases.count < 1) {
    throw refuse(name, 'cases.count must be a positive integer');
  }
  if (typeof cases.digest !== 'string' || !digestPattern.test(cases.digest)) {
    throw refuse(name, 'cases.digest must be 12 lowercase hexadecimal characters');
  }
  return { count: cases.count, digest: cases.digest };
}

function readMetric(key, entry, name) {
  const where = `metrics[${datum(key)}]`;
  if (!isPlainObject(entry)) {
    throw refuse(name, `${where} must be an object`);
  }
  checkKeys(entry, ['value', 'samples', 'tolerance'], where, name);
  if (!isQuantisable(entry.value)) {
    throw refuse(name, `${where}.value must be a number between -${largestQuantisable} and ${largestQuantisable}`);
  }
  if (!Number.isInteger(entry.samples) || entry.samples < 1) {
    throw refuse(name, `${where}.samples must be a positive integer`);
  }
  if (!isQuantisable(entry.tolerance) || entry.tolerance < 0) {
    throw refuse(name, `${where}.tolerance must be a number between 0 and ${largestQuantisable}`);
  }
  return { key, value: entry.value, samples: entry.samples, tolerance: entry.tolerance };
}

export function readBaseline(text, nameForMessages) {
  const name = nameForMessages;
  const document = parseJson(text, name);
  if (!isPlainObject(document)) {
    throw refuse(name, 'not a JSON object');
  }
  checkSpecification(document, name);
  checkKeys(document, ['spec', 'source', 'recordedAt', 'cases', 'metrics'], 'the baseline', name);
  if (!isPlainObject(document.source)) {
    throw refuse(name, 'source must be an object');
  }
  const source = readSource(document.source, name);
  if (typeof document.recordedAt !== 'string' || !isRealInstant(document.recordedAt)) {
    throw refuse(name, 'recordedAt must be an ISO 8601 UTC time to the millisecond, such as 2026-09-02T09:00:00.000Z');
  }
  if (!isPlainObject(document.cases)) {
    throw refuse(name, 'cases must be an object');
  }
  const cases = readCases(document.cases, name);
  if (!isPlainObject(document.metrics)) {
    throw refuse(name, 'metrics must be an object');
  }
  const entries = Object.entries(document.metrics);
  if (entries.length === 0) {
    throw refuse(name, 'metrics names no metric, so the baseline guards nothing');
  }
  const metrics = entries.map(([key, entry]) => readMetric(key, entry, name)).sort(byKey);
  return { spec: document.spec, source, recordedAt: document.recordedAt, cases, metrics };
}
