import { jsonSafe } from '../../src/printable.mjs';

export const asAsciiText = (document) => jsonSafe(`${JSON.stringify(document, null, 2)}\n`);

export const editedAscii = (edit) => (sourceText) => {
  const document = JSON.parse(sourceText);
  edit(document);
  return asAsciiText(document);
};

export const deepevalMetric = (metric, scores) => ({ metric, scores, passes: scores.length, fails: 0, errors: 0 });

export const promptfooNamedMetric = (name, { sum, count, weight }) =>
  editedAscii((document) => {
    const { namedScores, namedScoresCount, namedScoreWeights } = document.results.prompts[0].metrics;
    namedScores[name] = sum;
    namedScoresCount[name] = count;
    namedScoreWeights[name] = weight;
  });
