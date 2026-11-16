# Contributing

## What is welcome

- A bug report, as an [issue](https://github.com/evals-baseline/evals-baseline/issues). Say what you ran, what it printed and what you expected. `npx evals-baseline --version` prints the package version and the specification version to quote.
- A conformance vector for a case the existing ones miss. `fixtures/vectors.json` holds them, and `test/vectors.test.mjs` fails when that file differs from what `node fixtures/suites/derive-vectors.mjs` writes.
- A fix to a reader when a new promptfoo or DeepEval version changes its file. A new output shape is a MINOR version of the specification: older baselines are still read, and nothing already readable changes meaning.
- A fix to the documentation.

A security flaw does not go to the issue tracker. [SECURITY.md](SECURITY.md) says where it goes. This is a one-person project and nobody is on call for it.

## What this repository refuses, permanently

A one-person artefact does not die of one big mistake. It dies of reasonable-looking requests, each cheap alone, that turn it into a service the owner is on call for. So the list below is fixed, and an entry leaves the list only by a new major version of the specification, never by a pull request. The [specification 1.0](https://meshin.co/spec/evals-baseline/1.0) holds the list in its table of permanent refusals. One row, the one about Action tags, is a rule of this repository and is not in the specification; it leaves the list in the same way.

Counts that will not grow within 1.x: three surfaces, two readers, three verbs and one version flag, four rules, one binding check, and nine finding ids.

| Refused | Why |
| --- | --- |
| A hosted service, dashboard, account, database, or any network access | A hosted part is how a one-person artefact acquires an operational duty. `check`, `record` and `show` open no connection |
| A neutral run format, or a third reader | A format that no tool writes has no files to read, and each reader is code tied to another project's file format, which changes on that project's release schedule, not this one's. There are two readers, and a third leaves the list only by a new major version of the specification, like every other entry |
| A request to read another tool's output (Inspect, Ragas, LangSmith, Braintrust and the rest) | A reader for another tool is code tied to that tool's file format, which changes on that tool's release schedule, not this one's. Each reader added is one more format to keep current |
| Statistical significance, confidence intervals, retries, flaky-test handling | The baseline keeps no per-case data, and a reviewer can read a number in a diff but not a p-value |
| Relative, global or auto-adjusting tolerance, or a tolerance given at check time | The tolerance is absolute, per metric, and stored in the baseline file next to the value it relaxes. A relative tolerance of 5% permits a drop from 0.2 to 0.19 and from 0.95 to 0.9025, so one number means different things on different metrics. A tolerance given at check time would sit in a workflow line, where the package, the copied file and the Action could be given different numbers. `check` has no tolerance flag |
| Updating the baseline automatically, on a pass or on a fail | An automatic update makes the baseline whatever the last run was, and so makes the check meaningless. The baseline changes only when a person runs `record` and commits the result |
| Calling a model, a judge or any paid API | A judge call needs a key and a network, so the check could fail for reasons that have nothing to do with your evals, and could cost money on every pull request |
| Telemetry, an update check, any outbound request | A request is a failure that depends on a network and a day, so the check could go red when nothing in your repository changed. Telemetry would also tell a third party that your repository ran the check |
| Pull-request comments, bots, chat messages, badges, status APIs | Each needs a token and a service. The Action takes no token, and its only writes are one workflow annotation per finding and the `findings` output |
| Failing on a date, on baseline age, or on expiry | A clock fact is printed as a dated line and never failed on: the build would go red on a day nothing in the repository changed |
| Lower-is-better metrics, or a per-metric polarity setting, in 1.x | DeepEval metrics are read as higher-is-better only, and a metric whose own verdicts contradict that is refused |
| A configuration file or environment variables | The baseline is the only configuration, and a second place is a second place for the surfaces to disagree |
| JSON, SARIF or JUnit output of the report | Each format is another contract to keep. The report is line-oriented so `grep` and the exit code are the interface, and the baseline is JSON for anyone who needs structure |
| More than one run or suite in a baseline, merging baselines, per-branch baselines | One baseline holds one run of one suite, so each has one `source` and one `cases` digest |
| Saying which case regressed | It needs per-case data, and the baseline keeps one value and one sample count for each metric, not one result for each case |
| A second moving alias for the Action beyond `v1`, such as `latest` or a floating minor | The Action is addressed by an immutable commit and by one moving tag, `v1`. A second moving alias would be one more name whose target its author can change |
| A `--ci`, `--fail`, `--exit-code` or similar flag that makes failure the default | Failure is opt-in. `--strict` is the only flag that makes `check` exit 1 |

The answer to a request for any of these is one line:

This is on the refusal list, which the specification fixes; changing it is a new major version of the specification, not a pull request.

## Changing the code

`src/` is the one source. `dist/action.mjs` and `dist/evals-baseline.mjs` are generated from it, and `dist/manifest.json` lists the SHA-256 of each of them and of the source set. Do not edit the generated files by hand. Change `src/`, run `npm run build`, and commit `src/` and `dist/` together.

CI runs on every push and every pull request, needs no secret and no key, and runs in this order:

1. `npm test`
2. `node build/build.mjs --check` rebuilds into a scratch folder and fails when a generated file or the manifest differs from the committed one by one byte.
3. `node build/parity.mjs` runs every conformance vector in `fixtures/vectors.json` through real processes: the file that `package.json` names under `bin`, `dist/evals-baseline.mjs` and, for the `check` vectors that the Action's inputs can express, `dist/action.mjs`. Each process runs in a fresh directory with the clock fixed at the instant of the vector, and parity fails unless it prints that vector's stdout and stderr, exits with that vector's code and writes exactly the files that the vector lists. For the Action it also compares the annotations and the `findings` output with the report. Each surface is compared with the vector and never with another surface.
4. `node build/guards.mjs` fails on an import without the `node:` prefix, a network API name, `eval` or `Function` in a generated file.

Each of the last three is also an npm script: `npm run build -- --check`, `npm run parity` and `npm run guards`.

A change starts with a test that fails. Source and tests carry no comments. A new guard comes with a planted violating specimen and a test that shows the guard going red on it.
