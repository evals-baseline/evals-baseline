export const CONCATENATED_MODULES = [
  'printable',
  'unreadable',
  'digest',
  'quantise',
  'direction',
  'read-run',
  'read-baseline',
  'compare',
  'describe',
  'record',
  'render',
  'command',
];

export const SOURCE_SET = [...CONCATENATED_MODULES, 'cli'];

export const sourcePath = (name) => `src/${name}.mjs`;

export const COPY_ENTRIES = ['build/entries/copy-main.mjs'];
export const ACTION_ENTRIES = ['build/entries/action-lib.mjs', 'build/entries/action-main.mjs'];
export const ENTRY_PATHS = [...COPY_ENTRIES, ...ACTION_ENTRIES];

export const COPY_FILE = 'evals-baseline.mjs';
export const ACTION_FILE = 'action.mjs';
export const MANIFEST_FILE = 'manifest.json';
export const GENERATED_FILES = [ACTION_FILE, COPY_FILE, MANIFEST_FILE];
export const GENERATED_SCRIPTS = [ACTION_FILE, COPY_FILE];
export const COMMITTED_DIRECTORY = 'dist';
