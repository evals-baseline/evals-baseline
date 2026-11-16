export const REQUIRED_STEPS = [
  'npm ci',
  'npm test',
  'node build/build.mjs --check',
  'node build/parity.mjs',
  'node build/guards.mjs',
];

const SHA = /^[0-9a-f]{40}$/;
const KEY_LIKE_NAME = /(?:KEY|TOKEN|SECRET|PASSWORD)/i;

const indentOf = (line) => line.length - line.trimStart().length;

function blockUnder(lines, headerIndex) {
  const header = indentOf(lines[headerIndex]);
  const block = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '') continue;
    if (indentOf(lines[index]) <= header) break;
    block.push(lines[index]);
  }
  return block;
}

const blocksNamed = (lines, name) =>
  lines.flatMap((line, index) => (line.trim() === `${name}:` ? [blockUnder(lines, index).map((member) => member.trim())] : []));

function triggerProblems(lines) {
  const header = lines.findIndex((line) => line === 'on:');
  const triggers = header === -1 ? [] : blockUnder(lines, header).map((line) => line.trim().replace(/:.*$/, ''));
  return [
    triggers.includes('push') ? null : 'the workflow does not run on push',
    triggers.includes('pull_request') ? null : 'the workflow does not run on pull_request',
    triggers.includes('pull_request_target') ? 'the workflow runs on pull_request_target' : null,
  ];
}

function permissionProblems(lines) {
  const inline = lines
    .map((line) => line.trim())
    .filter((line) => /^permissions:\s*\S/.test(line))
    .map((line) => `permissions grant more than contents: read: ${line}`);
  const blocks = blocksNamed(lines, 'permissions')
    .flat()
    .filter((member) => member !== 'contents: read')
    .map((member) => `permissions grant more than contents: read: ${member}`);
  return [...inline, ...blocks];
}

function secretProblems(lines) {
  const reads = lines.filter((line) => /secrets[.[]/.test(line)).map((line) => `the workflow reads a secret: ${line.trim()}`);
  const named = blocksNamed(lines, 'env')
    .flat()
    .filter((member) => KEY_LIKE_NAME.test(member.replace(/:.*$/, '')))
    .map((member) => `the workflow sets a variable named like a key: ${member}`);
  const tokens = lines
    .map((line) => line.trim())
    .filter((line) => /^(?:github-)?token:/.test(line))
    .map((line) => `the workflow passes a token to an action: ${line}`);
  return [...reads, ...named, ...tokens];
}

function pinProblems(lines) {
  return lines
    .map((line) => /^\s*(?:- )?uses:\s*(\S+)\s*$/.exec(line))
    .filter((match) => match !== null)
    .filter(([, reference]) => !SHA.test(reference.split('@')[1] ?? ''))
    .map(([, reference]) => `uses is not pinned to a full commit SHA: ${reference}`);
}

function stepProblems(lines) {
  const commands = lines.map((line) => /^\s*(?:- )?run:\s*(.+?)\s*$/.exec(line)).filter((match) => match !== null).map(([, command]) => command);
  const missing = REQUIRED_STEPS.filter((step) => !commands.includes(step)).map((step) => `no step runs ${step}`);
  if (missing.length > 0) return missing;
  const inOrder = commands.length === REQUIRED_STEPS.length && commands.every((command, index) => command === REQUIRED_STEPS[index]);
  return inOrder ? [] : [`the steps run in the order ${commands.join(', ')}, not the order of the specification`];
}

export function workflowProblems(text) {
  const lines = text.split('\n');
  return [
    ...triggerProblems(lines).filter((problem) => problem !== null),
    ...permissionProblems(lines),
    ...secretProblems(lines),
    ...pinProblems(lines),
    ...stepProblems(lines),
  ];
}
