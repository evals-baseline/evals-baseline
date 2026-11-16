import { deepFreeze } from './compare-fixtures.mjs';

const MICRO = 1000000;

export function seededRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  const integer = (low, high) => low + Math.floor(next() * (high - low + 1));
  const pick = (choices) => choices[integer(0, choices.length - 1)];
  const chance = (probability) => next() < probability;
  const shuffled = (items) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = integer(0, index);
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  };
  return { integer, pick, chance, shuffled };
}

export const keyPool = [
  'a',
  'b',
  'c',
  'zz',
  'agent :: accuracy',
  'agent :: format',
  'Failure rate',
  'k"\\',
  'line\nbreak',
  '##[stop-commands]tok',
  'tag\u{e0069}x',
  'bidi\u202eflip',
  'nul\u0000x',
  'Ünï',
  '',
  ' ',
];

const sentencePool = [
  'the reader refused it',
  'a "quoted" reason',
  'two\nlines',
  '::error::injected',
  `promptfoo's weight total for it is 0, which is not a positive number`,
  '',
  'tag\u{e0041}\u{e0042}',
];

const versionPool = ['0.125.1', '0.126.0', '1', 'v"1\\', '0.1\n.2', ''];
const shapeByTool = { promptfoo: 'promptfoo-results-3', deepeval: 'deepeval-test-run' };
const microPool = [0, 1, -1, 2, 499999, 500000, 899999, 900000, 920000, 1000000, 1000001, -1500000, -1600001];
const largePool = [4000000000, -4000000000, 3999999999.999999, 123456789.123456];
const hexDigits = [...'0123456789abcdef'];

const hexDigest = (random) => Array.from({ length: 12 }, () => random.pick(hexDigits)).join('');

function aValue(random) {
  if (random.chance(0.05)) {
    return random.pick(largePool);
  }
  const base = random.chance(0.6) ? random.pick(microPool) : random.integer(-5 * MICRO, 5 * MICRO);
  const noise = random.pick([0, 0, 0, -0.49, 0.4, 0.5, 0.51, 0.1, 0.2]);
  return (base + noise) / MICRO;
}

const aTolerance = (random) => random.pick([0, 0, 1 / MICRO, Math.abs(aValue(random)), Math.abs(aValue(random))]);

function runValueNear(random, expected) {
  if (random.chance(0.3)) {
    return aValue(random);
  }
  const tolerance = Math.round(expected.tolerance * MICRO);
  return (Math.round(expected.value * MICRO) - tolerance + random.integer(-3, 3)) / MICRO;
}

function runSamplesNear(random, expected) {
  return Math.max(1, random.pick([expected.samples, expected.samples, expected.samples - 1, expected.samples + 1, random.integer(1, 12)]));
}

const baselineMetric = (random, key) => ({ key, value: aValue(random), samples: random.integer(1, 9), tolerance: aTolerance(random) });

const wideKeys = Array.from({ length: 16 }, (_, index) => `wide-${String.fromCharCode(97 + index)}`);

function generateMetrics(random, baselineMetrics) {
  const run = { metrics: [], refused: [], errors: [] };
  for (const expected of baselineMetrics) {
    const fate = random.integer(0, 9);
    if (fate < 6) {
      run.metrics.push({ key: expected.key, value: runValueNear(random, expected), samples: runSamplesNear(random, expected) });
    } else if (fate < 8) {
      run.refused.push({ key: expected.key, reason: random.pick(sentencePool) });
    }
  }
  const taken = new Set([...baselineMetrics.map((metric) => metric.key)]);
  for (const key of keyPool.filter((candidate) => !taken.has(candidate))) {
    const fate = random.integer(0, 9);
    if (fate === 0) {
      run.metrics.push({ key, value: aValue(random), samples: random.integer(1, 9) });
    } else if (fate === 1) {
      run.refused.push({ key, reason: random.pick(sentencePool) });
    }
  }
  if (random.chance(0.12)) {
    for (const key of random.shuffled(wideKeys).slice(0, random.integer(11, wideKeys.length))) {
      run.metrics.push({ key, value: aValue(random), samples: random.integer(1, 9) });
    }
  }
  run.errors = Array.from({ length: random.integer(0, 2) }, () => random.pick(sentencePool));
  return run;
}

export function generateComparison(random) {
  const tool = random.pick(['promptfoo', 'deepeval']);
  const runTool = random.chance(0.08) ? (tool === 'promptfoo' ? 'deepeval' : 'promptfoo') : tool;
  const baselineKeys = random.shuffled(keyPool.filter(() => random.chance(0.35)));
  const baselineMetrics = baselineKeys.map((key) => baselineMetric(random, key));
  const digest = hexDigest(random);
  const baselineVersion = random.chance(0.2) ? null : random.pick(versionPool);
  const generated = generateMetrics(random, baselineMetrics);
  return deepFreeze({
    baseline: {
      spec: '1.0',
      source: { tool, toolVersion: baselineVersion, shape: shapeByTool[tool] },
      recordedAt: '2026-09-02T09:00:00.000Z',
      cases: { count: random.integer(1, 9), digest },
      metrics: baselineMetrics,
    },
    run: {
      name: random.pick(['run.json', '../pf/run-good.json', 'p"\\.json', 'a\nb.json', '']),
      tool: runTool,
      toolVersion: random.chance(0.2) ? null : random.chance(0.5) ? baselineVersion : random.pick(versionPool),
      shape: shapeByTool[runTool],
      cases: { count: random.integer(1, 9), digest: random.chance(0.6) ? digest : hexDigest(random) },
      metrics: random.shuffled(generated.metrics),
      refused: random.shuffled(generated.refused),
      errors: generated.errors,
    },
  });
}

export function generateComparisons(seed, total) {
  const random = seededRandom(seed);
  return Array.from({ length: total }, () => generateComparison(random));
}
