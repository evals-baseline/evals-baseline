import { promptfooDigest } from './digests.mjs';

export const baselineMetric = (key, value, samples = 4, tolerance = 0) => ({ key, value, samples, tolerance });
export const runMetric = (key, value, samples = 4) => ({ key, value, samples });

export const makeBaseline = (metrics, overrides = {}) => ({
  spec: '1.0',
  source: { tool: 'promptfoo', toolVersion: '0.125.1', shape: 'promptfoo-results-3' },
  recordedAt: '2026-09-02T09:00:00.000Z',
  cases: { count: 4, digest: promptfooDigest },
  metrics,
  ...overrides,
});

export const makeRun = (metrics, overrides = {}) => ({
  name: 'run.json',
  tool: 'promptfoo',
  toolVersion: '0.125.1',
  shape: 'promptfoo-results-3',
  cases: { count: 4, digest: promptfooDigest },
  metrics,
  refused: [],
  errors: [],
  ...overrides,
});

export const accuracy = 'agent :: accuracy';
export const format = 'agent :: format';
export const twoMetricBaseline = () => makeBaseline([baselineMetric(accuracy, 1), baselineMetric(format, 1)]);
export const twoMetricRun = () => makeRun([runMetric(accuracy, 1), runMetric(format, 1)]);

export const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
