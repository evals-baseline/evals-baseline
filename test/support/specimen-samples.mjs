import { below, check, directory, metricKey, moreSamples, readHead, sampleCount } from './specimen-parts.mjs';

export const sampleRows = ['promptfoo', 'deepeval'].flatMap((tool) => {
  const { accuracy, format } = metricKey[tool];
  return [
    check(`S4-${tool}-more-samples`, directory[tool], ['planted/run-more-samples.json'], {
      head: readHead(tool),
      notes: [moreSamples(accuracy), moreSamples(format)],
    }),
    check(`S4-${tool}-fewer-samples-and-a-drop`, directory[tool], ['planted/run-fewer-samples-and-a-drop.json'], {
      head: readHead(tool),
      findings: [below(accuracy, '0.666667', '1', '0.333333', '0', { runSamples: 3 }), sampleCount(accuracy)],
    }),
  ];
});
