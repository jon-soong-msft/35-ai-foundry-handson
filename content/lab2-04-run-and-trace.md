Time to run it. You'll submit two loan applications: **Sample A** — a small, clean deal that the workflow **auto‑approves** (the human gate is bypassed), and **Sample B** — a large, borderline deal that **pauses** for a Senior Underwriter. Then you'll confirm every run was **traced** in Application Insights. This is where all three orchestration patterns come alive in a single workflow.

> [!TIP]
> Tick each step as you go. Run **Sample A first** (it's the happy path), then **Sample B** to see the human‑in‑the‑loop pause and the approve/decline/revise branch.

## Objectives

- Run the workflow in the portal playground and follow the sequential → group‑chat → HITL flow.
- See the **conditional HITL bypass** (Sample A) and the **human pause + re‑ask loop** (Sample B).
- Confirm workflow runs are **traced** end‑to‑end in Application Insights.

## Steps

### Part 1 — Run Sample A (clean approval, HITL bypassed)

- [ ] Open your workflow and click **Run Workflow** (Save first if you just edited it).

- [ ] Paste this as the **first message**:

  ```text
  Commercial Loan Application — APP-1001
  Business: Riverstone Bakery LLC (artisan bakery & cafe), 6 years in business.
  Requested amount: $180,000, fixed rate, 60-month term.
  Purpose: renovate and expand the owner-occupied bakery premises.
  Annual revenue: $1,200,000. Net operating income (NOI): $260,000.
  Existing annual debt service: $40,000.
  Collateral: owner-occupied commercial real estate, appraised value $260,000.
  Owner personal credit score: 745.
  ```

- [ ] Watch the stages and confirm the expected behavior:

  | Stage | What you should see |
  |---|---|
  | Sequential | *Intake* returns `applicant_profile` JSON; *Enrichment* computes ~**DSCR 3.0**, **LTV ~69%**, credit band **Good**, no policy breaches. |
  | Group chat | Risk = **Low/Moderate**; Fraud/AML = **CLEAR**; Compliance = **COMPLIANT**; Chair = **Approve**, rate **Tier A/B**, `requiresHumanSignoff = false`. |
  | Human‑in‑the‑loop | **Skipped** — you see: *"Auto-approved per policy — no Senior Underwriter sign-off required."* |
  | Finalize | *Decision‑Letter* drafts a warm **approval letter** with amount, rate tier, term, and closing steps. |

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> the run showing the auto-approve message and the final approval letter.</span>
  </div>

> [!NOTE]
> **This is the conditional HITL bypass.** A small ($180k), clean, low‑risk deal clears every material trigger, so the Chair sets `requiresHumanSignoff = false` and the gate takes the `elseActions` (auto‑approve) branch — no human needed.

### Part 2 — Run Sample B (borderline → committee debate + human pause)

- [ ] Start a **new run** and paste this application:

  ```text
  Commercial Loan Application — APP-2002
  Business: Summit Logistics Corp (regional trucking & delivery), 3 years in business.
  Requested amount: $850,000, variable rate, 84-month term.
  Purpose: acquire 6 delivery trucks and fund working capital.
  Annual revenue: $2,100,000. Net operating income (NOI): $520,000.
  Existing annual debt service: $310,000.
  Collateral: vehicles/equipment, appraised value $700,000.
  Owner personal credit score: 662.
  ```

- [ ] Follow the committee, then confirm the run **pauses** for sign‑off:

  | Stage | What you should see |
  |---|---|
  | Sequential | *Enrichment* computes ~**DSCR 1.10** (below the 1.25 floor), **LTV ~121%** (loan exceeds collateral; above the 80% cap), credit band **Fair**, several `preliminaryRiskFlags`. |
  | Group chat | Risk = **Elevated/High**; Fraud/AML = **REVIEW**; Compliance = **CONDITIONS** or **NOT_COMPLIANT**. Chair = **ApproveWithConditions** or **Decline**, `requiresHumanSignoff = true` (amount ≥ $250k always trips it). |
  | Human‑in‑the‑loop | **Pauses** and shows the friendly **sign‑off card** (from the `Underwriter-Briefing-Agent`), then asks you to reply. |

- [ ] **Test the invalid re‑ask loop first:** reply with something like `maybe`. The workflow posts *"Please reply exactly APPROVE, DECLINE, or REVISE <notes>."* and **asks again** — this is the `GotoAction` loop.

- [ ] Now reply with a **valid decision** and read the resulting letter. Try each on separate runs:

  ```text
  DECLINE
  ```

  ```text
  APPROVE
  ```

  ```text
  REVISE reduce to $650k, add a personal guaranty and additional collateral
  ```

  | Your reply | Result |
  |---|---|
  | `DECLINE` | An **adverse‑action letter** citing DSCR/LTV/credit factors (legitimate reasons only). |
  | `APPROVE` | An **approval‑with‑conditions letter** consolidating the committee's conditions. |
  | `REVISE …` | An **approval letter reflecting your revised terms**. |

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> the paused run showing the sign-off card and your APPROVE/DECLINE/REVISE reply.</span>
  </div>

> [!TIP]
> Sample B demonstrates four things at once: **group‑chat deliberation with dissent**, the **human pause**, the **invalid‑input re‑ask loop**, and the **three decision branches** feeding two different letter styles.

### Part 3 — Confirm traceability (Application Insights)

Tracing was wired when your project's **Application Insights** connection was created — every agent invocation and workflow run emits spans.

- [ ] **Easiest (portal):** open the workflow's (or agents') **Tracing** / **Monitoring** tab and open your most recent run. You should see **one span per agent invocation** — Intake → Enrichment → Risk → Fraud → Compliance → Chair → (Briefing) → Letter — each with latency and token usage.

- [ ] **Optional (KQL):** open your **Application Insights** resource → **Logs**, and run:

  ```kusto
  // agent / workflow spans in the last hour
  dependencies
  | where timestamp > ago(1h)
  | project timestamp, name, target, duration, resultCode, operation_Id
  | order by timestamp desc
  ```

  ```kusto
  // gen-ai traces / messages in the last hour
  traces
  | where timestamp > ago(1h)
  | order by timestamp desc
  | take 200
  ```

- [ ] Group a single run by its `operation_Id` to see the full Intake → … → Letter chain as one correlated trace.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> the run's trace waterfall (portal Tracing tab) or your KQL results.</span>
  </div>

## Recap — what you built

You composed **eight prompt agents** into one governed workflow that combines all three orchestration patterns:

- **Sequential** — Intake → Enrichment prepared the data deterministically.
- **Group chat** — a shared‑context committee (Risk + Fraud/AML + Compliance) deliberated, moderated by the Chair.
- **Human‑in‑the‑loop** — a policy‑gated Senior Underwriter sign‑off that **only fires on material triggers**, with a friendly briefing card and an invalid‑input re‑ask loop.
- …and a **finalize** stage that turned the outcome into an applicant‑facing letter — all **traced** in Application Insights.

## Optional — flip the path with the data

The path is decided entirely by the numbers, so you can force either outcome:

- **Force HITL on the clean deal:** take Sample A and change the amount to **$300,000** (≥ the $250k threshold). It will now pause for sign‑off even though the ratios are strong.
- **Force an auto‑approve on the borderline deal:** take Sample B, drop the amount to **$150,000**, set collateral value to **$220,000** (LTV ~68%) and existing debt service to **$60,000** (DSCR ~2+). It will now clear every trigger and auto‑finalize.

> [!NOTE]
> Amounts and ratios are recomputed **live by the model**, so exact figures vary slightly between runs — but the *path* each sample takes stays the same.

## Troubleshooting

| Issue | Fix |
|---|---|
| Run stops at an agent with "agent not found" | An agent name in the workflow doesn't match. Re‑check the eight names in **Module 2**. |
| Everything auto‑approves (never pauses) | The gate is matching the wrong text. Confirm `capture_committee` sets `Local.committeeText = Last(Local.committeeMessages).Text` and the gate reads `Local.committeeText`. |
| It always pauses, even for the small clean deal | Check the **Chair** agent's `requiresHumanSignoff` rule and that Enrichment emits a `creditBand`. |
| The underwriter sees raw JSON, not a friendly card | The `Underwriter-Briefing-Agent` node isn't running before the Question, or the prompt isn't showing `{Local.briefingText}`. |
| No traces appear | Confirm the project has an **Application Insights** connection, and give ingestion a minute; widen the KQL window to `ago(24h)`. |

## Where this goes next

> [!IMPORTANT]
> Foundry Workflows (visual designer + in‑portal execution) are **public preview** and slated for **retirement on Dec 1, 2026**. Your investment carries forward: export this workflow's **YAML** and bring it into the **Microsoft Agent Framework**, which runs the same declarative orchestration as a **Foundry hosted agent** — no rebuild required. The patterns you practiced here (sequential handoffs, shared‑context group chat, and governed human gates) are the durable skills.

**Congratulations** — you've completed both labs: a single **prompt agent** end‑to‑end (Lab 1) and a **multi‑agent workflow** combining sequential, group‑chat, and human‑in‑the‑loop orchestration (Lab 2), entirely in the Foundry portal.
