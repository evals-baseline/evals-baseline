import { createHash } from 'node:crypto';
import {
  ACTION_ENTRIES,
  ACTION_FILE,
  COMMITTED_DIRECTORY,
  CONCATENATED_MODULES,
  COPY_ENTRIES,
  COPY_FILE,
  ENTRY_PATHS,
  MANIFEST_FILE,
  SOURCE_SET,
  sourcePath,
} from './layout.mjs';
import { BuildRefusal, stripPart } from './strip.mjs';

const VERSION_LINE = /^evals-baseline (\S+) \(specification (\S+)\)$/;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export function parseVersionLine(versionLine) {
  const match = VERSION_LINE.exec(versionLine);
  if (!match) {
    throw new BuildRefusal(
      `the --version line is not "evals-baseline <package version> (specification <specification version>)": ${versionLine}`,
    );
  }
  return { package: match[1], specification: match[2] };
}

const header = (versionLine) => `// ${versionLine}\n// Generated file. Do not edit. Rebuild with: node build/build.mjs\n`;

const withOneTrailingNewline = (text) => `${text.replace(/^\n+/, '').replace(/\n+$/, '')}\n`;

function assemble({ versionLine, parts }) {
  const earlier = new Set();
  const bodies = parts.map(({ path, text }) => {
    const body = withOneTrailingNewline(stripPart({ path, text, earlier }));
    earlier.add(path);
    return body;
  });
  return `${header(versionLine)}\n${bodies.join('\n')}`;
}

function requireText(table, key, path) {
  if (typeof table[key] !== 'string') throw new BuildRefusal(`${path} is missing`);
  return table[key];
}

function manifestFor({ version, sources, action, copy }) {
  const listing = SOURCE_SET.map((name) => `${sha256(sources[name])}  ${sourcePath(name)}\n`).join('');
  const manifest = {
    package: version.package,
    specification: version.specification,
    sourceSet: { sha256: sha256(listing), files: SOURCE_SET.map(sourcePath) },
    generated: {
      [`${COMMITTED_DIRECTORY}/${ACTION_FILE}`]: sha256(action),
      [`${COMMITTED_DIRECTORY}/${COPY_FILE}`]: sha256(copy),
    },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function generate({ sources, entries, versionLine }) {
  const version = parseVersionLine(versionLine);
  const sourceTexts = Object.fromEntries(SOURCE_SET.map((name) => [name, requireText(sources, name, sourcePath(name))]));
  const entryTexts = Object.fromEntries(ENTRY_PATHS.map((path) => [path, requireText(entries, path, path)]));
  const modules = CONCATENATED_MODULES.map((name) => ({ path: sourcePath(name), text: sourceTexts[name] }));
  const entryParts = (paths) => paths.map((path) => ({ path, text: entryTexts[path] }));

  const action = assemble({ versionLine, parts: [...modules, ...entryParts(ACTION_ENTRIES)] });
  const copy = assemble({ versionLine, parts: [...modules, ...entryParts(COPY_ENTRIES)] });
  const manifest = manifestFor({ version, sources: sourceTexts, action, copy });

  return { [ACTION_FILE]: action, [COPY_FILE]: copy, [MANIFEST_FILE]: manifest };
}
