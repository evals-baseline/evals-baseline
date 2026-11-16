import { datum } from './printable.mjs';
import { count, formatQuantised, listKeys, quantise } from './quantise.mjs';
import { refusalSentence } from './unreadable.mjs';

const valueOverSamples = ({ value, samples }) => `${formatQuantised(value)} over ${count(samples, 'sample')}`;

const samplesHeld = (baseline, run) => `the baseline holds ${count(baseline.samples, 'sample')} and this run holds ${run.samples}`;

const smallestMeasuredNoiseFloor = quantise(0.0084);

const unsetToleranceSentence = ({ baseline, run, drop }) =>
  [
    `${valueOverSamples(run)} is below the baseline ${valueOverSamples(baseline)} by ${formatQuantised(drop)}.`,
    'The tolerance is 0, so every fall is reported, and a fall this small is one that two runs of unchanged code can show.',
    'The tolerance is probably unset; the model is probably not worse.',
    'Rerun the suite with nothing changed, see how far each metric moves, and set this tolerance in the baseline to match',
    '(see the README section on setting tolerances from your own noise).',
    'If 0 is on purpose, treat this as a real fall.',
  ].join(' ');

const failureWord = (failure) => (failure === 'ENOENT' ? 'not found' : failure);

export const describeCannotRead = (file, failure) => `cannot read ${datum(file)}: ${failureWord(failure)}`;

const unreadableFileSentences = {
  'cannot-read': ({ file, failure }) => describeCannotRead(file, failure),
  refused: ({ file, problem }) => refusalSentence(file, problem),
  'other-tool': ({ file, baseline, run }) =>
    `${datum(file)}: the baseline was recorded from ${baseline.tool} (${baseline.shape}) and this file is ${run.tool} (${run.shape})`,
};

const unreadableFileSentence = (finding) => unreadableFileSentences[finding.cause](finding);

const findingSentences = {
  'missing-metric': ({ baseline }) => `the baseline names it (${valueOverSamples(baseline)}) and this run has no such metric`,
  'unreadable-metric': ({ reason }) => reason,
  'below-baseline': ({ baseline, run, drop }) =>
    `${valueOverSamples(run)} is below the baseline ${valueOverSamples(baseline)} by ${formatQuantised(drop)}, more than the tolerance ${formatQuantised(baseline.tolerance)}`,
  'below-baseline-inside-noise': unsetToleranceSentence,
  'sample-count': ({ baseline, run }) => samplesHeld(baseline, run),
  'cases-changed': ({ baseline, run }) =>
    `the baseline was recorded from ${count(baseline.count, 'case')} (digest ${baseline.digest}); this run holds ${count(run.count, 'case')} (digest ${run.digest}); re-record if the change is intended`,
  'no-baseline': ({ file }) => `no baseline at ${datum(file)}; nothing was compared; record one with: evals-baseline record <run-file>`,
  'bad-baseline': unreadableFileSentence,
  'bad-run': unreadableFileSentence,
  'internal-error': ({ message }) => datum(message),
};

const noteSentences = {
  'metrics-only-in-run': ({ keys }) => `${keys.length} metric(s) only in this run, not compared (rule 3): ${listKeys(keys)}`,
  'more-samples': ({ key, baseline, run }) => `${datum(key)}: ${samplesHeld(baseline, run)}; more samples than the baseline are never a finding`,
  'run-error': ({ text }) => text,
  'refused-metric': ({ key, reason }) => `${datum(key)} cannot be read: ${reason}`,
  'tool-version-changed': ({ tool, baseline, run }) =>
    `the baseline was recorded by ${tool} ${datum(baseline.toolVersion)}; this run was written by ${datum(run.toolVersion)}`,
};

const findingHead = ({ id, key }) => (key === undefined ? id : `${id} ${datum(key)}`);

const isFallInsideNoise = ({ id, baseline, drop }) => id === 'below-baseline' && baseline.tolerance === 0 && drop < smallestMeasuredNoiseFloor;

const sentenceKey = (finding) => (isFallInsideNoise(finding) ? 'below-baseline-inside-noise' : finding.id);

export const describeFinding = (finding) => `${findingHead(finding)}: ${findingSentences[sentenceKey(finding)](finding)}`;

export const describeNote = (note) => noteSentences[note.kind](note);
