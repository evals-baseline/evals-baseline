import { datum } from './printable.mjs';
import { compareText, isPlainObject } from './unreadable.mjs';

const REVERSED_IN_DEEPEVAL_4_2_0 = new Set(['Bias', 'Hallucination', 'Misuse', 'Toxicity']);

const DEEPEVAL_UNKNOWN_DIRECTION =
  "DeepEval 4.2.0 reversed this metric's score, and no verdict in this file shows which way it runs; run it again on DeepEval 4.2.0 or later with strict mode off and the default threshold";

export function isVerdict(sample) {
  return (
    isPlainObject(sample) &&
    typeof sample.name === 'string' &&
    typeof sample.score === 'number' &&
    typeof sample.threshold === 'number' &&
    typeof sample.success === 'boolean'
  );
}

function showsHigherIsBetter(sample) {
  if (sample.score !== sample.threshold) {
    return sample.success === sample.score > sample.threshold;
  }
  return sample.strictMode === true && sample.threshold === 1 && sample.success === true;
}

export function metricsShownHigherIsBetter(testCases) {
  const shown = new Set();
  for (const testCase of testCases) {
    for (const sample of testCase.metricsData ?? []) {
      if (isVerdict(sample) && showsHigherIsBetter(sample)) {
        shown.add(sample.name);
      }
    }
  }
  return shown;
}

export function deepevalDirectionRefusal(metricName, shownHigherIsBetter) {
  return REVERSED_IN_DEEPEVAL_4_2_0.has(metricName) && !shownHigherIsBetter.has(metricName) ? DEEPEVAL_UNKNOWN_DIRECTION : undefined;
}

const BASE_ASSERTION_TYPES = [
  'agent-rubric', 'answer-relevance', 'bleu', 'classifier', 'contains', 'contains-all', 'contains-any', 'contains-html',
  'contains-json', 'contains-sql', 'contains-xml', 'context-faithfulness', 'context-recall', 'context-relevance',
  'conversation-relevance', 'cost', 'equals', 'factuality', 'finish-reason', 'g-eval', 'gleu', 'guardrails', 'icontains',
  'icontains-all', 'icontains-any', 'is-html', 'is-json', 'is-refusal', 'is-sql', 'is-valid-function-call',
  'is-valid-openai-function-call', 'is-valid-openai-tools-call', 'is-xml', 'javascript', 'latency', 'levenshtein',
  'llm-rubric', 'meteor', 'model-graded-closedqa', 'model-graded-factuality', 'moderation', 'perplexity', 'perplexity-score',
  'pi', 'python', 'regex', 'rouge-l', 'rouge-n', 'rouge-s', 'ruby', 'search-rubric', 'similar', 'similar:cosine',
  'similar:dot', 'similar:euclidean', 'skill-used', 'starts-with', 'tool-call-f1', 'trace-error-spans', 'trace-span-count',
  'trace-span-duration', 'trajectory:goal-success', 'trajectory:step-count', 'trajectory:tool-args-match',
  'trajectory:tool-sequence', 'trajectory:tool-used', 'webhook', 'word-count',
];
const HIGHER_IS_BETTER_TYPES = new Set(BASE_ASSERTION_TYPES);
const RAW_COST = 'cost with no threshold';
const LOWER_IS_BETTER_LABELS = new Set([RAW_COST, 'not-javascript', 'not-python', 'not-ruby', 'not-tool-call-f1']);
const NOT_PREFIX = 'not-';
const COST_HINT = '. To compare cost, give the cost assertion a threshold so that it scores pass or fail';
const NO_ASSERTION =
  'the file lists no assertion for any metric, so which way its scores run cannot be established; this implementation reads higher-is-better metrics only';

const withoutNot = (type) => (type.startsWith(NOT_PREFIX) ? type.slice(NOT_PREFIX.length) : type);
const listed = (labels) => labels.map(datum).join(', ');

function assertionLabel({ type, threshold }) {
  return withoutNot(type) === 'cost' && typeof threshold !== 'number' ? RAW_COST : type;
}

function directionOfLabel(label) {
  if (LOWER_IS_BETTER_LABELS.has(label)) {
    return 'lower';
  }
  return HIGHER_IS_BETTER_TYPES.has(withoutNot(label)) ? 'higher' : 'unknown';
}

function labelsOf(assertion) {
  const labels = [];
  const pending = [assertion];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current.type === 'assert-set' && Array.isArray(current.assert)) {
      for (const child of current.assert) {
        if (isPlainObject(child)) {
          pending.push(child);
        }
      }
    } else if (typeof current.type === 'string') {
      labels.push(assertionLabel(current));
    }
  }
  return labels;
}

export function collectAssertionLabels(results) {
  const labelsByMetric = new Map();
  for (const result of results) {
    const components = isPlainObject(result) && isPlainObject(result.gradingResult) ? result.gradingResult.componentResults : undefined;
    for (const component of Array.isArray(components) ? components : []) {
      const assertion = isPlainObject(component) ? component.assertion : undefined;
      if (!isPlainObject(assertion) || typeof assertion.metric !== 'string') {
        continue;
      }
      const labels = labelsByMetric.get(assertion.metric) ?? new Set();
      labelsOf(assertion).forEach((label) => labels.add(label));
      labelsByMetric.set(assertion.metric, labels);
    }
  }
  return labelsByMetric;
}

export function promptfooDirectionRefusal(labelSet = new Set(), noAssertionsListed = false) {
  const labels = [...labelSet].sort(compareText);
  if (labels.length === 0) {
    return noAssertionsListed ? NO_ASSERTION : undefined;
  }
  const directions = labels.map(directionOfLabel);
  const unknown = labels[directions.indexOf('unknown')];
  const lower = labels.filter((label, index) => directions[index] === 'lower');
  if (directions.includes('unknown')) {
    return `promptfoo assertion type ${datum(unknown)} feeds it, and this implementation has not checked which way that score runs; update evals-baseline, or use an assertion type it knows`;
  }
  if (lower.length === 0) {
    return undefined;
  }
  if (lower.length < labels.length) {
    return `promptfoo feeds it from assertions that disagree on which way a score runs (${listed(labels)}); give each kind its own metric name`;
  }
  return `promptfoo scores it as lower-is-better (${listed(lower)}); this implementation reads higher-is-better metrics only${lower.includes(RAW_COST) ? COST_HINT : ''}`;
}
