# evals-baseline

A passing evaluation can still be worse than yesterday's.

Your suite runs, every case passes its own assertion, the build goes green, and accuracy has
quietly fallen from 0.98 to 0.81. Nothing in the pipeline compared the two numbers, because
nothing kept yesterday's.

`evals-baseline` keeps it. You record one good run as a baseline, commit that file, and every
later run is compared against it. When a metric falls further than you allowed, the tool says so
by name, with both numbers and the difference:

```text
$ npx evals-baseline check results.json --strict
evals-baseline 1.0.0 (specification 1.0) check "evals-baseline.json": promptfoo "0.125.1", 2 metrics, 4 cases
date: baseline recorded 2026-11-12, the same day as this check on 2026-11-12
below-baseline "agent :: accuracy": 0.75 over 4 samples is below the baseline 1 over 4 samples by 0.25, more than the tolerance 0
evals-baseline: 1 finding; exit 1 (--strict)
```

That line answers the question a failing gate usually leaves open: not that something broke, but
which metric, from what, to what, by how much, and against which allowance.

The tool needs no API key, opens no network connection, and has no dependency. A baseline of two
metrics is 439 bytes. Reading a 100-case run file of 289 kB took at most 0.19 s over five runs on
Node 26, Apple silicon.

The [specification](https://meshin.co/spec/evals-baseline/1.0) defines what every word in that
output means. Where this README and the specification disagree, the specification wins.

## Three words

The rest of this document uses three terms, and each has exactly one meaning.

A **run file** is what promptfoo or DeepEval writes for one run of your suite.

A **baseline** is `evals-baseline.json`, a file you commit. For each metric it holds one recorded
value, the number of samples behind that value, and a tolerance.

A **tolerance** is how far a metric may fall below its recorded value before the tool reports it.
It is an absolute number in the unit of the metric, set per metric. It exists because a suite with
a non-deterministic model or judge scores slightly differently on two runs of identical code, and
a gate that fires on that noise gets switched off within a week.

## Getting started

Install the package, record a baseline from a run you are happy with, and check later runs against
it.

```text
$ npm install --save-dev evals-baseline
$ npx evals-baseline record results.json --tolerance 0
evals-baseline 1.0.0 (specification 1.0) record: wrote "evals-baseline.json" (2 metrics, 4 cases, promptfoo "0.125.1")
$ npx evals-baseline check results.json
evals-baseline 1.0.0 (specification 1.0) check "evals-baseline.json": promptfoo "0.125.1", 2 metrics, 4 cases
date: baseline recorded 2026-11-12, the same day as this check on 2026-11-12
evals-baseline: no findings
```

Commit `evals-baseline.json`. From then on, the repository knows what good looked like, and on
which day.

The first `record` of a metric requires `--tolerance`, and the tool will not choose one for you. A
tolerance of 0 reports a fall of any size, which is a real choice with real consequences, so
`--tolerance 0` says you accept it knowingly. [Choosing a
tolerance](#choosing-a-tolerance-from-your-own-noise) explains how to measure a better number from
your own suite.

There are two other ways to get the tool, if a dependency is unwelcome:

- As an Action: `uses: evals-baseline/evals-baseline@<full-length commit SHA>`
- As one file: `curl -fsSLO https://raw.githubusercontent.com/evals-baseline/evals-baseline/<full-length commit SHA>/dist/evals-baseline.mjs`

[Pinning the Action](#pinning-the-action-to-a-commit) explains how to find that SHA and why a tag
is not good enough. The package and the single file need Node.js 22 or later; Node.js 20 reached
end of life on 2026-04-30 and is not supported or tested. The single file runs as `node
evals-baseline.mjs check <run-file>`, and its first line names the package and specification
versions it was generated from. To verify a copy, compare `shasum -a 256 evals-baseline.mjs`
against the value `dist/manifest.json` lists under `generated` for `dist/evals-baseline.mjs` at the
same commit.

One wrinkle worth knowing: the package installs its command into `node_modules/.bin`, which is not
on your `PATH`, so a bare `evals-baseline` fails with `command not found`. Run it through `npx`,
from the project where you installed it. The hints the tool prints omit the `npx`; add it.

## How a run is compared

`check` reads two files and prints. It writes nothing, ever.

It prints a header naming the baseline and what the run holds, a `date:` line giving the day the
baseline was recorded, then any findings, then any notes, then a summary. The date line matters
more than it looks: a baseline recorded eleven months ago is describing a suite that may no longer
exist.

A **finding** is a line beginning with an identifier such as `below-baseline`. A **note** begins
with `note:` and is never a finding. The distinction is deliberate — some differences deserve
mention without deserving a failure.

Here is a check that found both kinds at once, run against a deliberately degraded fixture that
ships with the repository:

```text
$ npx evals-baseline check run-fewer-samples-and-a-drop.json --strict
evals-baseline 1.0.0 (specification 1.0) check "evals-baseline.json": promptfoo "0.125.1", 2 metrics, 3 cases
date: baseline recorded 2026-11-16, the same day as this check on 2026-11-16
cases-changed: the baseline was recorded from 3 cases (digest b4826cd2872c); this run holds 4 cases (digest e6c6ecf167ab); re-record if the change is intended
below-baseline "agent :: accuracy": 0.666667 over 3 samples is below the baseline 1 over 3 samples by 0.333333, more than the tolerance 0
note: "agent :: format": the baseline holds 3 samples and this run holds 4; more samples than the baseline are never a finding
evals-baseline: 2 findings; exit 1 (--strict)
```

Read the last two lines together. `accuracy` fell and failed the run. `format` also changed — it
gained a sample — and the tool says so plainly while refusing to call it a regression, because
more evidence is not worse evidence. Staying silent would leave a reader puzzling over a number
that moved for no stated reason; raising an alarm would be false. Saying it and explaining why it
is fine is the third option, and it is the one the tool takes.

That rule holds however large the rise. A metric whose baseline was recorded over 4 samples and
which now has 8 produces `note: "agent :: accuracy": the baseline holds 4 samples and this run holds 8; more samples than the baseline are never a finding`,
and `--strict` still exits 0 on it. Record again when you want the larger count to become the
baseline's.

These are the findings it can print:

| Finding | When |
| --- | --- |
| `below-baseline` | a metric fell further than its tolerance; the line gives both values and both sample counts |
| `missing-metric` | the baseline names a metric this run does not have |
| `sample-count` | a metric has fewer samples than the baseline holds |
| `unreadable-metric` | the baseline names a metric the reader refuses to read |
| `cases-changed` | the run's cases differ from the baseline's, so the baseline may no longer describe this suite; this never fails the run |
| `no-baseline` | there is no baseline file, so nothing was compared |
| `bad-baseline` | the baseline cannot be read: not JSON, a repeated key, an unknown or missing key, a bad value, a `spec` that is not MAJOR.MINOR (`1.0`, never `1.0.0`, `1.00` or `01.00`), or a specification this version does not read |
| `bad-run` | the run file cannot be read, or was written by a different tool than the baseline's |
| `internal-error` | the reader or the comparison threw something that was not a refusal |

## What the exit code tells you

Most gates answer in two states, pass or fail, and that is one state too few. "Your model got
worse" and "I could not evaluate anything" both arrive as a red build, and the person debugging
starts in the wrong place.

This tool answers in four:

| Exit | Meaning | Where to look |
| --- | --- | --- |
| 0 | nothing fell | nowhere |
| 1 | a metric regressed | your model, prompts or data |
| 2 | the command was wrong | the workflow line |
| 3 | nothing could be evaluated | your setup: a missing baseline, an unreadable file |

Exit 3 is the one worth internalising. It does not mean your evaluations got worse. It means the
tool never managed to compare anything, and a build that treats it as a regression sends someone
hunting a problem that is not there.

Without `--strict`, `check` exits 0 whatever it finds, so you can introduce it to a pipeline
without breaking anything. With `--strict`, a regression exits 1 and a could-not-evaluate exits 3.
When both are present, the regression wins, because a real fall outranks a setup problem.
`record` and `show` exit 3 when they refuse a file, for the same reason: a refusal is not a
regression. A usage error always exits 2 and prints to stderr, with or without `--strict`.

That non-strict default has a sharp edge. A pipeline whose evaluation step silently wrote nothing
stays green:

```text
$ npx evals-baseline check missing.json
evals-baseline 1.0.0 (specification 1.0) check "evals-baseline.json": promptfoo "0.125.1", 2 metrics, 4 cases
date: baseline recorded 2026-11-12, the same day as this check on 2026-11-12
bad-run: cannot read "missing.json": not found
evals-baseline: 1 finding; warning only, exit 0 (pass --strict to exit 3)
```

Once the baseline is committed and you trust it, turn on `--strict`, so that a missing run file or
a missing baseline fails the build instead of passing it quietly.

## Recording and re-recording

`record` writes the baseline and nothing else. Nothing updates it automatically — not a pass, not
a failure. It changes when a person runs `record` and commits, which is the point: the baseline is
a deliberate statement about what good looks like, not a running average that drifts.

For a metric the baseline has not seen, `record` needs `--tolerance <n>` and stores that number.
For a metric it already holds, `record` keeps the stored tolerance, and `--tolerance` must either
be omitted or name that same number. If the old baseline would have reported findings against the
new run, they are listed under `replaced:` so you can see what you are accepting. If the new
baseline would be identical but for the timestamp and tool version, `record` prints `unchanged` and
leaves the file alone.

`record` refuses, exits 3 and writes nothing when the run file cannot be read, has errored samples,
holds no cases, or holds no guardable metric; when an existing baseline cannot be read, because
recording over it would discard its tolerances; when no tolerance was given and a metric has none;
when `--tolerance` disagrees with a tolerance already held; or when the baseline cannot be written.

Two of those refusals are worth seeing, because you will meet them early:

```text
$ npx evals-baseline record results.json
evals-baseline 1.0.0 (specification 1.0) record: refused: no tolerance was given for 2 metrics, and a tolerance of 0 reports a fall of any size; pass --tolerance <n> to set one, or --tolerance 0 to accept 0; nothing written

$ npx evals-baseline record results.json --tolerance 0.05
evals-baseline 1.0.0 (specification 1.0) record: refused: --tolerance 0.05 would change the tolerance of 2 metrics that the baseline already holds, and record keeps those; edit them in the baseline, or leave --tolerance out; nothing written
note: "agent :: accuracy": the baseline holds the tolerance 0.3
note: "agent :: format": the baseline holds the tolerance 0.3
```

Each refusal ends with `nothing written`. A refused `record` never leaves a partly-written file
behind, including when the disk fills mid-write: the baseline is written to a temporary file and
moved into place in one step, so you keep either the old file entire or the new one entire.

To see what the reader extracted without writing anything, use `show`:

```text
$ npx evals-baseline show results.json
evals-baseline 1.0.0 (specification 1.0) show "results.json": promptfoo "0.125.1" (promptfoo-results-3), 2 metrics, 4 cases (digest e6c6ecf167ab)
metric "agent :: accuracy"  1  4 samples
metric "agent :: format"  1  4 samples
```

## Choosing a tolerance from your own noise

A tolerance of 0 reports a drop of any size, and on a non-deterministic suite that means some
identical runs will report findings. How much spread your suite has depends on your model, your
judge and your cases, so this project refuses to suggest a starting number. Measure it instead.

Run the suite five times with nothing changed, and keep all five run files. If your tool caches
model answers, turn the cache off first — a cached rerun replays the earlier answers and shows a
spread of zero that is not real. promptfoo caches by default; `promptfoo eval --no-cache` turns it
off ([promptfoo caching](https://www.promptfoo.dev/docs/configuration/caching/), read 2026-11-15).

Run `show` on each file and note each metric's value. For each metric, take the **sample** standard
deviation of its five values and multiply by 3. Sample standard deviation divides by four, the
number of runs less one: `STDEV.S` in a spreadsheet, `statistics.stdev` in Python. `STDEV.P`,
`statistics.pstdev` and `numpy.std` divide by five by default and give a tolerance that is too
tight.

Then record from one of the five files. If one number suits every metric, pass it directly:
`npx evals-baseline record results-1.json --tolerance 0.04`. Otherwise pass `--tolerance 0`, open
`evals-baseline.json`, and set each metric's tolerance by hand. Commit the result.

The spread belongs to the model, judge and cases that produced it. Measure again when any of them
changes.

Where the 3 comes from: five values have four degrees of freedom, and the one-sided 95% value of
the t distribution for four is 2.13. A later run is compared against a baseline that is itself one
run, and the difference between two runs varies √2 times as much as one run does, so the multiplier
is 2.13 × √2 = 3.01. In simulations of unchanged suites, a tolerance of 3 standard deviations
reported a finding on 4 to 6 of every 100 later runs, and 4 standard deviations on 1.5 to 3 of
every 100. Those simulations used pass-or-fail samples, 30 to 250 per run, pass rates from 0.5 to
0.98, with normally distributed scores and a baseline drawn from the five runs. A tolerance set to
the largest observed difference between two runs — which needs only two runs, and is therefore
tempting — reported a finding on 18 to 25 of every 100. Five runs cost five times the tokens of
one, and two and a half times the tokens of two.

Five runs can agree exactly. The standard deviation is then 0, and so is the tolerance. With 50
samples and a pass rate of 0.98 that happens to about 1.4 of every 100 sets of five runs — and a
cache that served the reruns produces it too. Check the cache before trusting a spread of zero: it
means five runs showed none, not that there is none.

Setting a tolerance is choosing the smallest regression you want to catch. Where each sample
passes or fails, one sample moves a metric by one divided by the sample count: a fall of 0.25 over
4 samples is a single case, and a tolerance of 0.03 over 100 samples permits up to 3 cases to fall.
Where samples carry weights or continuous scores, a tolerance is still a number in the metric's
unit and does not count samples.

If a later check reports a drop you judge to be noise, widen that metric's tolerance by hand.
`record` keeps what a metric already holds and refuses a `--tolerance` that disagrees:

```json
"agent :: accuracy": {
  "value": 1,
  "samples": 4,
  "tolerance": 0.3
}
```

A key the baseline does not allow — a misspelt `tolerance`, say — makes `check` print
`bad-baseline` and makes `record` refuse to overwrite the file, so a typo cannot silently reset
your tolerances.

## Why a baseline rather than a threshold

promptfoo can already fail a run below a pass rate. Its command-line page describes
`PROMPTFOO_PASS_RATE_THRESHOLD` as "Set a minimum pass rate threshold (as a percentage). If not
set, defaults to 100% (no failures allowed)" ([promptfoo command
line](https://www.promptfoo.dev/docs/usage/command-line/), read 2026-11-12).

A threshold and a baseline differ in three ways. A threshold is one percentage for the whole run,
where a baseline holds a value and a tolerance per metric. A threshold lives in a workflow line, so
the repository records nothing about when it was last true, where a baseline is a committed file
whose recording date is printed on every check. And a bar of 80 lets a metric fall from 0.98 to
0.81 and still pass.

That third point is measured, not argued. promptfoo 0.125.1 ran 100 synthetic cases with one
metric, `accuracy`, against a local provider that answers wrong for a fixed number of cases. The
baseline was recorded from a run scoring 0.98.

| Cases failing | `PROMPTFOO_PASS_RATE_THRESHOLD` | promptfoo exits | `check --strict` on the same run |
| --- | --- | --- | --- |
| 2 of 100 | not set | 100 | no findings, exit 0 |
| 2 of 100 | 80 | 0 | no findings, exit 0 |
| 19 of 100 | not set | 100 | exit 1: 0.81 over 100 samples is below the baseline 0.98 by 0.17 |
| 19 of 100 | 80 | 0 | exit 1: 0.81 over 100 samples is below the baseline 0.98 by 0.17 |
| 21 of 100 | 80 | 100 | exit 1: 0.79 over 100 samples is below the baseline 0.98 by 0.19 |

With the default of 100, promptfoo exits non-zero on any failing case, including the 2 in the first
row — so a suite with a handful of permanently failing cases needs a lower bar. The lower bar is
exactly what hides the drop: in row four, promptfoo printed `✗ 19 failed (19.00%)` and exited 0.

## A file, not a service

The baseline lives in your repository. There is no account to create, no quota to exceed, and
nothing to lose when a vendor changes plans. Three hosted evaluation products published the
following on their own pages, read on 2026-11-12:

- OpenAI: "Evals will become read-only for existing users on October 31, 2026, and the platform is
  scheduled to shut down on November 30, 2026." ([Working with
  evals](https://developers.openai.com/api/docs/guides/evals))
- Braintrust: the Starter plan, "$0 / month", lists "14-day retention."
  ([pricing](https://www.braintrust.dev/pricing))
- Confident AI: the Free plan lists "5 test runs per week."
  ([pricing](https://www.confident-ai.com/pricing))

This tool has no retention period and no run limit, because it reads two files and prints.

## Producing a run file

**promptfoo.** `promptfoo eval --output results.json` writes a results file whose format follows
the extension; give the tool the JSON. Only assertions carrying `metric: <name>` produce a named
score, so only those can be guarded. A suite with none has nothing to guard: `record` refuses it,
and `show` says what to add.

**DeepEval.** DeepEval writes the rolling file `.latest_run_full.json` inside `.deepeval`. When
`DEEPEVAL_RESULTS_FOLDER` names a folder, it also writes `test_run_<YYYYMMDD_HHMMSS>.json` there
with the same content. Either file works. The other rolling file, `.latest_test_run.json`, wraps
its run in a `testRunData` key and is refused — the message names the file to use instead. DeepEval
stores runs as JSON by default; under `DEEPEVAL_LOCAL_STORE=sqlite` the file is not JSON and is
refused.

A DeepEval project is a Python project, and this tool runs on Node.js, which a Python-only
environment may lack. On GitHub Actions, add this before the step that runs the package or the
copied file. The Action itself runs on the runner's `node24` runtime and needs no such step.

```yaml
- uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
  with:
    node-version: 22
```

## Running it in a workflow

Run the Action after the step that writes the run file, in a job that has checked out the
repository, because the baseline is read from the workspace. Grant `contents: read` and nothing
more: the Action takes no token and opens no network connection.

```yaml
name: evals
on: pull_request
permissions:
  contents: read
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 22
      - run: npx promptfoo@0.125.1 eval --output results.json
      - uses: evals-baseline/evals-baseline@<full-length commit SHA>
        if: always()
        with:
          run-file: results.json
```

The `run` step is your own evaluation, and it has to write the file `run-file` names. The two
`actions/` lines are pinned to the commits of actions/checkout v7.0.1 and actions/setup-node
v7.1.0.

The `if: always()` is not decoration. promptfoo exits 100 when a test fails unless
`PROMPTFOO_FAILED_TEST_EXIT_CODE` is `0`, and a step after a failed step does not run — so without
it, the check is skipped precisely when a run went badly. Setting
`PROMPTFOO_FAILED_TEST_EXIT_CODE: '0'` in the evaluation step's `env` is the other way. Which you
prefer is your decision.

As written, this workflow warns and passes. When you trust the baseline, add `strict: 'true'` to
the Action's `with`, and a finding fails the job.

| Input | Default | Meaning |
| --- | --- | --- |
| `run-file` | none, required | the run file, relative to the workspace |
| `baseline` | `evals-baseline.json` | the baseline, relative to the workspace |
| `strict` | `false` | `true` runs `check --strict`; any other value is off |

Only the lowercase `true` turns the gate on. `TRUE`, `yes` and `1` leave it off and the Action
still exits 0.

The Action prints the lines the command prints, and additionally writes one workflow annotation per
finding, so findings are visible on the run page without opening the log — a warning normally, an
error under `strict` for each finding that fails the run. GitHub displays at most 10 annotations of
each type per step; when more are produced, the tool says how many were not shown, rather than
letting them disappear. The output `findings` is the number of findings, as a string.

`action.yml` declares the `node24` runtime. For a self-hosted runner, the release notes of
actions/checkout v5.0.0 — the release that moved to `node24` — give 2.327.1 as the minimum
compatible runner version ([release
notes](https://github.com/actions/checkout/releases/tag/v5.0.0), read 2026-11-12).

## Pinning the Action to a commit

Replace `<full-length commit SHA>` with the 40-character SHA of the commit a release tag points to.
Tags are on the [tags page](https://github.com/evals-baseline/evals-baseline/tags). A tag can be
moved or deleted; a commit SHA names one commit forever. GitHub's own guidance on [using
SHAs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/find-and-customize-actions#using-shas)
is to use the full SHA rather than an abbreviation.

Use the SHA of the commit, not of the tag. For an annotated tag, `git rev-parse v1.0.0` prints the
SHA of the tag object, which is a different thing. `git rev-parse 'v1.0.0^{commit}'` prints the
commit SHA for any tag. Without a clone, `git ls-remote
https://github.com/evals-baseline/evals-baseline 'refs/tags/v1.0.0' 'refs/tags/v1.0.0^{}'` prints
one line, or two for an annotated tag, and the SHA on the last line is the commit.

The repository also publishes a moving `v1` tag. A workflow using
`evals-baseline/evals-baseline@v1` runs whatever commit that tag points to on the day it runs, and
the repository's author can move it. The promise for `v1` is that it never breaks. It is the only
tag that moves: there is no `latest` and no floating minor.

## Text that came from your files

Every report line puts text originating in a run file, a baseline or the command line between
double quotes, as in `below-baseline "agent :: accuracy": ...`. Inside those quotes a double quote
is written `\u0022` and a backslash `\\`, so a name cannot close its own quotes early.

The report prints a space and the characters a person can actually see — letters, marks, numbers,
punctuation, symbols — and writes everything else as an escape. A zero-width joiner becomes
`\u200d`, a soft hyphen `\u00ad`, and a character from the Tags block, which holds an invisible
copy of ASCII, becomes `\u{e0069}`. A `[` following `##` becomes `\u005b`. A metric name therefore
cannot start a line, open a workflow command, forge a finding, or smuggle a sentence that only a
machine will read. `record` writes the baseline under the same rule, so the committed file holds no
invisible characters either.

Which characters count as visible is not left to the machine's opinion. Node's Unicode tables
change between major versions — the same file read on two Node versions can disagree about
thousands of code points — so this tool carries its own pinned table rather than asking the
runtime. Two machines running different Node versions produce identical baseline bytes.

None of this makes a name safe to obey. Escaping and quoting stop a forged line and an invisible
payload. They do not stop one of your own metric names from containing an instruction in plain
letters: the report prints it between quotes, and a human or a program reading that report can
still act on it. Treat quoted text as data from your files, never as an order.

## Removing it

Delete `evals-baseline.json`, delete the workflow step, and if you installed the package,
`npm uninstall evals-baseline`. `check` writes nothing, so there is nothing else to clean up.

## Support

This is a one-person project with no support agreement and no response time. Report a bug in an
[issue](https://github.com/evals-baseline/evals-baseline/issues), and a security flaw by email as
[SECURITY.md](SECURITY.md) describes. [CONTRIBUTING.md](CONTRIBUTING.md) lists what is welcome and
what this repository refuses permanently.

## Citing it

Paste this into the README of a project that uses it:

```markdown
This project guards its agent evaluations against regression as defined by the [evals-baseline specification 1.0](https://meshin.co/spec/evals-baseline/1.0).
```

## Licence

evals-baseline is licensed under the Apache License, Version 2.0, and the copyright holder is
Dmitri Meshin. The full text is in [LICENSE](LICENSE). The licence grants patent rights explicitly,
and does not grant permission to use the licensor's trade marks or names.
