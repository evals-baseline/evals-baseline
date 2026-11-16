export class ActionMetadataRefusal extends Error {}

const INDENT_WIDTH = 2;
const MAPPING_LINE = /^( *)([A-Za-z0-9_-]+):(?: +(.*?))?\s*$/;
const ACTION_INPUTS = ['run-file', 'baseline', 'strict'];

const refuseLine = (number, reason) => new ActionMetadataRefusal(`action.yml: line ${number}: ${reason}`);

function scalar(text) {
  const quoted = /^(['"])(.*)\1$/.exec(text);
  return quoted ? quoted[2] : text;
}

function parseLine(line, number) {
  if (/^ *\t/.test(line)) throw refuseLine(number, 'a tab in the indent');
  const match = MAPPING_LINE.exec(line);
  if (!match) throw refuseLine(number, 'not a key: value line (lists and comments are not read)');
  const [, spaces, key, value] = match;
  if (spaces.length % INDENT_WIDTH !== 0) throw refuseLine(number, `the indent of ${spaces.length} is not a multiple of ${INDENT_WIDTH}`);
  return { indent: spaces.length, key, value };
}

export function parseActionYml(text) {
  const root = {};
  const levels = [{ indent: 0, map: root }];
  let opener = null;
  text.split('\n').forEach((line, index) => {
    if (line.trim() === '') return;
    const number = index + 1;
    const { indent, key, value } = parseLine(line, number);
    if (opener !== null && indent === opener.indent + INDENT_WIDTH) {
      const child = {};
      opener.map[opener.key] = child;
      levels.push({ indent, map: child });
    }
    opener = null;
    while (levels.length > 1 && indent < levels.at(-1).indent) levels.pop();
    const level = levels.at(-1);
    if (indent !== level.indent) throw refuseLine(number, 'unexpected indent');
    if (key in level.map) throw refuseLine(number, `the key ${key} appears twice`);
    level.map[key] = value === undefined ? '' : scalar(value);
    if (value === undefined) opener = { key, map: level.map, indent };
  });
  return root;
}

export function actionDefaults(text) {
  const { inputs } = parseActionYml(text);
  if (inputs === undefined || typeof inputs !== 'object') {
    throw new ActionMetadataRefusal('action.yml declares no inputs');
  }
  const defaults = {};
  for (const name of ACTION_INPUTS) {
    if (typeof inputs[name] !== 'object') throw new ActionMetadataRefusal(`action.yml declares no input named ${name}`);
    if (inputs[name].default !== undefined) defaults[name] = inputs[name].default;
  }
  return defaults;
}
