import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot } from '../../test/support/fixtures.mjs';
import { specimenIndexText } from '../../test/support/specimen-run.mjs';
import { specimens } from '../../test/support/specimen-table.mjs';

writeFileSync(join(repositoryRoot, 'fixtures', 'specimens.json'), specimenIndexText(specimens), 'utf8');
