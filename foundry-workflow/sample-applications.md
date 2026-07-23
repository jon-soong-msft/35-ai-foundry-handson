# Sample Loan Applications (for the playground)

Paste one of these as the **first message** when you **Run Workflow** in the portal. Each is
crafted to drive a different path so you can see all three orchestration styles.

---

## Sample A — Clean approval (auto-finalizes, HITL is *bypassed*)

> **Commercial Loan Application — APP-1001**
> Business: **Riverstone Bakery LLC** (artisan bakery & cafe), 6 years in business.
> Requested amount: **$180,000**, fixed rate, **60-month** term.
> Purpose: renovate and expand the owner-occupied bakery premises.
> Annual revenue: **$1,200,000**. Net operating income (NOI): **$260,000**.
> Existing annual debt service: **$40,000**.
> Collateral: owner-occupied **commercial real estate**, appraised value **$260,000**.
> Owner personal credit score: **745**.

**Expected behavior**
| Stage | What you should see |
|---|---|
| Sequential | *Intake* returns `applicant_profile` JSON; *Enrichment* computes ~**DSCR 3.0**, **LTV ~69%**, credit band **Good**, no policy breaches. |
| Group chat | Risk = **Low/Moderate**; Fraud/AML = **CLEAR**; Compliance = **COMPLIANT**; Chair = **Approve**, rate **Tier A/B**, `requiresHumanSignoff = false`. |
| Human-in-the-loop | **Skipped** — the else branch fires: *"Auto-approved per policy — no Senior Underwriter sign-off required."* |
| Finalize | *Decision-Letter* drafts a warm **approval letter** with amount, rate tier, term, and closing steps. |

This case demonstrates the **conditional HITL bypass** (small, clean, low-risk deals don't
need a human).

---

## Sample B — Borderline / flagged (drives committee debate + HITL pause)

> **Commercial Loan Application — APP-2002**
> Business: **Summit Logistics Corp** (regional trucking & delivery), 3 years in business.
> Requested amount: **$850,000**, variable rate, **84-month** term.
> Purpose: acquire 6 delivery trucks **and fund working capital**.
> Annual revenue: **$2,100,000**. Net operating income (NOI): **$520,000**.
> Existing annual debt service: **$310,000**.
> Collateral: **vehicles/equipment**, appraised value **$700,000**.
> Owner personal credit score: **662**.

**Expected behavior**
| Stage | What you should see |
|---|---|
| Sequential | *Intake* → JSON. *Enrichment* computes ~**DSCR 1.10** (below the 1.25 policy floor), **LTV ~121%** (loan exceeds collateral; above the 80% cap), credit band **Fair**, several `preliminaryRiskFlags`. |
| Group chat | Risk = **Elevated/High** (thin DSCR, collateral shortfall); Fraud/AML = **REVIEW** (working-capital slice not covered by truck collateral); Compliance = **CONDITIONS** or **NOT_COMPLIANT** (LTV + DSCR breaches). Chair = **ApproveWithConditions** or **Decline**, `requiresHumanSignoff = true`. |
| Human-in-the-loop | **Pauses** for the Senior Underwriter. Try each reply: **APPROVE**, **DECLINE**, or **REVISE reduce to $650k, add personal guaranty and additional collateral**. (Type something invalid first, e.g. `maybe`, to see the re-ask loop.) |
| Finalize | If declined → an **adverse-action letter** citing DSCR/LTV/credit factors; if revised → an **approval-with-conditions letter** reflecting your edits. |

This case demonstrates **group-chat deliberation with dissent**, the **HITL approve/decline/revise
branch**, the **invalid-input re-ask loop**, and both **letter** paths.

---

### Tips
- Amounts, ratios and statuses above are approximate — gpt-5 recomputes them live, so exact
  numbers may vary by a little. The *path* each sample takes should stay the same.
- **Human sign-off fires only on *material* triggers:** amount ≥ **$250k**, decision =
  **Decline**, Compliance = **NOT_COMPLIANT**, Fraud/AML = **FLAGGED**, or credit band
  **Marginal/Poor**. Soft outcomes (`ApproveWithConditions`, Fraud/AML **REVIEW**, Compliance
  **CONDITIONS**) are within delegated authority and auto-finalize — that's why clean Sample A
  bypasses HITL and $850k Sample B always pauses.
- To force HITL on Sample A, bump the requested amount to **$300,000** (≥ $250k threshold).
- To force a clean auto-approve on B, drop the amount to **$150,000** and set collateral value
  to **$220,000** (LTV ~68%) and existing debt service to **$60,000** (DSCR ~2+).
