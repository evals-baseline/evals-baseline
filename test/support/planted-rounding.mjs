import { deepevalMetric, editedAscii, promptfooNamedMetric } from './planted-edits.mjs';

const decimalTies = [5e-7, 0.0001245, 0.0001265, 0.1234565, 0.0078125, -0.8984375, -0.9140625, -7e-7, -5e-7];

const sumOrderAccuracyScores = [
  0, 0.95, 0.6, 0.75, 0.85, 0.6, 0.95, 0.5, 1, 0.75, 0.95, 0.6, 0.5, 1, 1, 0.7, 0.8, 0.5, 0.95, 0.5, 1, 0, 1, 0.7, 0.9, 0.95, 0.85, 0.8, 0.9, 1, 0.9, 0.8,
];

const sumOrderFormatScores = [
  0.85, 0.5, 0.95, 0.5, 0.75, 0.9, 1, 0.85, 0.75, 0.85, 0.5, 0.95, 1, 0.6, 0.8, 0.75, 0.95, 0.95, 0.9, 0.9, 0.95, 1, 0.7, 0, 0.6, 1, 0.85, 0.8, 0.95, 0.7, 0, 0.6,
];

export const promptfooRounding = [
  { file: 'run-tie-117-of-128.json', source: 'run-good.json', derive: promptfooNamedMetric('accuracy', { sum: 117, count: 128, weight: 128 }) },
];

export const deepevalRounding = [
  {
    file: 'run-sum-order.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.metricsScores = [deepevalMetric('Accuracy', sumOrderAccuracyScores), deepevalMetric('Format', sumOrderFormatScores)];
    }),
  },
  {
    file: 'run-ties.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.metricsScores = decimalTies.map((tie) => deepevalMetric(`tie ${tie}`, [tie]));
    }),
  },
];
