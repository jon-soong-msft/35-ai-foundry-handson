The Meridian flow starts with a **deterministic pipeline**: parse the raw application, then compute the underwriting ratios. In Lab 2 that was two `InvokeAzureAgent` nodes wired in a line. In code it's a **Sequential orchestration** — two agents, output handed forward.

## Objectives

- Build a **Sequential** orchestration with `SequentialBuilder`.
- Run `Loan-Intake-Agent` → `Financial-Enrichment-Agent` and inspect the structured output.
- See how the JSON‑schema outputs you set in the portal survive into code.

## Concepts — Sequential orchestration

`SequentialBuilder(participants=[…])` runs agents one after another, each seeing the conversation so far. It's the code twin of Lab 2's sequential handoff — no `Local.*` variables, just the shared conversation.

```python
from agent_framework import SequentialBuilder
from .agents import bind, INTAKE, ENRICHMENT

intake = bind(INTAKE)
enrichment = bind(ENRICHMENT)

workflow = SequentialBuilder(participants=[intake, enrichment]).build()
```

## Steps

- [ ] Open `src/workflow.py` and find `build_intake_workflow()`.

- [ ] Run the intake pipeline against a sample: `python -m src.run --stage intake --sample small`. (Samples come from `foundry-workflow/sample-applications.md`.)

- [ ] Confirm the output is a clean **`underwriting_fact_sheet`** JSON — DSCR, LTV, credit band, policy checks — exactly the schema you set on the portal agent.

- [ ] Try the borderline deal: `python -m src.run --stage intake --sample large`. Note the higher amount and weaker ratios — this is the one that will later pull in a human.

> [!TIP]
> Because the JSON schema lives **on the portal agent**, your code doesn't re‑declare it. That's the payoff of the hybrid model: the contract is authored once, in the portal, and honored everywhere the agent runs.
