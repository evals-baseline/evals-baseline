import { posix } from 'node:path';

export const VECTOR_FILE = 'fixtures/vectors.json';

export class VectorRefusal extends Error {}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const BANNER = /^evals-baseline \d+\.\d+\.\d+\S* \(specification /;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string';
const isNonEmptyString = (value) => isString(value) && value !== '';
const isLines = (value) => Array.isArray(value) && value.every(isString);

const cleanPath = (path) => posix.normalize(path).replace(/\/+$/, '');

function staysInsideRepository(path) {
  if (!isNonEmptyString(path) || posix.isAbsolute(path)) return false;
  const segments = cleanPath(path).split('/');
  return !segments.includes('..') && !segments.includes('.');
}

export const maskPackageVersion = (line) => line.replace(BANNER, 'evals-baseline <package version> (specification ');

function checkedFiles(files) {
  if (!isObject(files)) {
    throw new VectorRefusal(`${VECTOR_FILE}: files must be an object of file texts keyed by repository path, so that every vector runs without a checkout`);
  }
  for (const [path, text] of Object.entries(files)) {
    if (!staysInsideRepository(path) || posix.normalize(path) !== path) {
      throw new VectorRefusal(`${VECTOR_FILE}: files: ${JSON.stringify(path)} is not a normalised path inside the repository`);
    }
    if (!isString(text)) throw new VectorRefusal(`${VECTOR_FILE}: files: ${JSON.stringify(path)} is not a text`);
  }
  return files;
}

const isWrite = (write) => isObject(write) && isNonEmptyString(write.path) && isString(write.content);
const isPathOrNull = (value) => value === null || isNonEmptyString(value);

function checkedVector(vector, position) {
  if (!isObject(vector)) throw new VectorRefusal(`${VECTOR_FILE}: vector ${position} is not an object`);
  const refuse = (member) => new VectorRefusal(`${VECTOR_FILE}: vector ${position} has no usable ${member}`);
  if (!isNonEmptyString(vector.id)) throw refuse('id');
  if (!staysInsideRepository(vector.dir)) throw refuse('dir');
  if (!isLines(vector.argv)) throw refuse('argv');
  if (!isString(vector.now) || !INSTANT.test(vector.now) || Number.isNaN(Date.parse(vector.now))) throw refuse('now');
  if (!isPathOrNull(vector.baseline)) throw refuse('baseline');
  if (!isPathOrNull(vector.run)) throw refuse('run');
  if (!isLines(vector.stdout)) throw refuse('stdout');
  if (!isLines(vector.stderr)) throw refuse('stderr');
  if (!Number.isInteger(vector.code) || vector.code < 0) throw refuse('code');
  if (!Array.isArray(vector.writes) || !vector.writes.every(isWrite)) throw refuse('writes');
  const dir = cleanPath(vector.dir);
  const writes = vector.writes.map(({ path, content }) => ({ path: posix.join(dir, path), content }));
  if (!writes.every(({ path }) => staysInsideRepository(path))) throw refuse('writes');
  const { id, argv, now, baseline, run, stdout, stderr, code } = vector;
  return { id, dir, argv, now, baseline, run, stdout, stderr, code, writes };
}

export function parseVectors(text) {
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new VectorRefusal(`${VECTOR_FILE}: not JSON`);
  }
  if (!isObject(document) || !Array.isArray(document.vectors)) throw new VectorRefusal(`${VECTOR_FILE}: must be an object with a vectors array`);
  if (document.vectors.length === 0) throw new VectorRefusal(`${VECTOR_FILE}: no vector, and a parity run over nothing proves nothing`);
  const files = checkedFiles(document.files);
  const vectors = document.vectors.map((vector, index) => checkedVector(vector, index + 1));
  const seen = new Set();
  for (const { id } of vectors) {
    if (seen.has(id)) throw new VectorRefusal(`${VECTOR_FILE}: the id ${id} appears twice`);
    seen.add(id);
  }
  return { vectors, files };
}

const FLAG_WITH_VALUE = '--baseline';
const FLAG_WITHOUT_VALUE = '--strict';

export function actionInputsFor(argv) {
  const [verb, ...rest] = argv;
  if (verb !== 'check') return null;
  const inputs = { runFile: '', baseline: undefined, strict: false };
  let runFiles = 0;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === FLAG_WITH_VALUE) {
      const value = rest[index + 1];
      if (value === undefined || value.startsWith('-') || inputs.baseline !== undefined) return null;
      inputs.baseline = value;
      index += 1;
    } else if (token === FLAG_WITHOUT_VALUE) {
      if (inputs.strict) return null;
      inputs.strict = true;
    } else if (token.startsWith('-')) {
      return null;
    } else {
      runFiles += 1;
      inputs.runFile = token;
    }
  }
  return runFiles <= 1 ? inputs : null;
}
