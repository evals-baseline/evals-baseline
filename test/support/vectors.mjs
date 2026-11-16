import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { cli } from '../../src/command.mjs';
import { jsonSafe } from '../../src/printable.mjs';
import { specificationVersion } from '../../src/read-baseline.mjs';
import { repositoryRoot } from './fixtures.mjs';
import { checkDay, overlayIo } from './specimen-run.mjs';
import { extraRows } from './vector-extras.mjs';

export const coverOrder = [
  'rule-1',
  'rule-2',
  'rule-3',
  'rule-4',
  'binding-check',
  'no-baseline',
  'bad-baseline',
  'bad-run',
  'unreadable-metric',
  'internal-error',
];

const coverOfFindingId = {
  'missing-metric': 'rule-1',
  'below-baseline': 'rule-2',
  'sample-count': 'rule-4',
  'cases-changed': 'binding-check',
  'no-baseline': 'no-baseline',
  'bad-baseline': 'bad-baseline',
  'bad-run': 'bad-run',
  'unreadable-metric': 'unreadable-metric',
  'internal-error': 'internal-error',
};

const findingLine = new RegExp(`^(${Object.keys(coverOfFindingId).join('|')})[ :]`);
const ruleThreeNote = /^note: \d+ metric\(s\) only in this run, not compared \(rule 3\): /;
const bannerPattern = /^evals-baseline \d+\.\d+\.\d+\S* \(specification /;
const verbsThatRead = ['check', 'record', 'show'];
const verbOrder = ['check', 'record', 'show', 'version', 'usage'];

const internalErrorWording =
  'The text of an internal-error finding is the message of the exception the runtime threw (the "Exit codes" section of the specification), and runtimes word that message differently, so another implementation cannot be expected to reproduce this report.';

const about = [
  'Conformance vectors for version 1.0 of the evals-baseline specification. A vector is a baseline file, a run file, the command line and the exact report an implementation must print for them (the "Conformance vectors" section of the specification).',
  'A vector whose id is in fixtures/specimens.json is that row, with the same dir and argv, in the same order. The vectors after those rows are not in that file: their ids begin with S7, for the S2 report checked a year later, or with X-, for --version and for arguments refused with exit code 2.',
  'Run each vector in a fresh directory, with that directory as the working directory, the arguments in argv and the clock set to now. The description of files below says what to put in it. argv and the paths in writes are relative to that directory. The record verb writes into it.',
  `Compare stdout, stderr and the exit code exactly, and compare each file in writes with the file the run left at that path. Before comparing, replace the package version in the banner line with <package version>. It is the implementation's own version number. The banner is the first line of a check, record or show report and the whole of the --version report.`,
  `The date: line is a function of the baseline's recordedAt and of now alone, and the date after "check on" is the UTC calendar date of now. Every vector pins now, so no vector depends on the day it is read. An implementation that cannot set its clock compares every line except the date: line, which is the second line of a check that read a baseline.`,
  'baseline is the baseline file the arguments name, which check compares against and record replaces, and run is the run file. Each is null where the arguments are refused with exit code 2 or the verb takes no such file. Otherwise each is a path from the repository root, dir joined to the path the command reads, and files holds that file under that path when it exists.',
  'files maps every path that baseline or run names, where a file exists at that path, to the exact text of that file, read as UTF-8. A path that is not a key names a file that does not exist, so leave nothing at that path. To run a vector, create a fresh directory, write each file the vector names (its baseline and its run, when they are keys) at the path you get by removing dir and the slash after it from the key, run argv there with the clock set to now, and compare as described above.',
  'covers names the rules, the binding check and the finding ids that the report of a check shows. rule-1 is missing-metric, rule-2 is below-baseline, rule-3 is the note for a metric only in the run, rule-4 is sample-count, binding-check is cases-changed, and the other five are finding ids.',
  'A vector with referenceOnly holds output that the specification does not fix, so another implementation cannot be expected to reproduce it, and its value says which part and why.',
  `counts is computed from the vectors. The reference implementation's test suite regenerates this file with node fixtures/suites/derive-vectors.mjs and fails when the committed file differs.`,
];

export const maskPackageVersion = (line) => line.replace(bannerPattern, 'evals-baseline <package version> (specification ');

export const asWrites = (pairs) => pairs.map(([path, content]) => ({ path, content }));

export function coversOf(argv, stdout) {
  if (argv[0] !== 'check') {
    return [];
  }
  const found = new Set();
  for (const line of stdout) {
    const finding = findingLine.exec(line);
    if (finding !== null) {
      found.add(coverOfFindingId[finding[1]]);
    } else if (ruleThreeNote.test(line)) {
      found.add('rule-3');
    }
  }
  return coverOrder.filter((token) => found.has(token));
}

export function pathsOf(dir, argv, code) {
  if (code === 2 || !verbsThatRead.includes(argv[0])) {
    return { baseline: null, run: null };
  }
  let baseline = argv[0] === 'show' ? null : 'evals-baseline.json';
  let run = null;
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--baseline') {
      baseline = argv[index + 1];
      index += 1;
    } else if (token === '--tolerance') {
      index += 1;
    } else if (!token.startsWith('-')) {
      run = token;
    }
  }
  return { baseline: baseline === null ? null : posix.join(dir, baseline), run: posix.join(dir, run) };
}

export function executeRow(row) {
  const io = overlayIo(row.dir, new Date(row.now));
  const { stdout, stderr, code } = cli(row.argv, io);
  return { stdout: stdout.map(maskPackageVersion), stderr, code, writes: asWrites(io.writes) };
}

export function buildVector(row) {
  const { stdout, stderr, code, writes } = executeRow(row);
  const covers = coversOf(row.argv, stdout);
  const vector = {
    id: row.id,
    dir: row.dir,
    argv: row.argv,
    now: row.now,
    ...pathsOf(row.dir, row.argv, code),
    covers,
    stdout,
    stderr,
    code,
    writes,
  };
  const reason = covers.includes('internal-error') ? internalErrorWording : row.referenceOnly;
  return reason === undefined ? vector : { ...vector, referenceOnly: reason };
}

const verbOf = (vector) => {
  if (vector.code === 2) {
    return 'usage';
  }
  return vector.argv[0] === '--version' ? 'version' : vector.argv[0];
};

const pairOf = (vector) => `${vector.baseline}\n${vector.run}`;

export function countsOf(vectors) {
  const byVerb = {};
  for (const verb of verbOrder) {
    const count = vectors.filter((vector) => verbOf(vector) === verb).length;
    if (count > 0) {
      byVerb[verb] = count;
    }
  }
  const covers = Object.fromEntries(
    coverOrder.map((token) => {
      const having = vectors.filter((vector) => vector.covers.includes(token));
      const portableVectors = having.filter((vector) => vector.referenceOnly === undefined).length;
      return [token, { vectors: having.length, pairs: new Set(having.map(pairOf)).size, portableVectors }];
    }),
  );
  const checks = vectors.filter((vector) => verbOf(vector) === 'check');
  return {
    vectors: vectors.length,
    referenceOnly: vectors.filter((vector) => vector.referenceOnly !== undefined).length,
    pairs: new Set(checks.map(pairOf)).size,
    byVerb,
    covers,
  };
}

export const specimenRows = () =>
  JSON.parse(readFileSync(join(repositoryRoot, 'fixtures', 'specimens.json'), 'utf8')).map((row) => ({ ...row, now: checkDay.toISOString() }));

function filesOf(vectors) {
  const named = new Set(vectors.flatMap((vector) => [vector.baseline, vector.run]));
  const existing = [...named].filter((path) => path !== null && existsSync(join(repositoryRoot, path))).sort();
  return Object.fromEntries(existing.map((path) => [path, readFileSync(join(repositoryRoot, path), 'utf8')]));
}

export function vectorDocument(rows = [...specimenRows(), ...extraRows]) {
  const vectors = rows.map(buildVector);
  return { specification: specificationVersion, about, counts: countsOf(vectors), vectors, files: filesOf(vectors) };
}

const isPrimitive = (item) => item === null || typeof item !== 'object';

export function jsonText(value, depth = 0) {
  const inner = '  '.repeat(depth + 1);
  const outer = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const flat = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
    if (value.every(isPrimitive) && flat.length <= 100) {
      return flat;
    }
    return `[\n${value.map((item) => `${inner}${jsonText(item, depth + 1)}`).join(',\n')}\n${outer}]`;
  }
  if (!isPrimitive(value)) {
    const entries = Object.entries(value);
    const flat = `{${entries.map(([key, item]) => `${JSON.stringify(key)}: ${JSON.stringify(item)}`).join(', ')}}`;
    if (entries.every(([, item]) => isPrimitive(item)) && flat.length <= 100) {
      return flat;
    }
    return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${jsonText(item, depth + 1)}`).join(',\n')}\n${outer}}`;
  }
  return JSON.stringify(value);
}

export const vectorText = (document) => `${jsonSafe(jsonText(document))}\n`;
