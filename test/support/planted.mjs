import { deepevalIdentity, promptfooIdentity } from './planted-identity.mjs';
import { promptfooInjection } from './planted-injection.mjs';
import { deepevalRecords, promptfooRecords } from './planted-records.mjs';
import { deepevalRefusals, promptfooRefusals } from './planted-refusals.mjs';
import { deepevalRounding, promptfooRounding } from './planted-rounding.mjs';
import { deepevalSamples, promptfooSamples } from './planted-samples.mjs';

export const deepNestingDepth = 11000;

const deepPlaceholder = '__DEEP__';
const accuracyValues = ['0.9', '0.900001', '0.899999', '0.95'];

const asText = (document) => JSON.stringify(document, null, 2) + '\n';

const edited = (edit) => (sourceText) => {
  const document = JSON.parse(sourceText);
  edit(document);
  return asText(document);
};

const constant = (text) => () => text;

const promptfooAccuracy = (value) =>
  edited((document) => {
    document.results.prompts[0].metrics.namedScores.accuracy = Number(value) * 4;
  });

const deepevalAccuracy = (value) =>
  edited((document) => {
    const last = Math.round((Number(value) * 4 - 3) * 1e6) / 1e6;
    const entry = document.metricsScores.find((score) => score.metric === 'Accuracy');
    entry.scores = [1, 1, 1, last];
  });

const everyTolerance = (tolerance) =>
  edited((document) => {
    for (const metric of Object.values(document.metrics)) {
      metric.tolerance = tolerance;
    }
  });

const renamedKey = (object, from, to) =>
  Object.fromEntries(Object.entries(object).map(([key, value]) => [key === from ? to : key, value]));

const promptfooEntries = [
  {
    file: 'baseline-boundary.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      Object.assign(document.metrics['agent :: accuracy'], { value: 0.92, tolerance: 0.02 });
    }),
  },
  ...accuracyValues.map((value) => ({
    file: `run-accuracy-${value}.json`,
    source: 'run-good.json',
    derive: promptfooAccuracy(value),
  })),
  { file: 'baseline-tolerance-0.02.json', source: 'evals-baseline.json', derive: everyTolerance(0.02) },
  { file: 'run-hand-written.json', source: null, derive: constant('{"accuracy": 1}\n') },
  {
    file: 'run-version-4.json',
    source: 'run-good.json',
    derive: edited((document) => {
      document.results.version = 4;
    }),
  },
  {
    file: 'run-both-shapes.json',
    source: 'run-good.json',
    derive: edited((document) => {
      document.testCases = [];
      document.metricsScores = [];
    }),
  },
  { file: 'run-not-json.json', source: null, derive: constant('accuracy = 1\n') },
  {
    file: 'baseline-misspelt-key.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      document.metrics['agent :: accuracy'] = renamedKey(document.metrics['agent :: accuracy'], 'tolerance', 'tolerence');
    }),
  },
  {
    file: 'baseline-no-cases.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      delete document.cases;
    }),
  },
  {
    file: 'baseline-newer-minor.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      document.spec = '1.1';
    }),
  },
  {
    file: 'baseline-other-major.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      document.spec = '2.0';
    }),
  },
  {
    file: 'baseline-no-metric.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      document.metrics = {};
    }),
  },
  {
    file: 'baseline-hostile-key.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      const hostile = { value: 1, samples: 4, tolerance: 0 };
      document.metrics = {
        'agent :: accuracy': document.metrics['agent :: accuracy'],
        'agent :: bad\n::error::pwned\u001b[31m': hostile,
        'agent :: format': document.metrics['agent :: format'],
      };
    }),
  },
  {
    file: 'run-deeply-nested.json',
    source: 'run-good.json',
    derive: (sourceText) => {
      const document = JSON.parse(sourceText);
      document.results.results[0].testCase.vars = { country: deepPlaceholder };
      const deepArray = '['.repeat(deepNestingDepth) + ']'.repeat(deepNestingDepth);
      return asText(document).replace(`"${deepPlaceholder}"`, deepArray);
    },
  },
  ...promptfooRefusals,
  ...promptfooRecords,
  ...promptfooRounding,
  ...promptfooIdentity,
  ...promptfooInjection,
  ...promptfooSamples,
].map((entry) => ({ tool: 'promptfoo', ...entry }));

const deepevalEntries = [
  {
    file: 'baseline-boundary.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      Object.assign(document.metrics.Accuracy, { value: 0.92, tolerance: 0.02 });
    }),
  },
  ...accuracyValues.map((value) => ({
    file: `run-accuracy-${value}.json`,
    source: 'run-good.json',
    derive: deepevalAccuracy(value),
  })),
  { file: 'baseline-tolerance-0.02.json', source: 'evals-baseline.json', derive: everyTolerance(0.02) },
  {
    file: 'baseline-names-failure-rate.json',
    source: 'evals-baseline.json',
    derive: edited((document) => {
      document.metrics = Object.fromEntries(
        Object.entries({ ...document.metrics, 'Failure rate': { value: 0, samples: 4, tolerance: 0 } }).sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      );
    }),
  },
  {
    file: 'run-conversational.json',
    source: 'run-good.json',
    derive: edited((document) => {
      document.conversationalTestCases = [{}];
    }),
  },
  { file: 'run-sqlite-like.db', source: null, derive: constant('SQLite format 3\u0000') },
  ...deepevalRefusals,
  ...deepevalRecords,
  ...deepevalRounding,
  ...deepevalIdentity,
  ...deepevalSamples,
].map((entry) => ({ tool: 'deepeval', ...entry }));

export const planted = [...promptfooEntries, ...deepevalEntries];
