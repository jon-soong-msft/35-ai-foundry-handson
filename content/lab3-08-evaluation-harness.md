A single good run isn't proof. Before you'd ship this, you want a **repeatable evaluation** over known cases that **fails the build** when quality regresses. This module runs the committee over a small dataset in code and scores it.

## Objectives

- Run an **evaluation harness** over the two sample applications from code.
- Score the committee's output with Foundry evaluators.
- Assert **quality gates** and see results flow to your project.

## Concepts — evaluation as code

In Lab 1 you ran a one‑off evaluation in the portal. Here you drive it from code so it can live in CI: a **dataset** of inputs (+ expected signals), a **target** (your workflow), and a set of **evaluators** that score each row.

```python
# src/evaluate.py  — shape only; VERIFY evaluator names against azure-ai-evaluation
from azure.ai.evaluation import evaluate, RelevanceEvaluator, GroundednessEvaluator

results = evaluate(
    data="samples/eval_dataset.jsonl",          # the two Meridian deals + expected flags
    target=run_committee_for_eval,               # wraps build_committee_workflow()
    evaluators={
        "relevance": RelevanceEvaluator(model_config),
        "groundedness": GroundednessEvaluator(model_config),
        "signoff_correct": signoff_gate_evaluator,   # custom: did requiresHumanSignoff match?
    },
)
assert results["metrics"]["signoff_correct.pass_rate"] == 1.0   # quality gate
```

> [!NOTE]
> The most valuable evaluator here is the **custom** one: for the *small* deal it asserts `requiresHumanSignoff == false`, and for the *large* deal `== true`. That single check guards the exact behavior the business cares about — the human gate firing on the right deals.

## Steps

- [ ] Open `src/evaluate.py` and read the dataset path, the target wrapper, and the evaluator set.

- [ ] Run the harness: `python -m src.evaluate`. It scores both deals and prints a metrics table.

- [ ] Confirm the **gate check passes** (small = no human, large = human). Then break it on purpose — lower the `$250,000` threshold in `requires_human_signoff()` — and watch the harness **fail**. Restore it.

- [ ] Open your project's **Evaluation / Observability** view and find this run (it's traced — see Module 09).

> [!IMPORTANT]
> This harness is the seed for **Lab 5 (AgentOps)**, where the same evaluators run **continuously** against sampled production traffic, not just these two rows.
