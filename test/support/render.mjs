import { specificationVersion } from '../../src/read-baseline.mjs';
import { packageVersion } from '../../src/render.mjs';
import { promptfooDigest, promptfooThreeCasesDigest } from './digests.mjs';

export const banner = `evals-baseline ${packageVersion} (specification ${specificationVersion})`;
export const today = '2026-11-11';

export const promptfooBaseline = (overrides = {}) => ({
  spec: '1.0',
  source: { tool: 'promptfoo', toolVersion: '0.125.1', shape: 'promptfoo-results-3' },
  recordedAt: '2026-09-02T09:00:00.000Z',
  cases: { count: 4, digest: promptfooDigest },
  metrics: [
    { key: 'agent :: accuracy', value: 1, samples: 4, tolerance: 0 },
    { key: 'agent :: format', value: 1, samples: 4, tolerance: 0 },
  ],
  ...overrides,
});

export const checked = (overrides = {}) => ({
  baselinePath: 'evals-baseline.json',
  baseline: promptfooBaseline(),
  findings: [],
  notes: [],
  ...overrides,
});

export const belowBaseline = {
  id: 'below-baseline',
  key: 'agent :: accuracy',
  baseline: { value: 1000000, samples: 4, tolerance: 0 },
  run: { value: 750000, samples: 4 },
  drop: 250000,
};
export const belowBaselineLine = 'below-baseline "agent :: accuracy": 0.75 over 4 samples is below the baseline 1 over 4 samples by 0.25, more than the tolerance 0';
export const casesChanged = {
  id: 'cases-changed',
  baseline: { count: 4, digest: promptfooDigest },
  run: { count: 3, digest: promptfooThreeCasesDigest },
};
export const casesChangedLine = `cases-changed: the baseline was recorded from 4 cases (digest ${promptfooDigest}); this run holds 3 cases (digest ${promptfooThreeCasesDigest}); re-record if the change is intended`;
export const sampleCount = (key) => ({ id: 'sample-count', key, baseline: { samples: 4 }, run: { samples: 3 } });
export const runError = (text) => ({ kind: 'run-error', text });

export const header = `${banner} check "evals-baseline.json": promptfoo "0.125.1", 2 metrics, 4 cases`;
export const dateLine = 'date: baseline recorded 2026-09-02, 70 days before this check on 2026-11-11';

export const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
