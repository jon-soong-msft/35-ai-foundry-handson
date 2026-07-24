In **Lab 1** you built a single **prompt agent** and gave it tools, knowledge, and a publish target. In **Lab 2** you compose *many* agents into one **multi‑agent workflow** — a declarative orchestration you assemble and run **entirely in the Microsoft Foundry portal**. This first module is a short concept overview: the scenario, the three orchestration patterns you will combine, and the eight agents that play the roles. The next three modules are hands‑on.

> [!NOTE]
> **Public preview + retirement notice.** Foundry **Workflows** (the visual multi‑agent designer and in‑portal execution) are in **public preview**, and Microsoft has announced the designer + in‑portal run experience will be **retired on Dec 1, 2026**, with the forward path being the **Microsoft Agent Framework**. The same declarative YAML you author here ports forward as a hosted agent, so the concepts and artifacts you build in this lab carry over. It is fully usable today and ideal for learning the orchestration patterns.

## Objectives

- Understand what a **multi‑agent workflow** is and how it differs from a single prompt agent.
- Learn the three orchestration patterns you will combine: **Sequential**, **Group chat**, and **Human‑in‑the‑loop (HITL)**.
- Meet the **eight agents** and the **variables** that carry state between them.
- Know exactly what you will build in Modules 2–4 of this lab.

## The scenario — Meridian Commercial Bank

You will build a **Commercial Loan Underwriting & Approval** workflow for a fictional bank, *Meridian Commercial Bank*. A business submits a loan application; your workflow takes it from raw text all the way to an applicant‑facing decision letter, passing through an automated intake pipeline, a deliberating credit committee, and — only when policy demands it — a human sign‑off.

This is a realistic financial‑services shape: **deterministic data preparation**, **multi‑expert judgement**, and a **governed human gate** for material decisions. It is a great vehicle for learning orchestration because each stage naturally maps to a different pattern.

## The three orchestration patterns

A workflow strings together **nodes** (invoke an agent, ask a question, branch on a condition, set a variable). By arranging nodes you get different *orchestration patterns*. This lab combines all three:

| Pattern | What it means | Where it appears here |
|---|---|---|
| **Sequential** | Agents run one after another; each hands its output to the next. | **Intake → Financial Enrichment** — parse the application, then compute the underwriting ratios. |
| **Group chat** | Several agents share **one conversation** so they can see each other's contributions; a moderator synthesizes a result. | **Credit Committee** — Credit Risk, Fraud/AML, and Compliance debate; the **Chair** weighs them into a consensus. |
| **Human‑in‑the‑loop** | The run **pauses** and waits for a person to decide before continuing. | **Senior Underwriter sign‑off** — fires only on *material* triggers; the human replies APPROVE / DECLINE / REVISE. |

```text
        Applicant submits a commercial loan application
                          │
   ┌──────────────────────▼────────────────────────┐
   │  STAGE 1 — SEQUENTIAL   (intake pipeline)      │
   │    Loan-Intake-Agent  →  Financial-Enrichment  │
   └──────────────────────┬────────────────────────┘
                          │  underwriting fact sheet (JSON)
   ┌──────────────────────▼────────────────────────┐
   │  STAGE 2 — GROUP CHAT   (Credit Committee)     │
   │    Credit-Risk  ·  Fraud-AML  ·  Compliance    │
   │                  ↓ moderated by ↓              │
   │             Credit-Committee-Chair             │
   └──────────────────────┬────────────────────────┘
                          │  committee_recommendation (JSON)
                 requiresHumanSignoff?
                    ┌─────┴─────┐
                yes │           │ no
   ┌────────────────▼───┐   ┌───▼─────────────────┐
   │ STAGE 3 — HITL      │   │ Auto-approve per     │
   │ Underwriter-Briefing│   │ policy  (HITL bypass)│
   │ → Senior Underwriter│   └───┬─────────────────┘
   │   APPROVE / DECLINE │       │
   │   / REVISE          │       │
   └────────────────┬───┘       │
                    └─────┬──────┘
                          ▼
               Decision-Letter-Agent
                          ▼
              Decision letter shown in the playground
```

## The agent roster (eight prompt agents)

Every agent is an ordinary **prompt agent** (a model + instructions) — exactly what you built in Lab 1, just many of them, each with a narrow job. Three of them emit **structured JSON** so the next stage can rely on a fixed shape.

| # | Agent | Stage | Job | Output |
|---|---|---|---|---|
| 1 | `Loan-Intake-Agent` | Sequential | Parse the raw application into a clean profile; flag missing fields. | JSON `applicant_profile` |
| 2 | `Financial-Enrichment-Agent` | Sequential | Compute DSCR, LTV, leverage, credit band, policy checks. | JSON `underwriting_fact_sheet` |
| 3 | `Credit-Risk-Analyst` | Group chat | Repayment capacity, collateral, risk rating, rate tier. | prose |
| 4 | `Fraud-AML-Analyst` | Group chat | Fraud red flags + simulated AML/sanctions/PEP screen. | prose + `FRAUD_AML_STATUS:` |
| 5 | `Compliance-Policy-Officer` | Group chat | Fair‑lending + policy‑limit checks. | prose + `COMPLIANCE_STATUS:` |
| 6 | `Credit-Committee-Chair` | Group chat (moderator) | Weigh the three opinions into a consensus; decide if a human is needed. | JSON `committee_recommendation` |
| 7 | `Underwriter-Briefing-Agent` | Human‑in‑the‑loop | Render the Chair's JSON into a plain‑English sign‑off card. | prose |
| 8 | `Decision-Letter-Agent` | Finalize | Draft the applicant‑facing approval / adverse‑action letter. | prose |

> [!TIP]
> **Why an eighth agent just to reformat JSON?** Foundry's workflow expression language is a small subset of Power Fx — it **cannot parse or reshape JSON** (no `ParseJSON`, no array‑join). So instead of showing the Senior Underwriter raw JSON, a dedicated `Underwriter-Briefing-Agent` turns the Chair's structured output into a friendly card. It runs **only** when a human is actually pulled in, so clean deals pay no extra cost. This is a recurring lesson in Lab 2: **let an agent do the string work the workflow engine can't.**

## How state flows between agents

Agents don't share memory — the workflow does, through **variables** (all prefixed `Local.`). Each stage writes a variable the next stage reads:

```text
application text
   → Local.LatestMessage      (running message the sequential agents rewrite)
   → Local.committeeText       (the Chair's JSON, captured as a string)
   → Local.briefingText        (friendly HITL card, only if a human is needed)
   → Local.humanDecision       (APPROVE / DECLINE / REVISE from the underwriter)
   → Local.finalDecision       (what actually happened)
   → Local.decisionLetter      (the applicant-facing letter)
```

You'll wire these up in Module 3. For now, just note the shape: **a message is progressively transformed**, and a couple of key results are captured into named variables so later branches can test them.

## The governance rule that drives the human gate

The whole point of the HITL stage is that **not every decision needs a human** — only *material* ones. The Chair sets a `requiresHumanSignoff` flag using Meridian's policy:

| Human sign‑off REQUIRED when ANY holds | Delegated authority (auto‑finalizes) |
|---|---|
| Requested amount **≥ $250,000** | `ApproveWithConditions` |
| Decision = **Decline** | Fraud/AML = **REVIEW** |
| Compliance = **NOT_COMPLIANT** | Compliance = **CONDITIONS** |
| Fraud/AML = **FLAGGED** | |
| Credit band **Marginal / Poor** (below Fair) | |

This is why, in Module 4, a small clean loan **auto‑approves** while a large borderline loan **pauses** for a human — the same workflow, two different paths, decided entirely by the data.

## What you'll build in the rest of Lab 2

| Module | You will… |
|---|---|
| **Lab 2 · 02 — Create the agents** | Deploy a chat model and create all **eight prompt agents** in the portal, pasting copy‑ready instructions and setting **JSON Schema** output on the three structured agents. |
| **Lab 2 · 03 — Build the workflow** | Open the **Workflows** designer, paste the full **workflow YAML**, and walk the nodes so you understand every sequential handoff, the group chat, the HITL gate, and the re‑ask loop. |
| **Lab 2 · 04 — Run & trace** | Run two sample applications — one that **auto‑approves**, one that **pauses for sign‑off** — and confirm every run is **traced** in Application Insights. |

## Before you start

Lab 2 is **portal‑only** and builds on the environment from **Lab 1**. Confirm you have:

- A **Foundry project** with the **New Foundry** toggle **ON** (see [Lab 1 · Module 01](01-setup.html)).
- Permission to create agents and workflows — **Contributor** (or higher) on the project.
- **Application Insights connected** to the project, so workflow runs are traced (this was provisioned with your project; you'll verify it in Module 4).
- A **chat model** you can deploy in Module 2 — these instructions were authored against **`gpt-5.6-terra`**, but any current GPT chat model (for example `gpt-5` or `gpt-4o`) works.

> [!NOTE]
> Nothing in Lab 2 requires local code, an SDK, or a container. Everything — agents, workflow, runs, and traces — happens in the **Foundry portal** at [ai.azure.com](https://ai.azure.com).

Ready? Continue to **Lab 2 · Module 02 — Create the agents**.
