import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { specificationVersion } from '../../src/read-baseline.mjs';
import { SOURCE_SET } from '../../build/lib/layout.mjs';
import {
  CITATION,
  COMMIT_PLACEHOLDER,
  COUNTS_LINE,
  LEAVING_RULE,
  ONE_LINE_ANSWER,
  REFUSAL_HEADING,
  REFUSED,
  SPECIFICATION_ADDRESS,
  docProblems,
} from './doc-rules.mjs';
import { ROOT } from './support.mjs';

const read = (name) => readFileSync(join(ROOT, name), 'utf8');

const FINDING_ID = /(?:\bid: |\bkeyed\()'([a-z]+(?:-[a-z]+)+)'/g;
const printedFindingIds = () =>
  [...new Set(SOURCE_SET.flatMap((name) => [...read(`src/${name}.mjs`).matchAll(FINDING_ID)].map(([, id]) => id)))].sort();

const real = {
  readme: read('README.md'),
  contributing: read('CONTRIBUTING.md'),
  security: read('SECURITY.md'),
  actionYml: read('action.yml'),
  packageJson: read('package.json'),
  findingIds: printedFindingIds(),
};

const manifest = JSON.parse(real.packageJson);
const withManifest = (changed) => ({ ...real, packageJson: JSON.stringify(changed) });
const withoutField = (field) => withManifest(Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== field)));

function planted(document, from, to) {
  const count = real[document].split(from).length - 1;
  assert.equal(count, 1, `${JSON.stringify(from)} occurs ${count} times in ${document}, so the specimen would plant nothing or too much`);
  return { ...real, [document]: real[document].replace(from, to) };
}

const everywhere = (document, from, to) => {
  assert.ok(real[document].includes(from), `${JSON.stringify(from)} is not in ${document}, so the specimen would plant nothing`);
  return { ...real, [document]: real[document].split(from).join(to) };
};

const COMMIT_REFERENCE = `(?:${COMMIT_PLACEHOLDER}|[0-9a-f]{40})`;

const repinned = (before, after, to) => {
  const pattern = new RegExp(`${before}${COMMIT_REFERENCE}${after}`, 'g');
  assert.ok(real.readme.search(pattern) !== -1, `${pattern} is not in the README, so the specimen would plant nothing`);
  return { ...real, readme: real.readme.replace(pattern, () => `${before}${to}${after}`) };
};

const without = (document, text) => planted(document, text, '');
const appended = (document, text) => ({ ...real, [document]: `${real[document]}\n${text}\n` });
const prepended = (document, text) => ({ ...real, [document]: `${text}\n\n${real[document]}` });
const lineStarting = (document, prefix) => {
  const found = real[document].split('\n').filter((line) => line.startsWith(prefix));
  assert.equal(found.length, 1, `${found.length} lines of ${document} start with ${JSON.stringify(prefix)}`);
  return found[0];
};
const withFence = (lines) => appended('readme', `\`\`\`text\n${lines.join('\n')}\n\`\`\``);

const BANNER_LINE = 'evals-baseline 1.0.0 (specification 1.0) check evals-baseline.json: promptfoo 0.125.1, 2 metrics, 4 cases';
const BARE_PROBLEM = 'the README shows evals-baseline without npx, which is not on the PATH after npm install --save-dev:';
const importable = (field) =>
  `package.json declares ${field}, which makes the package importable: its three surfaces are the command, the copied file and the Action`;

test('the README, the contributing file, the security policy, action.yml and package.json of this repository have no problem', () => {
  assert.deepEqual(docProblems(real), []);
});

test('the source prints the nine finding ids that the counts line promises, so the README table is checked against a real list', () => {
  assert.deepEqual(real.findingIds, [
    'bad-baseline',
    'bad-run',
    'below-baseline',
    'cases-changed',
    'internal-error',
    'missing-metric',
    'no-baseline',
    'sample-count',
    'unreadable-metric',
  ]);
  assert.ok(COUNTS_LINE.includes('nine finding ids'));
});

test('the citation block and the specification address name the specification version that the code implements', () => {
  assert.equal(CITATION.includes(`[evals-baseline specification ${specificationVersion}]`), true);
  assert.equal(SPECIFICATION_ADDRESS.endsWith(`/${specificationVersion}`), true);
});

test('the README holds the citation block, and the problem names it when it is gone', () => {
  assert.deepEqual(docProblems(everywhere('readme', CITATION, '')), ['the README does not hold the citation block']);
});

test('goes red on a citation block with one word changed', () => {
  assert.deepEqual(
    docProblems(everywhere('readme', 'guards its agent evaluations', 'guards its evaluations')),
    ['the README does not hold the citation block'],
  );
});

test('goes red on a citation block that names the repository instead of the address', () => {
  const problems = docProblems(everywhere('readme', `(${CITATION.split('(')[1]}`, '(https://github.com/evals-baseline/evals-baseline).'));
  assert.deepEqual(problems, ['the README does not hold the citation block']);
});

for (const address of ['https://meshin.co/specs/evals-baseline/1.0.0/', 'https://meshin.co/resources/evals-baseline/']) {
  test(`goes red on a README that points at ${address}, an address the specification never settled`, () => {
    const problems = docProblems(appended('readme', `See ${address}.`));
    assert.deepEqual(problems, [`the README holds an address on meshin.co that is not the specification's: ${address}`]);
  });

  test(`goes red on a contributing file that points at ${address}, an address the specification never settled`, () => {
    const problems = docProblems(appended('contributing', `See ${address}.`));
    assert.deepEqual(problems, [`the contributing file holds an address on meshin.co that is not the specification's: ${address}`]);
  });
}

test('takes the package name from package.json, so a rename that the README does not follow goes red', () => {
  const problems = docProblems(withManifest({ ...manifest, name: 'renamed' }));
  assert.deepEqual(problems, ['the README does not hold an npm install line for renamed']);
});

test('goes red on a README whose Action lines name a short SHA instead of a full-length one', () => {
  const problems = docProblems(repinned('evals-baseline@', '', '3d3c42e'));
  assert.ok(problems.includes('the README has no Action line pinned to a full-length commit SHA'), problems.join('\n'));
});

test('goes red on a README whose copy line names a short SHA instead of a full-length one', () => {
  const problems = docProblems(repinned('evals-baseline/', '/dist', '3d3c42e'));
  assert.deepEqual(problems, ['the README has no copy line pinned to a full-length commit SHA']);
});

test('goes red on a README whose copy line leaves out the file the build generates', () => {
  const problems = docProblems(everywhere('readme', '/dist/evals-baseline.mjs', '/dist/other.mjs'));
  assert.ok(problems.includes('the README has no copy line pinned to a full-length commit SHA'), problems.join('\n'));
});

test('accepts an Action line and a copy line pinned to a real 40-character SHA', () => {
  const sha = '3d3c42e5aac5ba805825da76410c181273ba90b1';
  const readme = real.readme.replace(new RegExp(COMMIT_REFERENCE, 'g'), sha);
  assert.deepEqual(docProblems({ ...real, readme }), []);
});

test('goes red on a README that names the v1 tag before it names the commit', () => {
  const problems = docProblems(prepended('readme', 'Use evals-baseline/evals-baseline@v1 if you must.'));
  assert.deepEqual(problems, ['the README names the v1 tag before it names a commit']);
});

test('goes red on a README that leaves out the permission the Action needs', () => {
  assert.deepEqual(docProblems(everywhere('readme', 'contents: read', 'removed')), ['the README does not tell the reader to grant contents: read']);
});

for (const text of ['PROMPTFOO_FAILED_TEST_EXIT_CODE', 'if: always()']) {
  test(`goes red on a README that never says ${text}, because promptfoo exits 100 on a failing test`, () => {
    assert.deepEqual(docProblems(everywhere('readme', text, 'removed')), [`the README does not mention ${text}`]);
  });
}

test('goes red on a README that gives an Action input another default than action.yml', () => {
  const row = lineStarting('readme', '| `baseline`');
  const document = planted('readme', row, row.replace('evals-baseline.json', 'other.json'));
  assert.deepEqual(docProblems(document), ['the README gives the Action input baseline the default other.json, and action.yml gives it evals-baseline.json']);
});

test('goes red on a README that lists an input action.yml does not declare', () => {
  const row = lineStarting('readme', '| `baseline`');
  const document = planted('readme', row, `${row}\n| \`token\` | \`x\` | a token |`);
  assert.deepEqual(docProblems(document), ['the README lists the Action input token, and action.yml does not declare it']);
});

test('goes red on a README that leaves out an input action.yml declares', () => {
  const row = lineStarting('readme', '| `baseline`');
  assert.deepEqual(docProblems(planted('readme', `${row}\n`, '')), ['action.yml declares the input baseline, and the README does not list it']);
});

test('goes red on a README that gives the required input a default', () => {
  const row = lineStarting('readme', '| `run-file`');
  const document = planted('readme', row, row.replace('none, required', '`run.json`'));
  assert.deepEqual(docProblems(document), ['the README gives the Action input run-file the default run.json, and action.yml makes it required']);
});

test('goes red on a README that makes an optional input required', () => {
  const row = lineStarting('readme', '| `baseline`');
  const document = planted('readme', row, row.replace('`evals-baseline.json`', 'none, required'));
  assert.deepEqual(docProblems(document), ['the README makes the Action input baseline required, and action.yml gives it the default evals-baseline.json']);
});

test('goes red on a README that never mentions the output of the Action', () => {
  assert.deepEqual(docProblems(everywhere('readme', '`findings`', 'the count')), ['the README does not mention the Action output findings']);
});

test('takes the runtime from action.yml, so a move to another runtime that the README does not follow goes red', () => {
  const moved = real.actionYml.replace('using: node24', 'using: node26');
  assert.notEqual(moved, real.actionYml);
  assert.deepEqual(docProblems({ ...real, actionYml: moved }), ['the README does not name the Action runtime node26 that action.yml declares']);
});

test('goes red on a README table that leaves out a finding id the tool prints', () => {
  const row = lineStarting('readme', '| `internal-error`');
  assert.deepEqual(docProblems(planted('readme', `${row}\n`, '')), ['the tool prints the finding id internal-error, and the README table does not list it']);
});

test('goes red on a README table that lists a finding id the tool never prints', () => {
  const row = lineStarting('readme', '| `internal-error`');
  const document = planted('readme', row, `${row}\n| \`made-up\` | nothing |`);
  assert.deepEqual(docProblems(document), ['the README table lists the finding id made-up, and the tool never prints it']);
});

test('goes red when the tool starts to print a finding id that the README does not know', () => {
  const document = { ...real, findingIds: [...real.findingIds, 'new-finding'] };
  assert.deepEqual(docProblems(document), ['the tool prints the finding id new-finding, and the README table does not list it']);
});

test('goes red on a README with no table of finding ids', () => {
  const header = lineStarting('readme', '| Finding');
  assert.deepEqual(docProblems(planted('readme', header, 'Findings:')), ['the README has no table of finding ids']);
});

test('goes red on a README that shows a verb the command does not have', () => {
  assert.deepEqual(
    docProblems(withFence(['npx evals-baseline verify x.json'])),
    ['the README shows a command with a verb that does not exist: npx evals-baseline verify x.json'],
  );
});

test('reads a command behind a dollar prompt, written as the copied file, and in a code span', () => {
  const commands = ['npx evals-baseline verify b.json', 'node evals-baseline.mjs verify c.json'];
  assert.deepEqual(
    docProblems(withFence(['$ npx evals-baseline verify b.json', 'node evals-baseline.mjs verify c.json'])),
    commands.map((command) => `the README shows a command with a verb that does not exist: ${command}`),
  );
  assert.deepEqual(
    docProblems(appended('readme', 'Run `npx evals-baseline verify d.json` now.')),
    ['the README shows a command with a verb that does not exist: npx evals-baseline verify d.json'],
  );
});

test('does not read the banner line of a transcript as a command', () => {
  const transcript = ['$ npx evals-baseline check results.json', BANNER_LINE, 'evals-baseline: no findings'];
  assert.deepEqual(docProblems(withFence(transcript)), []);
  assert.deepEqual(docProblems(withFence(['$ npx evals-baseline --version', 'evals-baseline 1.0.0 (specification 1.0)'])), []);
});

test('still reads a bad command that sits beside a transcript banner', () => {
  assert.deepEqual(
    docProblems(withFence([BANNER_LINE, 'npx evals-baseline verify x.json'])),
    ['the README shows a command with a verb that does not exist: npx evals-baseline verify x.json'],
  );
});

for (const command of [
  'npx evals-baseline check x.json --fail',
  'npx evals-baseline check x.json --tolerance 0.1',
  'npx evals-baseline record x.json --strict',
  'npx evals-baseline show x.json --baseline b.json',
]) {
  test(`goes red on a README that shows "${command}"`, () => {
    assert.deepEqual(docProblems(withFence([command])), [`the README shows a command with a flag its verb does not take: ${command}`]);
  });
}

for (const command of [
  'npx evals-baseline check x.json --baseline b.json --strict',
  'npx evals-baseline record x.json --baseline b.json --tolerance 0.02',
  'npx evals-baseline show x.json',
  'npx evals-baseline --version',
  'node evals-baseline.mjs check x.json --strict',
]) {
  test(`accepts "${command}"`, () => {
    assert.deepEqual(docProblems(withFence([command])), []);
  });
}

for (const command of ['evals-baseline check x.json', 'evals-baseline --version']) {
  test(`goes red on a README that shows "${command}" without npx, because a local install puts no command on the PATH`, () => {
    assert.deepEqual(docProblems(withFence([command])), [`${BARE_PROBLEM} ${command}`]);
  });
}

test('reads a bare command behind a dollar prompt and in a code span', () => {
  assert.deepEqual(docProblems(withFence(['$ evals-baseline show x.json'])), [`${BARE_PROBLEM} evals-baseline show x.json`]);
  assert.deepEqual(docProblems(appended('readme', 'Run `evals-baseline show x.json` now.')), [`${BARE_PROBLEM} evals-baseline show x.json`]);
});

test('does not read the package name in an install, uninstall or npx line as a bare command, now that the package and the command share a name', () => {
  assert.deepEqual(
    docProblems(withFence(['$ npm install --save-dev evals-baseline', '$ npm uninstall evals-baseline', '$ npx evals-baseline'])),
    [],
  );
  assert.deepEqual(docProblems(appended('readme', 'Install `npm install --save-dev evals-baseline`, then run `npx evals-baseline`.')), []);
});

test('goes red on a bare command that follows an install line, the one place where the package name and the command meet', () => {
  assert.deepEqual(
    docProblems(withFence(['$ npm install --save-dev evals-baseline', '$ evals-baseline record x.json'])),
    [`${BARE_PROBLEM} evals-baseline record x.json`],
  );
});

for (const word of ['TODO', 'TBD', 'FIXME']) {
  test(`goes red on a ${word} left in the README, the contributing file or the security policy`, () => {
    assert.deepEqual(docProblems(appended('readme', `Left over: ${word}`)), [`the README holds a leftover marker: ${word}`]);
    assert.deepEqual(docProblems(appended('contributing', `Left over: ${word}`)), [`the contributing file holds a leftover marker: ${word}`]);
    assert.deepEqual(docProblems(appended('security', `Left over: ${word}`)), [`the security policy holds a leftover marker: ${word}`]);
  });
}

test('goes red on a reference to a locked decision of the site repository, which means nothing here', () => {
  assert.deepEqual(docProblems(appended('readme', 'See L71.')), ['the README holds a reference to a decision outside this repository: L71']);
  assert.deepEqual(docProblems(appended('contributing', 'See L73.')), ['the contributing file holds a reference to a decision outside this repository: L73']);
  assert.deepEqual(docProblems(appended('security', 'See L78.')), ['the security policy holds a reference to a decision outside this repository: L78']);
});

test('goes red on a citation of a numbered section, because the published specification has none', () => {
  const none = 'and the published specification has no numbered sections';
  assert.deepEqual(docProblems(appended('readme', 'See section 2.3.')), [`the README cites "section 2.3", ${none}`]);
  assert.deepEqual(docProblems(appended('contributing', 'Sections 5 and 6 fix it.')), [`the contributing file cites "sections 5", ${none}`]);
});

test('goes red on a package.json that asks for another Node minimum than the README says', () => {
  const said = /Node\.js (\d+) or later/.exec(real.readme)[1];
  assert.equal(manifest.engines.node, `>=${said}`);
  const document = withManifest({ ...manifest, engines: { node: '>=99' } });
  assert.deepEqual(docProblems(document), [`the README says Node.js ${said} or later, and package.json engines.node is >=99`]);
});

test('goes red on a README that does not say which Node it needs', () => {
  const said = /Node\.js \d+ or later/.exec(real.readme)[0];
  assert.deepEqual(docProblems(everywhere('readme', said, 'a recent Node')), ['the README does not say which Node.js version it needs']);
});

test('goes red on a package.json with no engines.node', () => {
  assert.deepEqual(docProblems(withoutField('engines')), ['package.json names no engines.node']);
});

for (const field of ['exports', 'main', 'module']) {
  test(`goes red on a package.json that declares ${field}, which makes the package importable`, () => {
    assert.deepEqual(docProblems(withManifest({ ...manifest, [field]: './src/index.mjs' })), [importable(field)]);
  });
}

test('goes red on a package.json without the bin that the README tells the reader to run', () => {
  assert.deepEqual(docProblems(withoutField('bin')), ['package.json has no bin named evals-baseline, and the README tells the reader to run it']);
});

test('goes red on a README or a contributing file that tells the reader to run an npm script that does not exist', () => {
  const none = 'and package.json declares no script of that name';
  assert.deepEqual(docProblems(appended('readme', 'Run `npm run nothing`.')), [`the README says npm run nothing, ${none}`]);
  assert.deepEqual(docProblems(appended('contributing', 'Run `npm run nothing`.')), [`the contributing file says npm run nothing, ${none}`]);
});

for (const [name, text] of [
  ['the counts line', COUNTS_LINE],
  ['the one-line answer', ONE_LINE_ANSWER],
  ['the way an entry leaves the list', LEAVING_RULE],
]) {
  test(`goes red on a contributing file without ${name}`, () => {
    assert.deepEqual(docProblems(without('contributing', text)), [`the contributing file does not hold ${name}`]);
  });
}

test('goes red on a contributing file that never links the specification', () => {
  assert.deepEqual(
    docProblems(everywhere('contributing', SPECIFICATION_ADDRESS, 'the specification')),
    ['the contributing file does not link the specification'],
  );
});

test('goes red on a contributing file with a refusal removed, and says how many it holds', () => {
  const row = lineStarting('contributing', `| ${REFUSED[3]}`);
  const expected = `the contributing file holds ${REFUSED.length - 1} refusals, and the list in doc-rules.mjs holds ${REFUSED.length}`;
  assert.deepEqual(docProblems(planted('contributing', `${row}\n`, '')), [expected]);
});

test('goes red on a contributing file with a refusal added', () => {
  const last = REFUSED[REFUSED.length - 1];
  const row = lineStarting('contributing', `| ${last}`);
  const document = planted('contributing', row, `${row}\n| Anything else | Because |`);
  const expected = `the contributing file holds ${REFUSED.length + 1} refusals, and the list in doc-rules.mjs holds ${REFUSED.length}`;
  assert.deepEqual(docProblems(document), [expected]);
});

test('goes red on a contributing file with a refusal reworded, and names which one', () => {
  const document = planted('contributing', REFUSED[6], 'Calling a model or any paid API');
  assert.deepEqual(docProblems(document), [`refusal 7 of the contributing file is "Calling a model or any paid API", and doc-rules.mjs has "${REFUSED[6]}"`]);
});

test('goes red on a contributing file with two refusals swapped', () => {
  const [first, second] = [REFUSED[0], REFUSED[1]];
  const document = planted('contributing', first, '@@');
  const swapped = { ...document, contributing: document.contributing.replace(second, first).replace('@@', second) };
  assert.deepEqual(docProblems(swapped), [
    `refusal 1 of the contributing file is "${second}", and doc-rules.mjs has "${first}"`,
    `refusal 2 of the contributing file is "${first}", and doc-rules.mjs has "${second}"`,
  ]);
});

test('goes red on a refusal with no reason', () => {
  const row = lineStarting('contributing', `| ${REFUSED[8]}`);
  assert.deepEqual(docProblems(planted('contributing', row, `| ${REFUSED[8]} |  |`)), ['refusal 9 of the contributing file gives no reason']);
});

test('the refusal list sits under its own heading, and the problem names the heading when it is gone', () => {
  assert.ok(real.contributing.includes(`\n${REFUSAL_HEADING}\n`));
  assert.deepEqual(docProblems(without('contributing', `${REFUSAL_HEADING}\n`)), [`the contributing file has no heading ${REFUSAL_HEADING}`]);
});

test('goes red on a security policy that names no address to report to', () => {
  const address = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(real.security)[0];
  assert.deepEqual(docProblems(everywhere('security', address, 'the maintainer')), ['the security policy names no address to report to']);
});
