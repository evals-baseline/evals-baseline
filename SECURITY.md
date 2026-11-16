# Security policy

evals-baseline runs inside other people's CI, and one person publishes it. This page says how to report a flaw in it.

## Report a flaw

Send an email to dmitri.meshin@gmail.com. Do not open a public issue for a security flaw: an issue is public the moment it is filed.

Say which version you ran (`npx evals-baseline --version` prints it), what you did, what happened and what you expected.

## What counts as a flaw

The README and the specification make promises that a flaw would break. A report is in scope when it shows one of these:

- `check`, `record` or `show` opens a network connection.
- `check` writes a file, or `record` writes a file other than the baseline.
- A line that `check`, `record` or `show` prints starts with text read from a run file or a baseline. GitHub reads a log line that starts with `::` as a workflow command, and the Action prints what `check` prints.
- A line that `check`, `record` or `show` prints holds text read from a run file, a baseline or the command line outside a pair of double quotes, or holds a character that a person cannot see and that is not written as an escape. A zero-width joiner, a soft hyphen and a character of the Tags block are examples. The baseline that `record` writes must hold none of them either.
- The Action needs a token, or a permission beyond `contents: read`.
- A file in `dist/` is not what `src/` generates, so `dist/manifest.json` does not describe what runs.

A metric name that holds an instruction in plain letters is not a flaw. The report prints it between double quotes, and a program that reads the report can still obey it.

## What to expect

This is a one-person project with no support agreement. No response time is promised.
