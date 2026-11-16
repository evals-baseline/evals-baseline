import assert from 'node:assert/strict';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { snapshotDirectory } from '../../build/lib/scratch.mjs';
import { actionInputsFor } from '../../build/lib/vectors.mjs';
import { derivedCopy, parity, plantEdits, plantText, plural, pristineVector, problemLine, proveRed, readVectors, reportOf, writeVectors } from './mini-repository.mjs';
import { MINI_PLANTS as P, miniActionYml } from './mini-tool.mjs';
import { proveWithSpecimen, runNode, scratchDirectory } from './support.mjs';

const SURFACES = ['package', 'copy', 'action'];
const PACKAGE_AND_COPY = ['package', 'copy'];
const FILES = {
  command: { package: 'src/command.mjs', copy: 'dist/evals-baseline.mjs', action: 'dist/action.mjs' },
  entry: { package: 'src/cli.mjs', copy: 'dist/evals-baseline.mjs', action: 'dist/action.mjs' },
  action: { action: 'dist/action.mjs' },
};
const edit = (file, [from, to]) => ({ file, from, to });

test('passes when the package, the copy and the Action all do what the vectors say, and says how much it compared', (t) => {
  const root = derivedCopy(t);
  const { vectors } = readVectors(root);
  const result = parity(root)();
  const reachable = vectors.filter(({ argv }) => actionInputsFor(argv) !== null).length;
  const instants = new Set(vectors.map(({ now }) => now)).size;
  const [packageRuns, copyRuns, actionRuns] = [vectors.length, vectors.length, reachable].map((count) => plural(count, 'run'));
  const compared = `${plural(vectors.length, 'vector')} at ${plural(instants, 'instant')}; package ${packageRuns}, copy ${copyRuns}, action ${actionRuns}`;
  assert.deepEqual([result.code, result.stdout, result.stderr], [0, `parity: ${compared}; no mismatches\n`, '']);
  assert.ok(instants >= 2 && reachable < vectors.filter(({ argv }) => argv[0] === 'check').length, 'the vectors need two instants and a check the Action cannot express');
});

for (const [name, change] of [
  ['deleted', (directory) => rmSync(directory, { recursive: true })],
  ['replaced by other text', (directory) => Object.keys(snapshotDirectory(directory)).forEach((file) => writeFileSync(join(directory, file), 'finding nobody :: other text\n'))],
]) {
  test(`reads the vectors file alone, so it stays green when every file under fixtures/mini is ${name}`, (t) => {
    const root = derivedCopy(t);
    change(join(root, 'fixtures', 'mini'));
    const result = parity(root)();
    assert.equal(result.code, 0, result.output);
  });
}

test('never writes into the repository, not even for the vector that records a file', (t) => {
  const root = derivedCopy(t);
  const before = snapshotDirectory(root);
  assert.ok(readVectors(root).vectors.some(({ writes }) => writes.length > 0));
  assert.equal(parity(root)().code, 0);
  assert.deepEqual(snapshotDirectory(root), before);
});

test("stays green when only the package version number differs, because that number is the implementation's own", (t) => {
  const root = derivedCopy(t);
  plantEdits(root, [{ file: 'src/render.mjs', from: "packageVersion = '1.0.0'", to: "packageVersion = '2.3.4'" }])();
  assert.match(runNode(['src/cli.mjs', '--version'], { cwd: root }).stdout, /^evals-baseline 2\.3\.4 /);
  assert.equal(parity(root)().code, 0);
});

const afterTheReport = (id) => pristineVector(id).stdout.length + 3;
const atTheCloser = (id) => pristineVector(id).stdout.length + 2;
const annotationLine = (id, rest, offset = 0) => () => `stdout line ${afterTheReport(id) + offset}: ${rest}`;
const closerLine = (id) => () => `stdout line ${atTheCloser(id)}:`;

const COMMAND_DEFECTS = [
  ['prints the usage line on stdout instead of stderr', SURFACES, [P.usageToStdout], 'usage', 'stdout line 1:'],
  ['prints no usage line at all', SURFACES, [P.noUsage], 'usage', 'stderr line 1:'],
  ['exits with code 1 where the vector has code 2', SURFACES, [P.exitTwoAsOne], 'usage', 'exit code 1'],
  ['prints another banner for --version', PACKAGE_AND_COPY, [P.otherBanner], 'version', 'stdout line 1:'],
  ['prints a finding line other than the vector has', PACKAGE_AND_COPY, [P.otherFinding], 'findings', 'stdout line 2:'],
  ['leaves out the last line of the report', PACKAGE_AND_COPY, [P.shortReport], 'clean', 'stdout line 2:'],
  ['writes the record file with other content than the vector', PACKAGE_AND_COPY, [P.otherRecord], 'record', 'wrote evals-baseline.json with other content'],
  ['does not write the record file', PACKAGE_AND_COPY, [P.noRecord], 'record', 'did not write evals-baseline.json'],
  ['writes a file that the vector does not list', ['copy'], [P.leaksFile], 'clean', 'wrote leak.txt, which the vector does not list'],
  ['removes a file that the vector does not list', ['copy'], [P.removesRunFile], 'clean', 'removed run-clean.txt, which the vector does not list'],
  ['reads the real clock instead of the frozen one', ['copy'], [P.realClock], 'clean', 'stdout line 1:'],
  ['throws before it prints', ['copy', 'action'], [P.throwsEarly], 'clean', 'exit code 1'],
  ['is killed by a signal before it prints', ['copy'], [P.killsItself], 'clean', 'did not finish'],
  ['reads a file beside the repository, so it only works where it was built', ['copy', 'action'], [P.readsBesideRepository], 'clean', 'exit code 1'],
];

const ENTRY_DEFECTS = [
  ['writes the lines of stderr to stdout', SURFACES, [P.stderrToStdout], 'usage', 'stdout line 1:'],
  ['sets the exit code of the process to 1 where the command returned 2', SURFACES, [P.exitTwoAsOneInBin], 'usage', 'exit code 1'],
  ['ends its stderr without a newline', SURFACES, [P.stderrWithoutNewline], 'usage', 'stderr does not end with a newline'],
  ['ends its stdout without a newline', PACKAGE_AND_COPY, [P.stdoutWithoutNewline], 'clean', 'stdout does not end with a newline'],
];

const CLOSER = 'process.stdout.write(`::${token}::\\n`);';
const SEVERITY = "failed.has(line) ? 'error' : 'warning'";
const EVERY_FINDING = 'for (const line of findings) {';
const LOOP = 'for (const command of commands) process.stdout.write(';
const EARLY = 'for (const command of annotations({ findings: outcome.findings, failing: outcome.failing, code: outcome.code })) process.stdout.write(`${command}\\n`);';
const STRICT = "inputOf(env, 'strict') === 'true'";
const OUTPUT = 'process.env.GITHUB_OUTPUT && outcome.code !== usageErrorCode';
const TITLE = "const ANNOTATION_TITLE = 'evals-baseline';";
const STOP_COMMANDS = 'process.stdout.write(`::stop-commands::${token}\\n`);';
const ACCURACY = 'action annotates "finding agent :: accuracy';
const MESSAGE = '{ title: ANNOTATION_TITLE }, line)';

const ACTION_DEFECTS = [
  ['reads the strict input as never on', [[STRICT, "inputOf(env, 'strict') === 'never'"]], 'findings-strict', 'exit code 0'],
  ['reads every value of the strict input as on, even its default of false', [[STRICT, "inputOf(env, 'strict') !== ''"]], 'findings', 'exit code 1'],
  ['does not pass the baseline input to the command', [["...(baseline === '' ? [] : ['--baseline', asPath(baseline)]),", '...[],']], 'baseline-flag', 'stdout line 1:'],
  ['annotates a failing finding as an error without --strict', [['new Set(code === PASSED ? [] : failing)', 'new Set(failing)']], 'findings', '2 error annotations without --strict'],
  ['annotates a failing finding as a warning under --strict', [[SEVERITY, "'warning'"]], 'findings-strict', 'exit code 1 with 0 error annotations'],
  ['annotates a finding that never fails as an error under --strict', [[SEVERITY, "'error'"]], 'soft-strict', 'exit code 0 with 1 error annotation'],
  ['does not escape a percent sign in an annotation', [[".replace(/%/g, '%25')", '']], 'escapes', annotationLine('escapes', 'action annotates "finding agent :: 100% done')],
  [
    'does not escape a carriage return in an annotation',
    [[".replace(/\\r/g, '%0D')", '']],
    'escapes',
    annotationLine('escapes', 'action prints "::warning title=evals-baseline::finding agent :: 100%25'),
  ],
  ['gives its annotations another title', [[TITLE, TITLE.replace('-baseline', '')]], 'findings', annotationLine('findings', 'action prints "::warning title=evals::')],
  ['leaves out the annotation of the first finding', [[EVERY_FINDING, 'for (const line of findings.slice(1)) {']], 'findings', '1 annotation for 2 findings'],
  ['adds an annotation that is not for a finding', [[EVERY_FINDING, "for (const line of [...findings, 'evals-baseline: no findings']) {"]], 'clean', '1 annotation for 0 findings'],
  ['annotates the first finding for every finding', [[MESSAGE, MESSAGE.replace('line', 'findings[0]')]], 'findings', annotationLine('findings', ACCURACY, 1)],
  [
    'prints a line that is no annotation after the annotations',
    [[LOOP, `process.stdout.write('::notice::hello\\n');\n  ${LOOP}`]],
    'clean',
    annotationLine('clean', 'action prints "::notice::hello"'),
  ],
  ['does not open the report with ::stop-commands::', [[STOP_COMMANDS, '']], 'clean', 'stdout line 1:'],
  ['closes the report with another token than it opened with', [[CLOSER, 'process.stdout.write(`::${randomUUID()}::\\n`);']], 'clean', closerLine('clean')],
  [
    'prints the annotations before the closing token',
    [[CLOSER, `${EARLY}\n    ${CLOSER}`], [`${LOOP}\`\${command}\\n\`);`, '']],
    'findings',
    closerLine('findings'),
  ],
  [
    'writes another number of findings to GITHUB_OUTPUT',
    [['findings=${outcome.findings.length}', 'findings=${outcome.findings.length + 1}']],
    'clean',
    'wrote "findings=1\\n" to GITHUB_OUTPUT',
  ],
  ['writes the number of findings to GITHUB_OUTPUT for a usage error', [[OUTPUT, 'process.env.GITHUB_OUTPUT']], 'usage', 'wrote "findings=0\\n" to GITHUB_OUTPUT'],
  ['wraps an empty report in the stop-commands fence', [['if (outcome.stdout.length > 0) {', 'if (true) {']], 'usage', 'stdout line 1:'],
];

function defectTests(layer, defects) {
  for (const [name, surfaces, edits, id, rest] of defects) {
    for (const surface of surfaces) {
      test(`goes red on the ${surface} alone when the ${surface} ${name}, and green without it`, (t) => {
        const root = derivedCopy(t);
        const plant = plantEdits(root, edits.map((pair) => edit(FILES[layer][surface], pair)));
        const planted = proveRed(root, { plant, token: problemLine(id, surface, typeof rest === 'function' ? rest(surface) : rest) });
        const { lines, verdict, surfaces: named } = reportOf(planted);
        assert.deepEqual([planted.code, planted.stderr, named, verdict], [1, '', [surface], `parity: ${plural(lines.length, 'problem')}`]);
      });
    }
  }
}

defectTests('command', COMMAND_DEFECTS);
defectTests('entry', ENTRY_DEFECTS);
defectTests('action', ACTION_DEFECTS.map(([name, ...rest]) => [name, ['action'], ...rest]));

for (const [name, pair] of [
  ['prints the usage line on stdout instead of stderr', P.usageToStdout],
  ['exits with code 1 where the vector has code 2', P.exitTwoAsOne],
]) {
  test(`goes red on all three surfaces when the command ${name} and dist is rebuilt, because no surface is compared with another`, (t) => {
    const root = derivedCopy(t);
    plantEdits(root, [edit(FILES.command.package, pair)])();
    assert.equal(runNode(['build/build.mjs'], { cwd: root }).code, 0);
    const result = parity(root)();
    assert.deepEqual([result.code, reportOf(result).surfaces], [1, SURFACES]);
  });
}

test('gives every run a fresh directory, so a surface that notices a file an earlier run left stays green', (t) => {
  const root = derivedCopy(t);
  plantEdits(root, [edit(FILES.command.copy, P.noticesLeftover)])();
  const result = parity(root)();
  assert.equal(result.code, 0, result.output);
});

test('runs the script that package.json declares as the bin, not a path of its own', (t) => {
  const root = derivedCopy(t);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  cpSync(join(root, 'src', 'cli.mjs'), join(root, 'src', 'main.mjs'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ ...manifest, bin: { 'evals-baseline': 'src/main.mjs' } }));
  plantEdits(root, [edit('src/main.mjs', P.exitCodePlusOne)])();
  const result = parity(root)();
  assert.deepEqual([result.code, reportOf(result).surfaces], [1, ['package']]);
});

test('lists the problems in vector order, then in package, copy, action order, whichever surface finishes first', (t) => {
  const root = derivedCopy(t);
  const edits = SURFACES.flatMap((surface) => [P.movedHeader, P.otherBanner].map((pair) => edit(FILES.command[surface], pair)));
  plantEdits(root, [...edits, edit(FILES.command.package, P.slowForBaseline)])();
  const result = parity(root)();
  const { lines, verdict, pairs } = reportOf(result);
  const expected = [['baseline-flag', 'package'], ['baseline-flag', 'copy'], ['baseline-flag', 'action'], ['version', 'package'], ['version', 'copy']];
  assert.deepEqual([result.code, pairs, verdict], [1, expected, `parity: ${plural(lines.length, 'problem')}`]);
});

for (const [name, yml, id, rest] of [
  ['gives the baseline input another default than the command has', miniActionYml({ baseline: 'other-baseline.json' }), 'clean', 'stdout line 1:'],
  ['gives strict a default that turns it on', miniActionYml({ strict: 'true' }), 'findings', 'exit code 1'],
]) {
  test(`goes red on the action alone when action.yml ${name}, and green without it`, (t) => {
    const root = derivedCopy(t);
    const planted = proveRed(root, { plant: plantText(join(root, 'action.yml'), yml), token: problemLine(id, 'action', rest) });
    assert.deepEqual(reportOf(planted).surfaces, ['action']);
  });
}

const COVERAGE = [
  ['runs check with --strict and a finding', ({ argv, code }) => argv.includes('--strict') && code === 1],
  ['runs check without --strict and a finding', ({ argv, code, stdout }) => !argv.includes('--strict') && code === 0 && stdout.at(-1).includes('warning only')],
  ['is refused with exit code 2 and text on stderr', ({ code, stdout, stderr }) => code === 2 && stdout.length === 0 && stderr.length > 0],
  ['writes a file', ({ writes }) => writes.length > 0],
];

for (const [name, drops] of COVERAGE) {
  test(`goes red with its own coverage problem when no vector ${name}`, (t) => {
    const root = derivedCopy(t);
    const document = readVectors(root);
    const kept = document.vectors.filter((vector) => !drops(vector));
    assert.ok(kept.length < document.vectors.length, 'the derived vectors hold no vector of that kind to drop');
    writeVectors(root, { ...document, vectors: kept });
    const result = parity(root)();
    const { lines, verdict } = reportOf(result);
    assert.deepEqual([result.code, lines.length, verdict], [1, 1, 'parity: 1 problem']);
    assert.ok(lines[0].startsWith(`parity: coverage: no vector ${name}`), lines[0]);
  });
}

const dropFile = (...path) => (root) => rmSync(join(root, ...path));
const withManifest = (text) => (root) => writeFileSync(join(root, 'package.json'), text);
const withVectors = (change) => (root) => {
  const document = readVectors(root);
  change(document);
  writeVectors(root, document);
};
const withoutStrictInput = (root) => writeFileSync(join(root, 'action.yml'), miniActionYml().replace("  strict:\n    default: 'false'\n", ''));

const REFUSALS = [
  ['a missing vectors file, and says where it looked', dropFile('fixtures', 'vectors.json'), 'fixtures/vectors.json is missing'],
  ['a vectors file with no files, which would need a checkout', withVectors((document) => delete document.files), 'fixtures/vectors.json: files must be an object'],
  ['a vectors file with no vector', withVectors((document) => (document.vectors = [])), 'fixtures/vectors.json: no vector'],
  ['a vector with an argv that is no list of strings, and says which', withVectors((document) => (document.vectors[1].argv = [1])), 'fixtures/vectors.json: vector 2 has no usable argv'],
  ['a missing package.json', dropFile('package.json'), 'package.json is missing'],
  ['a package.json that is not JSON', withManifest('not json'), 'package.json is not JSON'],
  ['a package.json that names no bin', withManifest('{"name":"mini","version":"1.0.0"}\n'), 'package.json declares no bin named evals-baseline'],
  ['a package binary that is missing', dropFile('src', 'cli.mjs'), 'src/cli.mjs is missing'],
  ['a dist without the copy, and names it', dropFile('dist', 'evals-baseline.mjs'), 'dist/evals-baseline.mjs is missing'],
  ['a dist without the Action, and names it', dropFile('dist', 'action.mjs'), 'dist/action.mjs is missing'],
  ['a missing action.yml', dropFile('action.yml'), 'action.yml is missing'],
  ['an action.yml that declares no strict input', withoutStrictInput, 'action.yml declares no input named strict'],
];

for (const [name, prepare, message] of REFUSALS) {
  test(`refuses ${name}, exits 1 and prints no report`, (t) => {
    const root = derivedCopy(t);
    prepare(root);
    const result = parity(root)();
    assert.deepEqual([result.code, result.stdout], [1, '']);
    assert.ok(result.stderr.startsWith(`parity: refused: ${message}`), result.stderr);
  });
}

test('--dist points the run at that directory instead of dist', (t) => {
  const root = derivedCopy(t);
  const elsewhere = scratchDirectory(t, 'dist');
  cpSync(join(root, 'dist'), elsewhere, { recursive: true });
  const plant = plantEdits(elsewhere, [{ file: 'evals-baseline.mjs', from: '`mini check ${options.baseline}', to: '`mini chuck ${options.baseline}' }]);
  const proof = proveWithSpecimen({ run: parity(root, '--dist', elsewhere), plant, token: problemLine('clean', 'copy', 'stdout line 1:') });
  assert.ok(proof.ok, proof.reason);
  assert.equal(parity(root)().code, 0);
});

test('refuses a --dist directory that holds no generated script, and names the first one it misses', (t) => {
  const result = parity(derivedCopy(t), '--dist', scratchDirectory(t, 'empty'))();
  assert.deepEqual([result.code, result.stdout], [1, '']);
  assert.match(result.stderr, /^parity: refused: .*evals-baseline\.mjs is missing$/m);
});

for (const args of [['--fix'], ['dist'], ['--dist']]) {
  test(`exits 2 with the usage line and no report for the arguments ${JSON.stringify(args)}`, (t) => {
    const result = parity(derivedCopy(t), ...args)();
    assert.deepEqual([result.code, result.stdout], [2, '']);
    assert.match(result.stderr, /^usage: node build\/parity\.mjs \[--dist <directory>\]$/m);
  });
}
