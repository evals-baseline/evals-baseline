import { asAsciiText, editedAscii } from './planted-edits.mjs';

const numberForms = [
  ['one-point-zero', '1.0'],
  ['small-exponent', '1e-7'],
  ['negative-zero', '-0'],
  ['large-exponent', '1e21'],
];

const varsPlaceholder = (index) => `__VARS_${index}__`;

const withVarsTexts = (varsTexts, edit = () => {}) => (sourceText) => {
  const document = JSON.parse(sourceText);
  document.results.results = document.results.results.slice(0, varsTexts.length);
  if (document.results.results.length !== varsTexts.length) {
    throw new Error(`the source run holds fewer than ${varsTexts.length} results`);
  }
  document.results.results.forEach((result, index) => {
    result.vars = varsPlaceholder(index);
    result.testCase.vars = varsPlaceholder(index);
  });
  edit(document);
  return varsTexts.reduce((text, varsText, index) => text.replaceAll(`"${varsPlaceholder(index)}"`, () => varsText), asAsciiText(document));
};

const deepevalOneCase = (edit) =>
  editedAscii((document) => {
    document.testCases = [{ ...document.testCases[0], input: 'a' }];
    edit(document.testCases[0]);
  });

export const promptfooIdentity = [
  { file: 'run-vars-code-unit-key-order.json', source: 'run-good.json', derive: withVarsTexts(['{"\u{1F600}": 1, "\uFF5E": 2}']) },
  {
    file: 'run-vars-code-unit-case-order.json',
    source: 'run-good.json',
    derive: withVarsTexts(['{"q": "a\u{1F600}"}', '{"q": "a\uFF5E"}']),
  },
  { file: 'run-vars-code-unit-pair.json', source: 'run-good.json', derive: withVarsTexts(['{"v": "\u{1F600}"}', '{"v": "\uFF21"}']) },
  ...numberForms.map(([name, text]) => ({
    file: `run-vars-number-${name}.json`,
    source: 'run-good.json',
    derive: withVarsTexts([`{"n": ${text}}`]),
  })),
  { file: 'run-vars-nested.json', source: 'run-good.json', derive: withVarsTexts(['{"v": [{"b": 2, "a": 1}, [3, null], "s"]}']) },
  {
    file: 'run-repeated-test-index.json',
    source: 'run-good.json',
    derive: withVarsTexts(['{"country": "France"}', '{"country": "Japan"}'], (document) => {
      document.results.results[1].testIdx = 0;
    }),
  },
];

export const deepevalIdentity = [
  {
    file: 'run-expected-output-absent.json',
    source: 'run-good.json',
    derive: deepevalOneCase((testCase) => {
      delete testCase.expectedOutput;
    }),
  },
  {
    file: 'run-expected-output-null.json',
    source: 'run-good.json',
    derive: deepevalOneCase((testCase) => {
      testCase.expectedOutput = null;
    }),
  },
  {
    file: 'run-expected-output-empty.json',
    source: 'run-good.json',
    derive: deepevalOneCase((testCase) => {
      testCase.expectedOutput = '';
    }),
  },
];
