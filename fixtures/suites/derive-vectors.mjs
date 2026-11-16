import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot } from '../../test/support/fixtures.mjs';
import { vectorDocument, vectorText } from '../../test/support/vectors.mjs';

writeFileSync(join(repositoryRoot, 'fixtures', 'vectors.json'), vectorText(vectorDocument()), 'utf8');
