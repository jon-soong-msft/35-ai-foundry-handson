Now the interesting part: the **credit committee**. Three specialists — Risk, Fraud/AML, Compliance — deliberate, and a **manager** plans the discussion and synthesizes a decision. In Lab 2 this was a group‑chat with the Chair as moderator. In code you get a real **planner/orchestrator**: **Magentic**.

## Objectives

- Understand **Magentic** orchestration — a manager agent that *plans*, delegates, and adapts.
- Compose the three specialist agents under a manager.
- Produce the `committee_recommendation` JSON that drives the human gate.

## Concepts — Magentic = the planner/orchestrator

Magentic has the same shape as a group chat, but with a **powerful manager** that maintains a plan, tracks progress, picks who speaks next, and knows when the task is done. That is exactly the *"add a planner/orchestrator"* move in the Implementation Path.

```python
from agent_framework.orchestrations import MagenticBuilder
from .agents import bind, RISK, FRAUD_AML, COMPLIANCE, CHAIR

risk, fraud, compliance = bind(RISK), bind(FRAUD_AML), bind(COMPLIANCE)
manager = bind(CHAIR)  # the Credit-Committee-Chair plans + synthesizes

committee = MagenticBuilder(
    participants=[risk, fraud, compliance],
    manager_agent=manager,
    max_round_count=10,
    max_stall_count=3,
    max_reset_count=2,
).build()
```

> [!NOTE]
> **Magentic vs. Group Chat.** If you only need round‑robin moderation, `GroupChatBuilder` is simpler. Magentic earns its keep when the path isn't fixed — the manager re‑plans based on what Risk, Fraud, and Compliance surface. `src/workflow.py` ships both so you can compare.

## Steps

- [ ] Open `src/workflow.py` → `build_committee_workflow()` and read the manager/participant wiring.

- [ ] Run the committee on the small deal: `python -m src.run --stage committee --sample small`. Watch the streamed rounds — the manager delegating, the specialists reporting.

- [ ] Run it on the large deal: `python -m src.run --stage committee --sample large`. Confirm the final `committee_recommendation` sets **`requiresHumanSignoff: true`** (material amount / weaker credit).

- [ ] Note the `intermediate_output_from` list — that's what surfaces each specialist's turn as a traceable event (you'll see these in Module 09).

> [!IMPORTANT]
> The Chair's job is unchanged from Lab 2: weigh the three opinions and set `requiresHumanSignoff` using Meridian's delegated‑authority policy. The **gate logic** that reads that flag lives in the next module.
