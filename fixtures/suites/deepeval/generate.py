import os
import shutil
import sys
import tempfile
from pathlib import Path

for key in ("OPENAI_API_KEY", "CONFIDENT_API_KEY"):
    os.environ.pop(key, None)
os.environ["DEEPEVAL_TELEMETRY_OPT_OUT"] = "YES"
os.environ["DEEPEVAL_NO_INSPECT_PROMPT"] = "1"
os.environ.pop("DEEPEVAL_LOCAL_STORE", None)

CASES = [
    ("France", "Paris"),
    ("Japan", "Tokyo"),
    ("Peru", "Lima"),
    ("Kenya", "Nairobi"),
]
ITALY_CASE = ("Italy", "Rome")
PERU_INPUT = "Peru"
KENYA_INPUT = "Kenya"

RUN_FILE = ".latest_run_full.json"
WRAPPED_FILE = ".latest_test_run.json"


def good_agent(question, answers):
    return answers[question]


def worse_agent(question, answers):
    if question == KENYA_INPUT:
        return "Mombasa"
    return answers[question]


def build_metrics(names, fail_on=None):
    from deepeval.metrics import BaseMetric, ExactMatchMetric, PatternMatchMetric

    import re

    class AccuracyMetric(BaseMetric):
        def __init__(self):
            self.threshold = 0.5

        def measure(self, test_case, *args, **kwargs):
            if fail_on is not None and test_case.input == fail_on:
                raise RuntimeError("Accuracy failed on " + test_case.input)
            self.score = (
                1.0 if test_case.expected_output in test_case.actual_output else 0.0
            )
            self.success = self.score >= self.threshold
            return self.score

        async def a_measure(self, test_case, *args, **kwargs):
            return self.measure(test_case)

        def is_successful(self):
            return self.success

        @property
        def __name__(self):
            return "Accuracy"

    class FormatMetric(BaseMetric):
        def __init__(self):
            self.threshold = 0.5

        def measure(self, test_case, *args, **kwargs):
            if fail_on is not None and test_case.input == fail_on:
                raise RuntimeError("Format failed on " + test_case.input)
            self.score = (
                1.0 if re.match(r"^[A-Z][a-z]+$", test_case.actual_output) else 0.0
            )
            self.success = self.score >= self.threshold
            return self.score

        async def a_measure(self, test_case, *args, **kwargs):
            return self.measure(test_case)

        def is_successful(self):
            return self.success

        @property
        def __name__(self):
            return "Format"

    class BrevityMetric(BaseMetric):
        def measure(self, test_case, *args, **kwargs):
            self.score = 1.0 if len(test_case.actual_output) <= 10 else 0.0
            return self.score

        async def a_measure(self, test_case, *args, **kwargs):
            return self.measure(test_case)

        def is_successful(self):
            return self.success

        @property
        def __name__(self):
            return "Brevity"

    class FailureRateMetric(BaseMetric):
        def __init__(self):
            self.threshold = 0.5

        def measure(self, test_case, *args, **kwargs):
            self.score = 0.0
            self.success = self.score <= self.threshold
            return self.score

        async def a_measure(self, test_case, *args, **kwargs):
            return self.measure(test_case)

        def is_successful(self):
            return self.success

        @property
        def __name__(self):
            return "Failure rate"

    factories = {
        "Accuracy": AccuracyMetric,
        "Format": FormatMetric,
        "Brevity": BrevityMetric,
        "Failure rate": FailureRateMetric,
        "Exact Match": ExactMatchMetric,
        "Pattern Match": lambda: PatternMatchMetric(pattern=r"^[A-Z][a-z]+$"),
    }
    return [factories[name]() for name in names]


BASE_METRICS = ["Accuracy", "Format"]

VARIANTS = {
    "good": {},
    "good-again": {},
    "worse": {"agent": worse_agent},
    "nometric": {"metrics": ["Accuracy"]},
    "extra": {"metrics": BASE_METRICS + ["Exact Match", "Pattern Match"]},
    "drop-one": {"cases": CASES[:3]},
    "swap": {"cases": CASES[:3] + [ITALY_CASE]},
    "error-one": {"fail_on": PERU_INPUT, "ignore_errors": True},
    "score-only": {"metrics": BASE_METRICS + ["Brevity"]},
    "inverted": {"metrics": BASE_METRICS + ["Failure rate"]},
    "wrapped": {"source": WRAPPED_FILE},
}


def run(variant):
    from deepeval import evaluate
    from deepeval.evaluate.configs import (
        AsyncConfig,
            DisplayConfig,
        ErrorConfig,
    )
    from deepeval.test_case import LLMTestCase

    spec = VARIANTS[variant]
    cases = spec.get("cases", CASES)
    agent = spec.get("agent", good_agent)
    answers = dict(cases)
    test_cases = [
        LLMTestCase(
            input=question,
            actual_output=agent(question, answers),
            expected_output=expected,
        )
        for question, expected in cases
    ]
    metrics = build_metrics(
        spec.get("metrics", BASE_METRICS), fail_on=spec.get("fail_on")
    )
    evaluate(
        test_cases=test_cases,
        metrics=metrics,
        async_config=AsyncConfig(run_async=False),
        display_config=DisplayConfig(show_indicator=False, inspect_after_run=False),
        error_config=ErrorConfig(ignore_errors=spec.get("ignore_errors", False)),
    )


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in VARIANTS:
        sys.exit("usage: generate.py <" + "|".join(VARIANTS) + "> <output-file>")
    variant = sys.argv[1]
    output = Path(sys.argv[2]).resolve()
    origin = Path.cwd()
    work = Path(tempfile.mkdtemp(prefix="deepeval-fixture-"))
    os.environ.setdefault("DEEPEVAL_RESULTS_FOLDER", str(work / "results"))
    os.chdir(work)
    try:
        run(variant)
        source = work / ".deepeval" / VARIANTS[variant].get("source", RUN_FILE)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, output)
    finally:
        os.chdir(origin)
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
