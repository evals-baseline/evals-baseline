import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderShow } from '../src/render.mjs';
import { deepevalDigest, promptfooDigest } from './support/digests.mjs';
import { banner } from './support/render.mjs';

const showHeader = (quotedFile, described) => `${banner} show ${quotedFile}: ${described}`;

const promptfooRun = (overrides = {}) => ({
  name: 'run-good.json',
  tool: 'promptfoo',
  toolVersion: '0.125.1',
  shape: 'promptfoo-results-3',
  cases: { count: 4, digest: promptfooDigest },
  metrics: [
    { key: 'agent :: accuracy', value: 1, samples: 4 },
    { key: 'agent :: format', value: 1, samples: 4 },
  ],
  refused: [],
  errors: [],
  ...overrides,
});

test('show prints one header, then each metric with its value and sample count, as the specification shows it', () => {
  assert.deepEqual(renderShow(promptfooRun(), 'run-good.json'), [
    showHeader('"run-good.json"', `promptfoo "0.125.1" (promptfoo-results-3), 2 metrics, 4 cases (digest ${promptfooDigest})`),
    'metric "agent :: accuracy"  1  4 samples',
    'metric "agent :: format"  1  4 samples',
  ]);
});

test('show for a DeepEval run says the version is unknown and prints a refused metric as a note, as Appendix B shows it', () => {
  const run = {
    name: 'run-inverted.json',
    tool: 'deepeval',
    toolVersion: null,
    shape: 'deepeval-test-run',
    cases: { count: 4, digest: deepevalDigest },
    metrics: [
      { key: 'Accuracy', value: 1, samples: 4 },
      { key: 'Format', value: 1, samples: 4 },
    ],
    refused: [
      {
        key: 'Failure rate',
        reason:
          "DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only",
      },
    ],
    errors: [],
  };
  assert.deepEqual(renderShow(run, 'run-inverted.json'), [
    showHeader('"run-inverted.json"', `deepeval version unknown (deepeval-test-run), 2 metrics, 4 cases (digest ${deepevalDigest})`),
    'metric "Accuracy"  1  4 samples',
    'metric "Format"  1  4 samples',
    "note: \"Failure rate\" cannot be read: DeepEval's own verdicts contradict higher-is-better in 4 sample(s) (success=true, score=0, threshold=0.5); this implementation reads higher-is-better metrics only",
  ]);
});

test('show prints values in millionths without trailing zeros, one sample in the singular, and error notes after refused ones', () => {
  const run = promptfooRun({
    cases: { count: 1, digest: promptfooDigest },
    metrics: [{ key: 'm', value: 0.583333, samples: 1 }],
    refused: [{ key: 'w', reason: 'why' }],
    errors: ['"agent": 1 errored test(s) in this run (promptfoo testErrorCount)'],
  });
  assert.deepEqual(renderShow(run, 'r.json'), [
    showHeader('"r.json"', `promptfoo "0.125.1" (promptfoo-results-3), 1 metric, 1 case (digest ${promptfooDigest})`),
    'metric "m"  0.583333  1 sample',
    'note: "w" cannot be read: why',
    'note: "agent": 1 errored test(s) in this run (promptfoo testErrorCount)',
  ]);
});

test('show of a promptfoo run with no named metric says what to add', () => {
  assert.deepEqual(renderShow(promptfooRun({ metrics: [] }), 'run-unnamed.json'), [
    showHeader('"run-unnamed.json"', `promptfoo "0.125.1" (promptfoo-results-3), 0 metrics, 4 cases (digest ${promptfooDigest})`),
    'note: no named metric in this run; add "metric: <name>" to the assertions you want guarded',
  ]);
});

test('show of a DeepEval run with no metric sample says so', () => {
  const run = promptfooRun({ tool: 'deepeval', toolVersion: null, shape: 'deepeval-test-run', metrics: [] });
  assert.equal(renderShow(run, 'r.json')[1], 'note: no metric with a valid sample in this run');
});

test('show does not claim there is no metric when every metric was refused', () => {
  const lines = renderShow(promptfooRun({ metrics: [], refused: [{ key: 'w', reason: 'why' }] }), 'r.json');
  assert.deepEqual(lines.slice(1), ['note: "w" cannot be read: why']);
});

test('show escapes a hostile metric key and file name inside their quotes', () => {
  const run = promptfooRun({ metrics: [{ key: 'agent :: bad\n::error::pwned\u001b[31m', value: 1, samples: 4 }] });
  const lines = renderShow(run, 'a\nb.json');
  assert.equal(lines[0].startsWith(`${banner} show "a\\u000ab.json": `), true);
  assert.equal(lines[1], 'metric "agent :: bad\\u000a::error::pwned\\u001b[31m"  1  4 samples');
  for (const line of lines) {
    assert.equal(/[\u0000-\u001f\u007f]/.test(line), false);
  }
});

test('show starts every metric line with the word metric and a quote, so a key that looks like a workflow command never starts a line', () => {
  const run = promptfooRun({
    metrics: [
      { key: '::add-mask::Capital :: accuracy', value: 1, samples: 4 },
      { key: '::error title=pwned::forged annotation', value: 0.5, samples: 1 },
    ],
  });
  assert.deepEqual(renderShow(run, 'r.json').slice(1), [
    'metric "::add-mask::Capital :: accuracy"  1  4 samples',
    'metric "::error title=pwned::forged annotation"  0.5  1 sample',
  ]);
});

test('show prints ##[ and the line breaks that are not on the keyboard escaped in a metric key, a refused metric, an error and the file name', () => {
  const key = 'a##[b\u2028c\u0085d';
  const printed = 'a##\\u005bb\\u2028c\\u0085d';
  const run = promptfooRun({ metrics: [{ key, value: 1, samples: 4 }], refused: [{ key, reason: key }], errors: [key] });
  assert.deepEqual(renderShow(run, key), [
    showHeader(`"${printed}"`, `promptfoo "0.125.1" (promptfoo-results-3), 1 metric, 4 cases (digest ${promptfooDigest})`),
    `metric "${printed}"  1  4 samples`,
    `note: "${printed}" cannot be read: ${printed}`,
    `note: ${printed}`,
  ]);
});

test('show wraps the tool version, the file name and the metric key in quotes, and doubles a backslash and escapes a double quote inside them', () => {
  const run = promptfooRun({ toolVersion: 'v"1\\', metrics: [{ key: 'a"b\\c', value: 1, samples: 4 }] });
  assert.deepEqual(renderShow(run, 'x"y\\z.json'), [
    showHeader('"x\\u0022y\\\\z.json"', `promptfoo "v\\u00221\\\\" (promptfoo-results-3), 1 metric, 4 cases (digest ${promptfooDigest})`),
    'metric "a\\u0022b\\\\c"  1  4 samples',
  ]);
});
