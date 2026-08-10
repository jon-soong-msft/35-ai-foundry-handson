Agents don't automatically remember anything between turns — memory is something you *arrange*. This short concept module explains the two kinds of state in your Meridian workflow and how they map back to Lab 2's `Local.*` variables.

## Objectives

- Distinguish **conversation memory** (a thread/session) from **workflow state** (shared, cross‑executor).
- See where the underwriting fact sheet and the committee recommendation live as they flow between stages.

## Concepts — two kinds of memory

| Kind | What it holds | Agent Framework |
|---|---|---|
| **Conversation memory** | The running dialogue an agent sees | An **agent session / thread** (`AgentThread`) attached to a run |
| **Workflow state** | Structured values passed between executors and branches | **Shared state** (`ctx.set_state()` / `get_state()`) and typed messages between executors |

In Lab 2 both jobs were done by `Local.*` variables (`Local.factSheet`, `Local.committeeText`, `Local.humanDecision`, …) because the portal workflow had no other memory model. In code they split cleanly:

- The **fact sheet** and **committee recommendation** are **workflow state / typed messages** — they move between the intake, committee, gate, and letter stages.
- Each agent's own back‑and‑forth is its **session**, which the orchestration keeps in sync (in a group chat / Magentic run, the manager broadcasts each turn so every specialist stays current).

```python
# Carrying a result forward as shared workflow state
await ctx.set_state("fact_sheet", fact_sheet)
...
fact_sheet = await ctx.get_state("fact_sheet")
```

> [!TIP]
> **Why this matters for evaluation and tracing.** Because state is explicit, you can snapshot the fact sheet and recommendation at each hop — which is exactly what the eval harness (Module 08) scores and what the traces (Module 09) show.

## Steps

- [ ] In `src/workflow.py`, find where the fact sheet is captured after intake and read back before the committee — the code twin of `Local.factSheet`.

- [ ] Map each Lab 2 `Local.*` variable to its Lab 3 home using the table above. Keep the note handy — Module 08 evaluates these exact values.
