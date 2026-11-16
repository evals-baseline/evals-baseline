import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fixturePath, readFixtureText } from '../../test/support/fixtures.mjs';
import { planted } from '../../test/support/planted.mjs';

for (const { tool, file, source, derive } of planted) {
  const target = fixturePath(tool, 'planted', file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, derive(source === null ? '' : readFixtureText(tool, source)), 'utf8');
}
