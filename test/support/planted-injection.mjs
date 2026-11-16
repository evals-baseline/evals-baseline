import { hiddenSentence, instruction } from './payloads.mjs';
import { editedAscii } from './planted-edits.mjs';

const quoteAndBackslash = `x" is fine. ${instruction}. "y\\`;

const withMetricNamed = (name) =>
  editedAscii((document) => {
    const { namedScores, namedScoresCount } = document.results.prompts[0].metrics;
    namedScores[name] = 4;
    namedScoresCount[name] = 4;
  });

export const promptfooInjection = [
  { file: 'run-injection-hidden-sentence.json', source: 'run-good.json', derive: withMetricNamed(hiddenSentence) },
  { file: 'run-injection-plain-sentence.json', source: 'run-good.json', derive: withMetricNamed(instruction) },
  { file: 'run-injection-quote-and-backslash.json', source: 'run-good.json', derive: withMetricNamed(quoteAndBackslash) },
];
