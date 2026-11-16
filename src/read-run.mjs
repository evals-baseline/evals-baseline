import { caseDigest } from './digest.mjs';
import { collectAssertionLabels, deepevalDirectionRefusal, isVerdict, metricsShownHigherIsBetter, promptfooDirectionRefusal } from './direction.mjs';
import { datum } from './printable.mjs';
import { isQuantisable, listKeys, roundToMillionths } from './quantise.mjs';
import { byKey, compareText, isPlainObject, parseJson, refuse } from './unreadable.mjs';

const wrongField = (name, path, expected) => refuse(name, `${path} is missing or is not ${expected}`);

function objectAt(value, name, path) {
  if (!isPlainObject(value)) {
    throw wrongField(name, path, 'an object');
  }
  return value;
}

function arrayAt(value, name, path) {
  if (!Array.isArray(value)) {
    throw wrongField(name, path, 'an array');
  }
  return value;
}

function stringAt(value, name, path) {
  if (typeof value !== 'string') {
    throw wrongField(name, path, 'a string');
  }
  return value;
}

function numberAt(value, name, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw wrongField(name, path, 'a number');
  }
  return value;
}

function countAt(value, name, path) {
  if (!Number.isInteger(value) || value < 0) {
    throw wrongField(name, path, 'a non-negative integer');
  }
  return value;
}

function describeJsonKind(value) {
  if (Array.isArray(value)) {
    return 'an array';
  }
  if (value === null) {
    return 'null';
  }
  return { string: 'a string', number: 'a number', boolean: 'a boolean' }[typeof value];
}

function describeTopLevel(document) {
  if (!isPlainObject(document)) {
    return `the JSON value is ${describeJsonKind(document)}`;
  }
  const keys = Object.keys(document).sort(compareText);
  return `top-level keys: ${keys.length === 0 ? 'none' : listKeys(keys)}`;
}

function detectTool(document, name) {
  const isPromptfoo = isPlainObject(document) && isPlainObject(document.results) && typeof document.results.version === 'number';
  const isDeepeval = isPlainObject(document) && Array.isArray(document.testCases) && Array.isArray(document.metricsScores);
  if (isPromptfoo && isDeepeval) {
    throw refuse(name, `matches both a promptfoo results file and a DeepEval test run; ${describeTopLevel(document)}`);
  }
  if (isPromptfoo) {
    return 'promptfoo';
  }
  if (isDeepeval) {
    return 'deepeval';
  }
  if (isPlainObject(document) && isPlainObject(document.testRunData)) {
    throw refuse(
      name,
      'this is DeepEval .latest_test_run.json, which wraps the run in testRunData; read .latest_run_full.json or a test_run_*.json file',
    );
  }
  throw refuse(name, `neither a promptfoo results file nor a DeepEval test run; ${describeTopLevel(document)}`);
}

function assertUniqueKeys(metrics, name) {
  const seen = new Set();
  for (const { key } of metrics) {
    if (seen.has(key)) {
      throw refuse(name, `the metric key ${datum(key)} is produced twice`);
    }
    seen.add(key);
  }
}

function readPromptfoo(document, name) {
  const { results } = document;
  if (results.version !== 3) {
    throw refuse(name, `promptfoo results version ${results.version} is not read; this implementation reads version 3`);
  }
  const prompts = arrayAt(results.prompts, name, 'results.prompts');
  const tests = arrayAt(results.results, name, 'results.results');
  const assertionLabels = collectAssertionLabels(tests);
  const noAssertionsListed = tests.length > 0 && assertionLabels.size === 0;
  const labels = new Set();
  const metrics = [];
  const refused = [];
  const errors = [];

  prompts.forEach((prompt, index) => {
    const promptPath = `results.prompts[${index}]`;
    objectAt(prompt, name, promptPath);
    const label = stringAt(prompt.provider, name, `${promptPath}.provider`);
    if (labels.has(label)) {
      throw refuse(name, `two prompts share the provider label ${datum(label)}; this implementation reads one prompt per provider`);
    }
    labels.add(label);
    const statistics = objectAt(prompt.metrics, name, `${promptPath}.metrics`);
    const erroredTests = numberAt(statistics.testErrorCount, name, `${promptPath}.metrics.testErrorCount`);
    const sums = objectAt(statistics.namedScores, name, `${promptPath}.metrics.namedScores`);
    const counts = objectAt(statistics.namedScoresCount, name, `${promptPath}.metrics.namedScoresCount`);
    const weights =
      statistics.namedScoreWeights === undefined ? {} : objectAt(statistics.namedScoreWeights, name, `${promptPath}.metrics.namedScoreWeights`);

    for (const metricName of Object.keys(counts)) {
      const key = `${label} :: ${metricName}`;
      const samples = countAt(counts[metricName], name, `${promptPath}.metrics.namedScoresCount[${datum(metricName)}]`);
      if (samples === 0) {
        continue;
      }
      const sum = numberAt(sums[metricName], name, `${promptPath}.metrics.namedScores[${datum(metricName)}]`);
      const weighted = Object.hasOwn(weights, metricName);
      const weight = weights[metricName];
      if (weighted && !(Number.isFinite(weight) && weight > 0)) {
        refused.push({ key, reason: `promptfoo's weight total for it is ${datum(weight)}, which is not a positive number` });
        continue;
      }
      const unknownDirection = promptfooDirectionRefusal(assertionLabels.get(metricName), noAssertionsListed);
      if (unknownDirection !== undefined) {
        refused.push({ key, reason: unknownDirection });
        continue;
      }
      const value = roundToMillionths(sum / (weighted ? weight : samples));
      if (!isQuantisable(value)) {
        throw refuse(name, `the value of ${datum(key)} is out of range`);
      }
      metrics.push({ key, value, samples });
    }
    if (erroredTests > 0) {
      errors.push({ key: label, text: `${datum(label)}: ${erroredTests} errored test(s) in this run (promptfoo testErrorCount)` });
    }
  });

  const variablesByTest = new Map();
  tests.forEach((result, index) => {
    const resultPath = `results.results[${index}]`;
    objectAt(result, name, resultPath);
    const testIndex = numberAt(result.testIdx, name, `${resultPath}.testIdx`);
    const testCase = objectAt(result.testCase, name, `${resultPath}.testCase`);
    if (!variablesByTest.has(testIndex)) {
      variablesByTest.set(testIndex, testCase.vars === undefined ? {} : objectAt(testCase.vars, name, `${resultPath}.testCase.vars`));
    }
  });

  const rawVersion = isPlainObject(document.metadata) ? document.metadata.promptfooVersion : undefined;
  assertUniqueKeys([...metrics, ...refused], name);
  return {
    name,
    tool: 'promptfoo',
    toolVersion: rawVersion === undefined || rawVersion === null ? null : stringAt(rawVersion, name, 'metadata.promptfooVersion'),
    shape: 'promptfoo-results-3',
    cases: { count: variablesByTest.size, digest: caseDigest([...variablesByTest.values()]) },
    metrics: metrics.sort(byKey),
    refused: refused.sort(byKey),
    errors: errors.sort(byKey).map((error) => error.text),
  };
}

function findContradictions(testCases) {
  const contradictions = new Map();
  for (const testCase of testCases) {
    for (const sample of testCase.metricsData ?? []) {
      if (!isVerdict(sample) || sample.success === sample.score >= sample.threshold) {
        continue;
      }
      const known = contradictions.get(sample.name);
      if (known === undefined) {
        contradictions.set(sample.name, { count: 1, first: sample });
      } else {
        known.count += 1;
      }
    }
  }
  return contradictions;
}

function readDeepeval(document, name) {
  if (document.conversationalTestCases !== undefined) {
    const conversational = arrayAt(document.conversationalTestCases, name, 'conversationalTestCases');
    if (conversational.length > 0) {
      throw refuse(name, 'conversationalTestCases is not empty; this implementation does not read multi-turn runs');
    }
  }
  const identities = document.testCases.map((testCase, index) => {
    const testPath = `testCases[${index}]`;
    objectAt(testCase, name, testPath);
    const input = stringAt(testCase.input, name, `${testPath}.input`);
    const expectedOutput = testCase.expectedOutput ?? null;
    if (expectedOutput !== null) {
      stringAt(expectedOutput, name, `${testPath}.expectedOutput`);
    }
    if (testCase.metricsData !== undefined && !Array.isArray(testCase.metricsData)) {
      throw refuse(name, `${testPath}.metricsData is not an array`);
    }
    return { input, expectedOutput };
  });

  const contradictions = findContradictions(document.testCases);
  const shownHigherIsBetter = metricsShownHigherIsBetter(document.testCases);
  const seen = new Set();
  const metrics = [];
  const refused = [];
  const errors = [];
  document.metricsScores.forEach((entry, index) => {
    const scorePath = `metricsScores[${index}]`;
    objectAt(entry, name, scorePath);
    const key = stringAt(entry.metric, name, `${scorePath}.metric`);
    if (seen.has(key)) {
      throw refuse(name, `metricsScores names the metric ${datum(key)} twice`);
    }
    seen.add(key);
    const scores = arrayAt(entry.scores, name, `${scorePath}.scores`).map((score, position) =>
      numberAt(score, name, `${scorePath}.scores[${position}]`),
    );
    const erroredSamples = countAt(entry.errors, name, `${scorePath}.errors`);
    if (erroredSamples > 0) {
      errors.push({
        key,
        text: `${datum(key)}: ${erroredSamples} sample(s) DeepEval counted as errors, because the metric raised an error or returned no verdict (success is null)`,
      });
    }
    if (scores.length === 0) {
      return;
    }
    const contradiction = contradictions.get(key);
    if (contradiction !== undefined) {
      const { success, score, threshold } = contradiction.first;
      refused.push({
        key,
        reason: `DeepEval's own verdicts contradict higher-is-better in ${contradiction.count} sample(s) (success=${success}, score=${score}, threshold=${threshold}); this implementation reads higher-is-better metrics only`,
      });
      return;
    }
    const unknownDirection = deepevalDirectionRefusal(key, shownHigherIsBetter);
    if (unknownDirection !== undefined) {
      refused.push({ key, reason: unknownDirection });
      return;
    }
    const value = roundToMillionths(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    if (!isQuantisable(value)) {
      throw refuse(name, `the value of ${datum(key)} is out of range`);
    }
    metrics.push({ key, value, samples: scores.length });
  });

  return {
    name,
    tool: 'deepeval',
    toolVersion: null,
    shape: 'deepeval-test-run',
    cases: { count: identities.length, digest: caseDigest(identities) },
    metrics: metrics.sort(byKey),
    refused: refused.sort(byKey),
    errors: errors.sort(byKey).map((error) => error.text),
  };
}

export function readRun(text, nameForMessages) {
  const document = parseJson(text, nameForMessages);
  return detectTool(document, nameForMessages) === 'promptfoo'
    ? readPromptfoo(document, nameForMessages)
    : readDeepeval(document, nameForMessages);
}
