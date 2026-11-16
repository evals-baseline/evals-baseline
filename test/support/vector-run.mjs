import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { cli } from '../../src/command.mjs';
import { expectedFor, rowsOf } from './specimen-run.mjs';
import { specimens } from './specimen-table.mjs';
import { extraExpectations } from './vector-extras.mjs';
import { asWrites, coversOf, maskPackageVersion, pathsOf } from './vectors.mjs';

const specimenOfRow = new Map(specimens.flatMap((specimen) => rowsOf(specimen).map((row, index) => [row.id, { specimen, strict: index === 1 }])));
const reportFields = ['stdout', 'stderr', 'code', 'writes'];

export function handWritten(id) {
  const known = specimenOfRow.get(id);
  const expected = known === undefined ? extraExpectations.get(id) : expectedFor(known.specimen, known.strict);
  if (expected === undefined) {
    return null;
  }
  return {
    stdout: expected.stdout.map(maskPackageVersion),
    stderr: expected.stderr,
    code: expected.code,
    writes: asWrites(expected.writes),
  };
}

function filesIo(vector, files) {
  const overlay = new Map();
  const writes = [];
  return {
    writes,
    readFile(path) {
      if (overlay.has(path)) {
        return overlay.get(path);
      }
      const key = posix.join(vector.dir, path);
      if (!Object.hasOwn(files, key)) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, open '${key}'`), { code: 'ENOENT' });
      }
      return files[key];
    },
    writeFile(path, text) {
      overlay.set(path, text);
      writes.push([path, text]);
    },
    now: () => new Date(vector.now),
  };
}

function printedFromFiles(vector, files) {
  const io = filesIo(vector, files);
  const { stdout, stderr, code } = cli(vector.argv, io);
  return { stdout: stdout.map(maskPackageVersion), stderr, code, writes: asWrites(io.writes) };
}

export function vectorProblems(vector, files) {
  const problems = [];
  const differs = (label, inVector, reference) => {
    if (!isDeepStrictEqual(inVector, reference)) {
      problems.push(`${label}: the vector has ${JSON.stringify(inVector)}, expected ${JSON.stringify(reference)}`);
    }
  };
  const printed = printedFromFiles(vector, files);
  const byHand = handWritten(vector.id);
  for (const field of reportFields) {
    differs(`${field} against the implementation`, vector[field], printed[field]);
    if (byHand !== null) {
      differs(`${field} against the hand-written report`, vector[field], byHand[field]);
    }
  }
  if (byHand === null) {
    problems.push('no hand-written report for this id');
  }
  differs('covers', vector.covers, coversOf(vector.argv, vector.stdout));
  const paths = pathsOf(vector.dir, vector.argv, vector.code);
  differs('baseline', vector.baseline, paths.baseline);
  differs('run', vector.run, paths.run);
  return problems;
}
