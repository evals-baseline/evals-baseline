import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeCannotRead, describeFinding, describeNote } from '../src/describe.mjs';
import { refuse } from '../src/unreadable.mjs';
import { deepFreeze } from './support/compare-fixtures.mjs';
import { promptfooDigest, promptfooThreeCasesDigest } from './support/digests.mjs';
import {
  fieldsOf,
  findingFields,
  givenFields,
  hostileFindings,
  hostileNotes,
  noteFields,
  spanFields,
  textFields,
  variantOf,
  withValue,
} from './support/model.mjs';

const accuracy = 'agent :: accuracy';
const belowBaseline = (key, baseline, run, drop) => ({ id: 'below-baseline', key, baseline, run, drop });
const refusedFile = (id, file, problem) => ({ id, file, cause: 'refused', problem });
const cannotRead = (id, file, failure) => ({ id, file, cause: 'cannot-read', failure });

const findingLines = [
  [
    { id: 'missing-metric', key: 'agent :: format', baseline: { value: 1000000, samples: 4 } },
    'missing-metric "agent :: format": the baseline names it (1 over 4 samples) and this run has no such metric',
  ],
  [
    { id: 'missing-metric', key: 'm', baseline: { value: 920000, samples: 1 } },
    'missing-metric "m": the baseline names it (0.92 over 1 sample) and this run has no such metric',
  ],
  [{ id: 'unreadable-metric', key: 'Failure rate', reason: 'the reader refused it' }, 'unreadable-metric "Failure rate": the reader refused it'],
  [
    belowBaseline(accuracy, { value: 920000, samples: 4, tolerance: 20000 }, { value: 899999, samples: 4 }, 20001),
    'below-baseline "agent :: accuracy": 0.899999 over 4 samples is below the baseline 0.92 over 4 samples by 0.020001, more than the tolerance 0.02',
  ],
  [
    belowBaseline(accuracy, { value: 1000000, samples: 7, tolerance: 0 }, { value: 500000, samples: 3 }, 500000),
    'below-baseline "agent :: accuracy": 0.5 over 3 samples is below the baseline 1 over 7 samples by 0.5, more than the tolerance 0',
  ],
  [
    belowBaseline(accuracy, { value: 1000000, samples: 1, tolerance: 0 }, { value: 0, samples: 1 }, 1000000),
    'below-baseline "agent :: accuracy": 0 over 1 sample is below the baseline 1 over 1 sample by 1, more than the tolerance 0',
  ],
  [
    belowBaseline('score', { value: -1500000, samples: 4, tolerance: 100000 }, { value: -1600001, samples: 4 }, 100001),
    'below-baseline "score": -1.600001 over 4 samples is below the baseline -1.5 over 4 samples by 0.100001, more than the tolerance 0.1',
  ],
  [
    { id: 'sample-count', key: accuracy, baseline: { samples: 4 }, run: { samples: 3 } },
    'sample-count "agent :: accuracy": the baseline holds 4 samples and this run holds 3',
  ],
  [
    { id: 'sample-count', key: 'agent :: format', baseline: { samples: 2 }, run: { samples: 1 } },
    'sample-count "agent :: format": the baseline holds 2 samples and this run holds 1',
  ],
  [
    { id: 'cases-changed', baseline: { count: 4, digest: promptfooDigest }, run: { count: 3, digest: promptfooThreeCasesDigest } },
    `cases-changed: the baseline was recorded from 4 cases (digest ${promptfooDigest}); this run holds 3 cases (digest ${promptfooThreeCasesDigest}); re-record if the change is intended`,
  ],
  [
    { id: 'cases-changed', baseline: { count: 1, digest: 'aaaaaaaaaaaa' }, run: { count: 1, digest: 'bbbbbbbbbbbb' } },
    'cases-changed: the baseline was recorded from 1 case (digest aaaaaaaaaaaa); this run holds 1 case (digest bbbbbbbbbbbb); re-record if the change is intended',
  ],
  [
    { id: 'no-baseline', file: 'does-not-exist.json' },
    'no-baseline: no baseline at "does-not-exist.json"; nothing was compared; record one with: evals-baseline record <run-file>',
  ],
  [cannotRead('bad-baseline', 'evals-baseline.json', 'EISDIR'), 'bad-baseline: cannot read "evals-baseline.json": EISDIR'],
  [
    refusedFile('bad-baseline', 'evals-baseline.json', 'missing key "source" in the baseline'),
    'bad-baseline: "evals-baseline.json": missing key "source" in the baseline',
  ],
  [cannotRead('bad-run', 'missing.json', 'ENOENT'), 'bad-run: cannot read "missing.json": not found'],
  [cannotRead('bad-run', 'dir.json', 'EISDIR'), 'bad-run: cannot read "dir.json": EISDIR'],
  [
    refusedFile('bad-run', '/tmp/hand.json', 'neither a promptfoo results file nor a DeepEval test run; top-level keys: "accuracy"'),
    'bad-run: "/tmp/hand.json": neither a promptfoo results file nor a DeepEval test run; top-level keys: "accuracy"',
  ],
  [
    {
      id: 'bad-run',
      file: '../pf/run-good.json',
      cause: 'other-tool',
      baseline: { tool: 'deepeval', shape: 'deepeval-test-run' },
      run: { tool: 'promptfoo', shape: 'promptfoo-results-3' },
    },
    'bad-run: "../pf/run-good.json": the baseline was recorded from deepeval (deepeval-test-run) and this file is promptfoo (promptfoo-results-3)',
  ],
  [{ id: 'internal-error', message: 'the reader broke on purpose' }, 'internal-error: "the reader broke on purpose"'],
];

const noteLines = [
  [{ kind: 'metrics-only-in-run', keys: ['agent :: extra'] }, '1 metric(s) only in this run, not compared (rule 3): "agent :: extra"'],
  [
    { kind: 'metrics-only-in-run', keys: ['agent :: extra', 'agent :: zz'] },
    '2 metric(s) only in this run, not compared (rule 3): "agent :: extra", "agent :: zz"',
  ],
  [
    { kind: 'more-samples', key: accuracy, baseline: { samples: 4 }, run: { samples: 8 } },
    '"agent :: accuracy": the baseline holds 4 samples and this run holds 8; more samples than the baseline are never a finding',
  ],
  [
    { kind: 'more-samples', key: 'agent :: format', baseline: { samples: 1 }, run: { samples: 2 } },
    '"agent :: format": the baseline holds 1 sample and this run holds 2; more samples than the baseline are never a finding',
  ],
  [
    { kind: 'run-error', text: '"agent": 1 errored test(s) in this run (promptfoo testErrorCount)' },
    '"agent": 1 errored test(s) in this run (promptfoo testErrorCount)',
  ],
  [{ kind: 'refused-metric', key: 'Failure rate', reason: 'the reader refused it' }, '"Failure rate" cannot be read: the reader refused it'],
  [
    { kind: 'tool-version-changed', tool: 'promptfoo', baseline: { toolVersion: '0.125.1' }, run: { toolVersion: '0.126.0' } },
    'the baseline was recorded by promptfoo "0.125.1"; this run was written by "0.126.0"',
  ],
];

const examples = [...findingLines, ...noteLines].map(([record]) => record);
const composerOf = (record) => (record.kind === undefined ? describeFinding : describeNote);
const probeFor = (path, text) => (path === 'keys' ? [text] : text);

for (const [finding, line] of findingLines) {
  test(`${variantOf(finding)}: the record ${JSON.stringify(finding).slice(0, 70)} is the line ${line.slice(0, 60)}`, () => {
    assert.equal(describeFinding(finding), line);
  });
}

for (const [note, sentence] of noteLines) {
  test(`${variantOf(note)}: the record ${JSON.stringify(note).slice(0, 70)} is the sentence ${sentence.slice(0, 60)}`, () => {
    assert.equal(describeNote(note), sentence);
  });
}

test('the lines above cover every variant of the field set, and each record holds the fields its variant is pinned to hold', () => {
  assert.deepEqual([...new Set(findingLines.map(([finding]) => variantOf(finding)))].sort(), Object.keys(findingFields).sort());
  assert.deepEqual([...new Set(noteLines.map(([note]) => variantOf(note)))].sort(), Object.keys(noteFields).sort());
  for (const [finding] of findingLines) {
    assert.deepEqual(fieldsOf(finding), findingFields[variantOf(finding)], variantOf(finding));
  }
  for (const [note] of noteLines) {
    assert.deepEqual(fieldsOf(note), noteFields[variantOf(note)], variantOf(note));
  }
});

test('a finding that has a key is headed by its id and the key between double quotes, and one with none by its id alone', () => {
  const keyed = hostileFindings('x').filter((finding) => finding.key !== undefined);
  assert.equal(keyed.length, 4);
  for (const finding of keyed) {
    assert.equal(describeFinding(finding).startsWith(`${finding.id} "x": `), true, finding.id);
  }
  for (const finding of hostileFindings('x').filter((candidate) => candidate.key === undefined)) {
    assert.equal(describeFinding(finding).startsWith(`${finding.id}: `), true, finding.id);
  }
});

test('the word for a file that is not there is spelt in one place: ENOENT is "not found" and every other code is printed as it is', () => {
  assert.equal(describeCannotRead('run.json', 'ENOENT'), 'cannot read "run.json": not found');
  assert.equal(describeCannotRead('run.json', 'EACCES'), 'cannot read "run.json": EACCES');
  assert.equal(describeFinding(cannotRead('bad-run', 'run.json', 'ENOENT')), `bad-run: ${describeCannotRead('run.json', 'ENOENT')}`);
});

test('the line of a refused file is the message the refusal itself carries, so the two cannot drift apart', () => {
  for (const [file, problem] of [['run.json', 'not JSON'], ['p"\\.json', 'a "quoted" problem'], ['a\nb.json', 'two\nlines']]) {
    assert.equal(describeFinding(refusedFile('bad-run', file, problem)), `bad-run: ${refuse(file, problem).message}`);
    assert.equal(describeFinding(refusedFile('bad-baseline', file, problem)), `bad-baseline: ${refuse(file, problem).message}`);
  }
});

test('every text field of every variant is a span that is quoted in the line or a given word or sentence that is printed as it stands, and none is both', () => {
  for (const record of examples) {
    const variant = variantOf(record);
    assert.deepEqual([...spanFields[variant], ...givenFields[variant]].sort(), textFields(record), variant);
  }
  assert.deepEqual(Object.keys(spanFields).sort(), [...Object.keys(findingFields), ...Object.keys(noteFields)].sort());
  assert.deepEqual(Object.keys(givenFields).sort(), Object.keys(spanFields).sort());
});

test('a span field is printed between double quotes and a given field is printed as it stands, in a record of every variant', () => {
  for (const record of examples) {
    const variant = variantOf(record);
    const compose = composerOf(record);
    for (const path of spanFields[variant]) {
      assert.equal(compose(withValue(record, path, probeFor(path, 'probe'))).includes('"probe"'), true, `${variant} ${path}`);
    }
    for (const path of givenFields[variant]) {
      const line = compose(withValue(record, path, 'probe'));
      assert.equal(line.includes('probe') && !line.includes('"probe"'), true, `${variant} ${path}`);
    }
  }
});

test('a span field holds what the file spelt, and the line writes a double quote in it as \\u0022 and a backslash as \\\\, in a record of every variant', () => {
  const spelt = 'a"b\\c';
  for (const record of examples) {
    const variant = variantOf(record);
    for (const path of spanFields[variant]) {
      const line = composerOf(record)(withValue(record, path, probeFor(path, spelt)));
      assert.equal(line.includes('"a\\u0022b\\\\c"'), true, `${variant} ${path}`);
      assert.equal(line.includes(spelt), false, `${variant} ${path}`);
    }
  }
});

test('no line prints undefined, whatever the variant', () => {
  const lines = [...hostileFindings('x').map(describeFinding), ...hostileNotes('x').map(describeNote)];
  assert.equal(lines.length, Object.keys(findingFields).length + Object.keys(noteFields).length);
  for (const line of lines) {
    assert.equal(line.includes('undefined'), false, line);
  }
});

test('a note that lists keys names the first ten, then how many more, and counts all of them', () => {
  const keys = Array.from({ length: 13 }, (_, index) => `extra-${String.fromCharCode(97 + index)}`);
  assert.equal(
    describeNote({ kind: 'metrics-only-in-run', keys }),
    '13 metric(s) only in this run, not compared (rule 3): "extra-a", "extra-b", "extra-c", "extra-d", "extra-e", "extra-f", "extra-g", "extra-h", "extra-i", "extra-j", and 3 more',
  );
});

test('composing a line changes nothing in the record and gives the same line twice', () => {
  const frozen = deepFreeze([...hostileFindings('x'), ...hostileNotes('x')]);
  for (const record of frozen) {
    const compose = composerOf(record);
    assert.equal(compose(record), compose(record));
  }
});

test('a record of an id or a kind nobody defined is refused, and is not printed as a line about undefined', () => {
  assert.throws(() => describeFinding({ id: 'no-such-finding', key: 'k' }));
  assert.throws(() => describeNote({ kind: 'no-such-note' }));
});
