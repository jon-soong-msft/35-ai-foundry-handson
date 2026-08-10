Your eight committee agents already live in the project, authored in Lab 2. In code you don't recreate them — you **bind to them by name** and let the Agent Framework drive them. This module wires up all eight so the later orchestration modules can just import them.

## Objectives

- Understand the two ways code talks to Foundry: **bind an existing agent** vs. **declare one in code**.
- Bind the **eight portal agents** by their exact names.
- Confirm each responds from Python.

## Concepts — two client shapes

| Shape | When | Import |
|---|---|---|
| **Bind to a portal/service agent by name** — instructions, tools, and JSON schema live on the service | Reuse what you authored in the portal (this lab) | `FoundryAgent(agent_name=…, project_endpoint=…, credential=…)` from `agent_framework.foundry` |
| **Declare an agent in code** over a model deployment | The app owns the instructions/tools | `Agent(client=FoundryChatClient(…), instructions=…)` |

Lab 3 leads with **binding by name** (the hybrid model). `src/agents.py` also ships a code‑declared fallback that rebuilds each agent from the instruction text in `foundry-workflow/agents.md`, in case your tenant's preview binding differs.

> [!WARNING]
> The **names must match exactly** what you created in Lab 2 — the orchestration references them by name. They are: `Loan-Intake-Agent`, `Financial-Enrichment-Agent`, `Credit-Risk-Analyst`, `Fraud-AML-Analyst`, `Compliance-Policy-Officer`, `Credit-Committee-Chair`, `Decision-Letter-Agent`, `Underwriter-Briefing-Agent`.

## Steps

- [ ] Open `src/agents.py` and read the name constants and the `bind()` factory.

- [ ] The core of the hybrid binding looks like this:

  ```python
  from agent_framework.foundry import FoundryAgent
  from .config import project_endpoint, credential

  def bind(agent_name: str):
      # Bind to an agent authored in the portal (Lab 2). VERIFY the exact
      # factory against current preview docs — the surface is evolving.
      # FoundryAgent binds to an existing service agent by name and is itself runnable.
      return FoundryAgent(
          agent_name=agent_name,
          project_endpoint=project_endpoint(),
          credential=credential(),
      )
  ```

- [ ] List and ping every agent: `python -m src.run --list-agents`. Each of the eight should return a short reply, confirming the binding.

- [ ] If binding fails in your tenant, switch to the fallback: `python -m src.run --list-agents --from-code` (rebuilds the agents on `FoundryChatClient` from their Lab 2 instructions).

> [!NOTE]
> **Why keep the fallback?** It keeps the lab runnable across preview drift and doubles as a teaching contrast: the *same* agent, once bound from the service and once declared in code. In production you'd pick one path.
