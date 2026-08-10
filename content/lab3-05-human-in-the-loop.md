This is the module the whole lab is built around. When the committee flags a **material** decision, the run must **pause** and wait for a Senior Underwriter to reply **APPROVE / DECLINE / REVISE** before it can finish. The Agent Framework gives you a first‑class primitive for exactly this: **request / response**.

## Objectives

- Implement the sign‑off gate with `ctx.request_info()` and `@response_handler`.
- Drive the **pause → human decides → resume** loop from `src/run.py`.
- Apply Meridian's delegated‑authority policy so clean deals never bother a human.

## Concepts — request/response HITL

An **executor** can send a request out of the workflow and suspend until an answer comes back. In Python that's `ctx.request_info(...)`; the reply is routed to a method you mark `@response_handler`. The run surfaces a `request_info` event carrying a `request_id`; you resume by calling `workflow.run(responses={request_id: …})`.

```python
from dataclasses import dataclass
from agent_framework import Executor, WorkflowContext, handler, response_handler

@dataclass
class SignoffRequest:
    briefing: str          # the Underwriter-Briefing-Agent's plain-English card
    recommendation: dict   # the Chair's JSON

class HumanSignoffExecutor(Executor):
    def __init__(self):
        super().__init__(id="human_signoff")

    @handler
    async def review(self, rec: dict, ctx: WorkflowContext) -> None:
        if requires_human_signoff(rec):
            await ctx.request_info(
                request_data=SignoffRequest(briefing=brief(rec), recommendation=rec),
                response_type=str,           # "APPROVE" | "DECLINE" | "REVISE"
            )
        else:
            await ctx.send_message(auto_finalize(rec))   # delegated authority

    @response_handler
    async def on_decision(self, req: SignoffRequest, decision: str, ctx: WorkflowContext) -> None:
        await ctx.send_message(apply_decision(req.recommendation, decision))
```

## The gate — who actually needs a human

`requires_human_signoff()` in `src/workflow.py` encodes Meridian's policy (same as Lab 2):

| Human sign‑off REQUIRED when ANY holds | Auto‑finalizes (delegated authority) |
|---|---|
| Requested amount **≥ $250,000** | `ApproveWithConditions` |
| Decision = **Decline** | Fraud/AML = **REVIEW** |
| Compliance = **NOT_COMPLIANT** | Compliance = **CONDITIONS** |
| Fraud/AML = **FLAGGED** | |
| Credit band **Marginal / Poor** | |

## Steps

- [ ] Read `HumanSignoffExecutor` and `requires_human_signoff()` in `src/workflow.py`.

- [ ] Run the **clean** deal — it should **never** pause: `python -m src.run --sample small`. Confirm it auto‑finalizes.

- [ ] Run the **borderline** deal: `python -m src.run --sample large`. The run **pauses** and prints the sign‑off card.

- [ ] Reply at the prompt with `APPROVE` (or `DECLINE` / `REVISE`) and watch the workflow resume and produce the decision letter.

- [ ] Look at the resume call in `src/run.py`: it collects the `request_info` event's `request_id`, then re‑runs with `responses={request_id: decision}`.

> [!TIP]
> `REVISE` sends the deal back for another committee round — the code twin of Lab 2's re‑ask loop. Try it and watch the manager re‑plan.
