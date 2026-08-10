"""Evaluation harness (Module 08).

Scores the committee over the two Meridian deals and gates on the human-signoff
decision being correct (small -> no human, large -> human). The azure-ai-evaluation
wiring is sketched at the bottom; VERIFY evaluator names against your SDK.
"""
from __future__ import annotations

import asyncio

from . import workflow as wf
from .samples import EXPECTED, SAMPLES


async def _run_committee_for_eval(sample_key: str) -> dict:
    sample = SAMPLES[sample_key]
    result = await wf.build_committee_workflow().run(sample)
    outputs = result.get_outputs()
    deliberation = getattr(outputs[-1], "text", None) or str(outputs[-1])
    return await wf.synthesize_recommendation(sample, deliberation)


def signoff_gate_correct(rec: dict, expected_human: bool) -> bool:
    return wf.requires_human_signoff(rec) is expected_human


async def main() -> None:
    passed = 0
    for key, expected_human in EXPECTED.items():
        rec = await _run_committee_for_eval(key)
        ok = signoff_gate_correct(rec, expected_human)
        passed += int(ok)
        print(
            f"{key:6}  requiresHumanSignoff expected={expected_human!s:5}  ->  "
            f"{'PASS' if ok else 'FAIL'}"
        )
    total = len(EXPECTED)
    print(f"\nsignoff_correct.pass_rate = {passed}/{total}")

    # A fuller harness would also call azure-ai-evaluation.evaluate(...) with built-in
    # evaluators (relevance, groundedness) plus this custom gate, emitting metrics to
    # your Foundry project. VERIFY evaluator names + model_config against current docs:
    # https://learn.microsoft.com/azure/ai-foundry/how-to/develop/evaluate-sdk
    assert passed == total, "human-signoff gate regressed"


if __name__ == "__main__":
    asyncio.run(main())
