import {
  baselineWithMetrics,
  changedTolerance,
  command,
  directory,
  heldTolerance,
  metricKey,
  unchangedRecord,
  unsetTolerance,
  wroteBaseline,
} from './specimen-parts.mjs';

const heldAtTwoHundredths = 'planted/baseline-tolerance-0.02.json';

const newMetrics = { promptfoo: ['agent :: extra'], deepeval: ['Exact Match', 'Pattern Match'] };

const sampled = (keys) => keys.map((key) => [key, '1', 4]);

const rowsFor = (tool) => {
  const { accuracy, format } = metricKey[tool];
  const good = sampled([accuracy, format]);
  const extra = sampled([accuracy, format, ...newMetrics[tool]].sort());
  const fresh = ['--baseline', 'fresh.json'];
  const held = ['--baseline', heldAtTwoHundredths];
  return [
    command(`S13-${tool}-record-unset-tolerance`, directory[tool], ['record', 'run-good.json', ...fresh], {
      stdout: [unsetTolerance(2)],
      code: 3,
    }),
    command(`S13-${tool}-record-tolerance-zero`, directory[tool], ['record', 'run-good.json', ...fresh, '--tolerance', '0'], {
      stdout: [wroteBaseline('fresh.json', tool, 2)],
      writes: [['fresh.json', baselineWithMetrics(tool, good)]],
    }),
    command(`S13-${tool}-record-tolerance-conflict`, directory[tool], ['record', 'run-good-again.json', ...held, '--tolerance', '0.05'], {
      stdout: [changedTolerance('0.05', 2), heldTolerance(accuracy, '0.02'), heldTolerance(format, '0.02')],
      code: 3,
    }),
    command(`S13-${tool}-record-tolerance-equal`, directory[tool], ['record', 'run-good-again.json', ...held, '--tolerance', '0.02'], {
      stdout: [unchangedRecord(heldAtTwoHundredths)],
    }),
    command(`S13-${tool}-record-new-metric-no-tolerance`, directory[tool], ['record', 'run-extra.json', ...held], {
      stdout: [unsetTolerance(newMetrics[tool].length)],
      code: 3,
    }),
    command(`S13-${tool}-record-new-metric-with-tolerance`, directory[tool], ['record', 'run-extra.json', ...held, '--tolerance', '0.02', '--replace'], {
      stdout: [wroteBaseline(heldAtTwoHundredths, tool, extra.length)],
      writes: [[heldAtTwoHundredths, baselineWithMetrics(tool, extra, 0.02)]],
    }),
  ];
};

export const toleranceRows = ['promptfoo', 'deepeval'].flatMap(rowsFor);
