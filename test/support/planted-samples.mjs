import { deepevalMetric, editedAscii, promptfooNamedMetric } from './planted-edits.mjs';

const chained = (...edits) => (sourceText) => edits.reduce((text, edit) => edit(text), sourceText);

const promptfooEvery = (count) =>
  chained(
    promptfooNamedMetric('accuracy', { sum: count, count, weight: count }),
    promptfooNamedMetric('format', { sum: count, count, weight: count }),
  );

export const promptfooSamples = [
  { file: 'run-more-samples.json', source: 'run-good.json', derive: promptfooEvery(8) },
  { file: 'run-fewer-samples-and-a-drop.json', source: 'run-good.json', derive: promptfooNamedMetric('accuracy', { sum: 2, count: 3, weight: 3 }) },
];

export const deepevalSamples = [
  {
    file: 'run-more-samples.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.metricsScores = [deepevalMetric('Accuracy', Array(8).fill(1)), deepevalMetric('Format', Array(8).fill(1))];
    }),
  },
  {
    file: 'run-fewer-samples-and-a-drop.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.metricsScores[0] = deepevalMetric('Accuracy', [1, 1, 0]);
    }),
  },
];
