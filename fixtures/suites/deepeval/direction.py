import json
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

CASES = [("France", "Paris"), ("Japan", "Tokyo"), ("Peru", "Lima"), ("Kenya", "Nairobi")]


def build_judge():
    from deepeval.models import DeepEvalBaseLLM

    class StubJudge(DeepEvalBaseLLM):
        def __init__(self):
            pass

        def load_model(self):
            return self

        def get_model_name(self):
            return "stub-judge"

        def generate(self, prompt, schema=None):
            return self.generate_with_schema(prompt, schema=schema)

        async def a_generate(self, prompt, schema=None):
            return self.generate_with_schema(prompt, schema=schema)

        def generate_with_schema(self, prompt, schema=None):
            text = prompt if isinstance(prompt, str) else json.dumps(prompt)
            flagged = "BIASED" in text
            name = schema.__name__
            if name == "Opinions":
                return schema(opinions=["BIASED opinion" if flagged else "A neutral opinion"])
            if name == "Verdicts":
                verdict = "yes" if flagged else "no"
                item_cls = schema.model_fields["verdicts"].annotation.__args__[0]
                return schema(verdicts=[item_cls(verdict=verdict, reason="stub reason")])
            field = list(schema.model_fields)[0]
            return schema(**{field: "stub reason"})

        async def a_generate_with_schema(self, prompt, schema=None):
            return self.generate_with_schema(prompt, schema=schema)

    return StubJudge()


def accuracy_metric():
    from deepeval.metrics import BaseMetric

    class AccuracyMetric(BaseMetric):
        def __init__(self):
            self.threshold = 0.5

        def measure(self, test_case, *args, **kwargs):
            self.score = 1.0 if test_case.expected_output in test_case.actual_output else 0.0
            self.success = self.score >= self.threshold
            return self.score

        async def a_measure(self, test_case, *args, **kwargs):
            return self.measure(test_case)

        def is_successful(self):
            return self.success

        @property
        def __name__(self):
            return "Accuracy"

    return AccuracyMetric()


def run(threshold, strict, biased_for):
    from deepeval import evaluate
    from deepeval.evaluate.configs import AsyncConfig, DisplayConfig, ErrorConfig
    from deepeval.metrics import BiasMetric
    from deepeval.test_case import LLMTestCase

    test_cases = [
        LLMTestCase(
            input=question,
            actual_output=("BIASED " if question in biased_for else "") + expected,
            expected_output=expected,
        )
        for question, expected in CASES
    ]
    kwargs = dict(model=build_judge(), include_reason=False, async_mode=False, strict_mode=strict)
    if threshold != "default":
        kwargs["threshold"] = threshold
    evaluate(
        test_cases=test_cases,
        metrics=[accuracy_metric(), BiasMetric(**kwargs)],
        async_config=AsyncConfig(run_async=False),
        display_config=DisplayConfig(show_indicator=False, inspect_after_run=False),
        error_config=ErrorConfig(ignore_errors=False),
    )


def main():
    threshold_text, strict_text, biased_text, output = sys.argv[1:5]
    threshold = "default" if threshold_text == "default" else (None if threshold_text == "none" else float(threshold_text))
    strict = strict_text == "strict"
    biased_for = [] if biased_text == "none" else biased_text.split(",")
    origin = Path.cwd()
    work = Path(tempfile.mkdtemp(prefix="deepeval-direction-"))
    os.environ.setdefault("DEEPEVAL_RESULTS_FOLDER", str(work / "results"))
    os.chdir(work)
    try:
        run(threshold, strict, biased_for)
        source = work / ".deepeval" / ".latest_run_full.json"
        target = Path(output)
        if not target.is_absolute():
            target = origin / target
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    finally:
        os.chdir(origin)
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
