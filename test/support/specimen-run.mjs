import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { repositoryRoot } from './fixtures.mjs';

export const checkDay = new Date('2026-11-11T12:00:00.000Z');
export const checkDayAYearLater = new Date('2027-11-11T12:00:00.000Z');

export function overlayIo(directory, now = checkDay) {
  const overlay = new Map();
  const writes = [];
  return {
    writes,
    readFile(path) {
      return overlay.has(path) ? overlay.get(path) : readFileSync(join(repositoryRoot, directory, path), 'utf8');
    },
    writeFile(path, text) {
      overlay.set(path, text);
      writes.push([path, text]);
    },
    now: () => now,
  };
}

const regressionIds = new Set(['missing-metric', 'below-baseline', 'sample-count']);

const idOf = (findingLine) => findingLine.split(/[ :]/)[0];

export const strictCodeOf = (failing) => {
  if (failing.some((line) => regressionIds.has(idOf(line)))) {
    return 1;
  }
  return failing.length > 0 ? 3 : 0;
};

const summaryFor = (findingCount, failing, strict) => {
  if (findingCount === 0) {
    return 'evals-baseline: no findings';
  }
  const counted = `evals-baseline: ${findingCount} ${findingCount === 1 ? 'finding' : 'findings'}`;
  if (failing.length === 0) {
    return `${counted}; warning only, exit 0 (cases-changed never fails --strict)`;
  }
  const code = strictCodeOf(failing);
  return strict ? `${counted}; exit ${code} (--strict)` : `${counted}; warning only, exit 0 (pass --strict to exit ${code})`;
};

export function expectedFor(specimen, strict) {
  if (specimen.kind === 'command') {
    return { stdout: specimen.stdout, stderr: specimen.stderr ?? [], code: specimen.code, findings: [], failing: [], writes: specimen.writes };
  }
  const { head, findings, notes, failing } = specimen;
  return {
    stdout: [...head, ...findings, ...notes, summaryFor(findings.length, failing, strict)],
    stderr: [],
    code: strict ? strictCodeOf(failing) : 0,
    findings,
    failing,
    writes: [],
  };
}

export function rowsOf(specimen) {
  if (specimen.kind === 'command') {
    return [{ id: specimen.id, dir: specimen.dir, argv: specimen.argv }];
  }
  return [
    { id: specimen.id, dir: specimen.dir, argv: specimen.argv },
    { id: `${specimen.id}-strict`, dir: specimen.dir, argv: [...specimen.argv, '--strict'] },
  ];
}

export function runRow(cli, row, now = checkDay) {
  const io = overlayIo(row.dir, now);
  const { stdout, stderr, code, findings, failing } = cli(row.argv, io);
  return { stdout, stderr, code, findings, failing, writes: io.writes };
}

export const givesExpected = (actual, expected) => isDeepStrictEqual(actual, expected);

export function specimenGivesExpected(cli, specimen) {
  return rowsOf(specimen).every((row, index) => {
    const strict = index === 1;
    try {
      return givesExpected(runRow(cli, row), expectedFor(specimen, strict));
    } catch {
      return false;
    }
  });
}

export const specimenIndexText = (specimens) => `[\n${specimens.flatMap(rowsOf).map((row) => `  ${JSON.stringify(row)}`).join(',\n')}\n]\n`;
