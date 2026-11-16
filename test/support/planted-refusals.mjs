import { deepevalMetric, editedAscii, promptfooNamedMetric } from './planted-edits.mjs';

const specSpellings = ['1.0.0', '1.0.7', '01.00', '1.00', '1.10', '0.9'];

const hostileNames = [
  '##[stop-commands]tok',
  '::error title=pwned::forged annotation',
  'Accuracy\u2028below-baseline Format: 0 is below the baseline 1 by 1, more than the tolerance 0\u2028',
  'Line\u0085break',
  'Csi\u009b31mred',
  'Rlo\u202eabc',
];

const byCodeUnit = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

function replacedOnce(text, from, to) {
  const occurrences = text.split(from).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${JSON.stringify(from)} occurs ${occurrences} times in the source text, so the planted text would not be what it claims`);
  }
  return text.replace(from, () => to);
}

const deepevalScores = (metric, scores) =>
  editedAscii((document) => {
    document.metricsScores.find((entry) => entry.metric === metric).scores = scores;
  });

export const promptfooRefusals = [
  ...specSpellings.map((spelling) => ({
    file: `baseline-spec-${spelling}.json`,
    source: 'evals-baseline.json',
    derive: editedAscii((document) => {
      document.spec = spelling;
    }),
  })),
  {
    file: 'baseline-duplicate-metric.json',
    source: 'evals-baseline.json',
    derive: (sourceText) =>
      replacedOnce(
        sourceText,
        '    "agent :: format": {',
        '    "agent :: accuracy": {\n      "value": 0.5,\n      "samples": 4,\n      "tolerance": 0\n    },\n    "agent :: format": {',
      ),
  },
  {
    file: 'baseline-value-4000000001.json',
    source: 'evals-baseline.json',
    derive: editedAscii((document) => {
      document.metrics['agent :: accuracy'].value = 4000000001;
    }),
  },
  {
    file: 'run-duplicate-key.json',
    source: 'run-good.json',
    derive: (sourceText) =>
      replacedOnce(sourceText, '"namedScores": {\n            "accuracy": 4,', '"namedScores": {\n            "accuracy": 0,\n            "accuracy": 4,'),
  },
  ...[4000000000, 4000000001].map((value) => ({
    file: `run-value-${value}.json`,
    source: 'run-good.json',
    derive: promptfooNamedMetric('accuracy', { sum: value * 4, count: 4, weight: 4 }),
  })),
];

export const deepevalRefusals = [
  {
    file: 'baseline-hostile-names.json',
    source: 'evals-baseline.json',
    derive: editedAscii((document) => {
      const hostile = { value: 1, samples: 4, tolerance: 0 };
      document.metrics = Object.fromEntries([...Object.entries(document.metrics), ...hostileNames.map((name) => [name, hostile])].sort(byCodeUnit));
    }),
  },
  {
    file: 'run-hostile-names.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.metricsScores.push(...hostileNames.map((name) => deepevalMetric(name, [1, 1, 1, 1])));
    }),
  },
  {
    file: 'run-duplicate-key.json',
    source: 'run-good.json',
    derive: (sourceText) =>
      replacedOnce(
        sourceText,
        '"metric": "Accuracy", "scores": [1.0, 1.0, 1.0, 1.0],',
        '"metric": "Accuracy", "scores": [0.0, 0.0, 0.0, 0.0], "scores": [1.0, 1.0, 1.0, 1.0],',
      ),
  },
  ...[4000000000, 4000000001].map((value) => ({
    file: `run-value-${value}.json`,
    source: 'run-good.json',
    derive: deepevalScores('Accuracy', Array(4).fill(value)),
  })),
];
