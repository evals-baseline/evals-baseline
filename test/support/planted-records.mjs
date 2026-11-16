import { deepevalMetric, editedAscii } from './planted-edits.mjs';

export const promptfooRecords = [
  {
    file: 'run-version-bump.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.metadata.promptfooVersion = '0.126.0';
    }),
  },
  {
    file: 'run-no-cases.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.results.results = [];
    }),
  },
];

export const deepevalRecords = [
  {
    file: 'run-no-cases.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.testCases = [];
    }),
  },
  {
    file: 'run-integer-like-names.json',
    source: 'run-good.json',
    derive: editedAscii((document) => {
      document.metricsScores = ['10', '2', '1', '01', '-1', 'a'].map((name) => deepevalMetric(name, [1, 1, 1, 1]));
    }),
  },
];
