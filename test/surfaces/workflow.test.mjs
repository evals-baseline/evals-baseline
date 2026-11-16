import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { REQUIRED_STEPS, workflowProblems } from './workflow-rules.mjs';
import { ROOT } from './support.mjs';

const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');

function planted(from, to) {
  const count = workflow.split(from).length - 1;
  assert.equal(count, 1, `${JSON.stringify(from)} occurs ${count} times in ci.yml, so the specimen would plant nothing or too much`);
  return workflow.replace(from, to);
}

const withoutLine = (line) => planted(`${line}\n`, '');

test('the CI workflow of this repository has no problem', () => {
  assert.deepEqual(workflowProblems(workflow), []);
});

test('the CI workflow runs the install, the tests, the rebuild check, the parity run and the static guards, in that order', () => {
  assert.deepEqual(REQUIRED_STEPS, ['npm ci', 'npm test', 'node build/build.mjs --check', 'node build/parity.mjs', 'node build/guards.mjs']);
});

for (const step of REQUIRED_STEPS) {
  test(`goes red on a workflow with the step "${step}" removed, and names it`, () => {
    const lines = workflow.split('\n');
    const at = lines.findIndex((line) => line.trim() === `run: ${step}`);
    assert.notEqual(at, -1, `${step} is not a run step of ci.yml`);
    const without = [...lines.slice(0, at - 1), ...lines.slice(at + 1)].join('\n');
    assert.deepEqual(workflowProblems(without), [`no step runs ${step}`]);
  });
}

test('goes red on a workflow whose parity step comes after the static guards', () => {
  const parity = '        run: node build/parity.mjs';
  const guards = '        run: node build/guards.mjs';
  const swapped = workflow.replace(parity, '@@').replace(guards, parity).replace('@@', guards);
  assert.notEqual(swapped, workflow);
  assert.deepEqual(workflowProblems(swapped), [
    'the steps run in the order npm ci, npm test, node build/build.mjs --check, node build/guards.mjs, node build/parity.mjs, not the order of the specification',
  ]);
});

test('goes red on a step that runs something else as well', () => {
  const extra = planted('      - name: Static guards\n', '      - name: Publish\n        run: npm publish\n      - name: Static guards\n');
  assert.deepEqual(workflowProblems(extra), ['the steps run in the order npm ci, npm test, node build/build.mjs --check, node build/parity.mjs, npm publish, node build/guards.mjs, not the order of the specification']);
});

test('goes red on a workflow that does not run on push', () => {
  assert.deepEqual(workflowProblems(withoutLine('  push:')), ['the workflow does not run on push']);
});

test('goes red on a workflow that does not run on pull_request', () => {
  assert.deepEqual(workflowProblems(withoutLine('  pull_request:')), ['the workflow does not run on pull_request']);
});

test('goes red on a workflow that runs on pull_request_target, which hands a pull request the repository secrets', () => {
  assert.deepEqual(workflowProblems(planted('  pull_request:\n', '  pull_request:\n  pull_request_target:\n')), ['the workflow runs on pull_request_target']);
});

for (const permission of ['write-all', 'contents: write', 'pull-requests: read']) {
  test(`goes red on a workflow that grants more than contents: read (${permission})`, () => {
    const text =
      permission === 'write-all'
        ? planted('permissions:\n  contents: read\n', 'permissions: write-all\n')
        : planted('permissions:\n  contents: read\n', `permissions:\n  contents: read\n  ${permission}\n`).replace('  contents: read\n  contents: write', '  contents: write');
    const problems = workflowProblems(text);
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0], /^permissions grant more than contents: read: /);
  });
}

test('goes red on a workflow that reads a secret', () => {
  const text = planted('        run: npm ci\n', '        run: npm ci\n        env:\n          NPM_CONFIG: ${{ secrets.NPM_CONFIG }}\n');
  const problems = workflowProblems(text);
  assert.ok(problems.some((problem) => problem.startsWith('the workflow reads a secret: ')), problems.join('\n'));
});

for (const name of ['OPENAI_API_KEY', 'NPM_TOKEN', 'DB_PASSWORD', 'CLIENT_SECRET']) {
  test(`goes red on a workflow that sets a variable named ${name}`, () => {
    const text = planted('        run: npm test\n', `        run: npm test\n        env:\n          ${name}: value\n`);
    assert.deepEqual(workflowProblems(text), [`the workflow sets a variable named like a key: ${name}: value`]);
  });
}

test('goes red on a step that passes a token to an action', () => {
  const text = planted('          persist-credentials: false\n', '          persist-credentials: false\n          token: value\n');
  assert.deepEqual(workflowProblems(text), ['the workflow passes a token to an action: token: value']);
});

for (const reference of ['actions/checkout@v7', 'actions/checkout@main', 'actions/checkout@3d3c42e', 'actions/checkout']) {
  test(`goes red on an action referenced as ${reference}, because only a full commit SHA is immutable`, () => {
    const text = planted('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1', reference);
    assert.deepEqual(workflowProblems(text), [`uses is not pinned to a full commit SHA: ${reference}`]);
  });
}
