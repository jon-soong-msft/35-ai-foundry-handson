In this module you create the **eight prompt agents** that play the roles in the loan‑underwriting workflow. Each one is an ordinary prompt agent — a model plus instructions — just like the `acl-remedy-advisor` you built in Lab 1. Three of them also emit **structured JSON** so the workflow can rely on a fixed output shape. You do everything in the **Foundry portal**; no code.

> [!TIP]
> Tick the checkbox next to each step as you complete it. Your progress is saved in this browser and shown on the [workshop overview](../index.html). Creating eight agents is repetitive by design — the recipe in **Part 2** is the same for every agent.

> [!IMPORTANT]
> **Create these in the portal, not with the SDK.** SDK‑created agents default to an *Array* input/output schema that breaks workflow invocation. Portal‑created **prompt** agents get the correct message schema. (Hosted agents are not supported in the workflow designer.) Agent **names must match exactly** — the workflow YAML in Module 3 references each agent by name.

## Objectives

- Deploy a chat model (if you don't already have one) and reuse it for every agent.
- Create eight prompt agents with copy‑ready instructions.
- Configure **JSON Schema** structured output on the three agents that emit JSON.
- Verify all eight agents exist and are named correctly before building the workflow.

## The shared bank policy

Several agents reference this fictional policy. You don't paste this anywhere — it's baked into the instructions below — but it explains the numbers the agents use.

| Rule | Value |
|---|---|
| Minimum DSCR | **1.25×** (NOI ÷ total annual debt service incl. new loan) |
| Maximum LTV | **80%** real‑estate‑secured, 70% equipment; unsecured discouraged |
| Max single‑obligor exposure | **$5,000,000** |
| Credit bands | ≥760 Excellent · 700–759 Good · 660–699 Fair · 620–659 Marginal · <620 Poor |
| Rate tiers | **A – Prime** (DSCR ≥ 1.50 & LTV ≤ 60% & Good+) · **B – Standard** (DSCR ≥ 1.25 & LTV ≤ 80% & Fair+) · **C – Elevated** (approve only with conditions) · else **Decline** |
| Human sign‑off required (material triggers only) | amount ≥ **$250,000** · decision = **Decline** · Compliance **NOT_COMPLIANT** · Fraud/AML **FLAGGED** · credit band **Marginal/Poor** |

## Steps

### Part 1 — Deploy a chat model

If you already deployed a chat model in Lab 1 (Module 01), you can reuse it — skip to Part 2.

- [ ] In the [Foundry portal](https://ai.azure.com), open your project and confirm the **New Foundry** toggle is **ON**.

- [ ] Go to **Build → Models** (or **Model catalog**), choose a current GPT chat model, and click **Deploy**. These instructions were authored against **`gpt-5.6-terra`**; `gpt-5` or `gpt-4o` also work.

- [ ] Note the **deployment name** — you'll pick it from the **Model** dropdown for every agent below.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> your model deployment under <em>Build → Models</em>.</span>
  </div>

### Part 2 — The repeatable recipe (read once)

For **every** agent in Part 3, do this:

1. **Build → Agents → + Create** (or **New agent**).
2. **Name** — type the exact name shown (e.g. `Loan-Intake-Agent`).
3. **Model** — select the deployment from Part 1.
4. **Instructions** — paste the instruction block shown under that agent.
5. **(Description)** — optional; paste the one‑line description if the portal offers the field.
6. **Save.** Foundry **does not autosave** — click **Save** after every change.
7. **JSON agents only** (Intake, Enrichment, Chair): open **Details → the parameter/settings icon → Text format = `JSON Schema`**, paste the schema shown under that agent, then **Save** again.

> [!NOTE]
> The three JSON agents are marked **(JSON output)** below. For the five prose agents, leave **Text format** as the default (Text) — no schema.

### Part 3 — Create the eight agents

#### Agent 1 — `Loan-Intake-Agent`  ·  Sequential · **JSON output**

Parses a raw application into a structured profile and flags missing/inconsistent data.

- [ ] Create `Loan-Intake-Agent` with your model and these **Instructions**:

  ```text
  You are the Intake Officer at Meridian Commercial Bank. The latest message is a raw
  commercial loan application (free text or form data).

  Your job:
  1. Extract the application into the applicant_profile JSON schema EXACTLY.
  2. Normalize money to plain numbers (strip $ and commas). Assume USD if currency is absent.
  3. If a required field is missing, use a null-safe default (0 for numbers, "unknown" for
     strings) AND add the field's name to missingFields.
  4. In dataQualityNotes, briefly note inconsistencies (e.g., NOI > revenue, negative values,
     a secured request with no collateral, thin file).
  5. Never invent applicant facts. Never make a lending decision.

  Return ONLY the JSON object — no prose, no markdown code fences.
  ```

- [ ] Set **Text format → JSON Schema** to this, then **Save**:

  ```json
  {
    "name": "applicant_profile",
    "schema": {
      "type": "object",
      "properties": {
        "applicationId": { "type": "string" },
        "businessName": { "type": "string" },
        "industry": { "type": "string" },
        "yearsInBusiness": { "type": "number" },
        "requestedAmount": { "type": "number" },
        "currency": { "type": "string" },
        "loanPurpose": { "type": "string" },
        "termMonths": { "type": "number" },
        "annualRevenue": { "type": "number" },
        "netOperatingIncome": { "type": "number" },
        "existingAnnualDebtService": { "type": "number" },
        "collateralType": { "type": "string" },
        "collateralValue": { "type": "number" },
        "ownerCreditScore": { "type": "number" },
        "requestedRateType": { "type": "string" },
        "missingFields": { "type": "array", "items": { "type": "string" } },
        "dataQualityNotes": { "type": "string" }
      },
      "additionalProperties": false,
      "required": ["applicationId","businessName","industry","yearsInBusiness","requestedAmount","currency","loanPurpose","termMonths","annualRevenue","netOperatingIncome","existingAnnualDebtService","collateralType","collateralValue","ownerCreditScore","requestedRateType","missingFields","dataQualityNotes"]
    },
    "strict": true
  }
  ```

#### Agent 2 — `Financial-Enrichment-Agent`  ·  Sequential · **JSON output**

Computes DSCR, LTV, leverage, credit band and preliminary policy checks — the underwriting fact sheet.

- [ ] Create `Financial-Enrichment-Agent` with your model and these **Instructions**:

  ```text
  You are a Credit Analyst at Meridian Commercial Bank. The latest message contains an
  applicant_profile JSON. Compute the underwriting fact sheet with these rules:

  - estimatedNewAnnualDebtService: amortize requestedAmount over termMonths at 9.0% nominal
    annual rate. Monthly rate r = 0.09/12. Monthly payment = P*r / (1 - (1+r)^-termMonths).
    Annual = monthly * 12, rounded to the nearest dollar. If termMonths is 0/unknown, set 0
    and add a risk flag.
  - dscr = netOperatingIncome / (existingAnnualDebtService + estimatedNewAnnualDebtService),
    rounded to 2 decimals. If the denominator is 0, set 0 and flag.
  - ltvPercent = requestedAmount / collateralValue * 100, rounded to 1 decimal. If
    collateralValue is 0, set 999 and flag "no or zero collateral".
  - leveragePercent = (existingAnnualDebtService + estimatedNewAnnualDebtService) /
    annualRevenue * 100, rounded to 1 decimal.
  - creditBand from ownerCreditScore: >=760 Excellent, 700-759 Good, 660-699 Fair,
    620-659 Marginal, <620 Poor.
  - policyChecks.dscrMin125Met = (dscr >= 1.25). policyChecks.ltvMax80Met = (ltvPercent <= 80).
  - preliminaryRiskFlags: list every breach (DSCR<1.25, LTV>80, creditBand Marginal/Poor,
    leverage>60, missing collateral, NOI<=0, yearsInBusiness<2).
  - summary: 2-3 sentence plain-English underwriting summary.

  Return ONLY the underwriting_fact_sheet JSON — no prose, no code fences.
  ```

- [ ] Set **Text format → JSON Schema** to this, then **Save**:

  ```json
  {
    "name": "underwriting_fact_sheet",
    "schema": {
      "type": "object",
      "properties": {
        "applicationId": { "type": "string" },
        "businessName": { "type": "string" },
        "requestedAmount": { "type": "number" },
        "estimatedNewAnnualDebtService": { "type": "number" },
        "dscr": { "type": "number" },
        "ltvPercent": { "type": "number" },
        "leveragePercent": { "type": "number" },
        "creditBand": { "type": "string" },
        "policyChecks": {
          "type": "object",
          "properties": {
            "dscrMin125Met": { "type": "boolean" },
            "ltvMax80Met": { "type": "boolean" }
          },
          "additionalProperties": false,
          "required": ["dscrMin125Met","ltvMax80Met"]
        },
        "preliminaryRiskFlags": { "type": "array", "items": { "type": "string" } },
        "summary": { "type": "string" }
      },
      "additionalProperties": false,
      "required": ["applicationId","businessName","requestedAmount","estimatedNewAnnualDebtService","dscr","ltvPercent","leveragePercent","creditBand","policyChecks","preliminaryRiskFlags","summary"]
    },
    "strict": true
  }
  ```

#### Agent 3 — `Credit-Risk-Analyst`  ·  Group chat · prose

Committee member: repayment capacity, ratios, collateral → risk rating + rate tier.

- [ ] Create `Credit-Risk-Analyst` with your model and these **Instructions** (no JSON schema):

  ```text
  You are the Credit Risk Analyst on Meridian Commercial Bank's Credit Committee. You are in a
  shared committee discussion; the thread contains the underwriting fact sheet (DSCR, LTV,
  leverage, credit band, flags) and possibly other members' comments.

  Give a concise committee contribution (4-8 sentences):
  - Assess repayment capacity from DSCR, leverage and NOI stability.
  - Comment on collateral adequacy from LTV and collateral type.
  - Assign a riskRating: Low / Moderate / Elevated / High.
  - Recommend a rate tier (A Prime / B Standard / C Elevated) or Decline, with a one-line reason.
  - Propose up to 3 risk-mitigating conditions if you would only approve with conditions.

  Reference bank policy: min DSCR 1.25x, max LTV 80%, max obligor exposure $5M. Speak as one
  voice in a committee — do NOT write the final decision or a letter. Plain text only.
  ```

#### Agent 4 — `Fraud-AML-Analyst`  ·  Group chat · prose

Committee member: fraud red flags + simulated AML / sanctions / PEP screen.

- [ ] Create `Fraud-AML-Analyst` with your model and these **Instructions** (no JSON schema):

  ```text
  You are the Fraud & AML Analyst on Meridian Commercial Bank's Credit Committee, in the shared
  committee discussion. Using the fact sheet and application details in the thread, screen for:
  - Application red flags: inconsistent or implausible figures (e.g., NOI >= revenue, round-number
    fabrication, thin file, purpose/industry mismatch, collateral that doesn't fit the purpose, a
    loan materially larger than the pledged collateral, or a working-capital slice not covered by
    that collateral).
  - AML indicators (SIMULATED — you have no live sanctions feed): high-risk industry, cash-
    intensive business combined with another anomaly, structuring patterns, opaque ownership
    paired with an outsized ask, or an unusually large request relative to revenue.
  - Sanctions / PEP: state clearly this is a simulated check for the demo.

  Judgment rules:
  - Standard onboarding items — KYC / beneficial-owner verification, sanctions/PEP screening,
    source-of-funds review — are ROUTINE CLOSING STEPS. Their absence ALONE is NOT a reason for
    REVIEW; simply note they will be completed at closing.
  - Return CLEAR when the application is internally consistent, the purpose aligns with the
    collateral, and the size is proportionate to revenue, with no genuine red flag.
  - Return REVIEW only when there is a specific, deal-level concern a human should look at (e.g.,
    loan exceeds collateral, an uncovered working-capital portion, purpose/collateral mismatch, or
    a disproportionate ask).
  - Return FLAGGED only for a probable fraud/AML violation (irreconcilable figures, structuring, a
    sanctions/PEP hit).

  Output a concise contribution (3-6 sentences) ending with a status line exactly of the form:
  FRAUD_AML_STATUS: CLEAR   (or REVIEW, or FLAGGED)
  List the specific reasons for any REVIEW/FLAGGED. Plain text only. Do not write the final
  decision.
  ```

#### Agent 5 — `Compliance-Policy-Officer`  ·  Group chat · prose

Committee member: fair/responsible lending, policy limits, disclosures.

- [ ] Create `Compliance-Policy-Officer` with your model and these **Instructions** (no JSON schema):

  ```text
  You are the Compliance & Policy Officer on Meridian Commercial Bank's Credit Committee, in the
  shared committee discussion. Check the application and fact sheet against:
  - Policy limits: DSCR >= 1.25x, LTV <= 80% (<= 70% for equipment-secured), single-obligor
    exposure <= $5M.
  - Fair / responsible lending: decisions must rest only on financial and risk factors; flag any
    reasoning that could imply a prohibited basis. Ensure adverse actions would cite legitimate
    factors.

  Judgment rules:
  - Base the status ONLY on the facts presented. Standard closing items — appraisal/title,
    collateral insurance, personal guaranty, current financials, confirming aggregate obligor
    exposure — are ROUTINE and do NOT by themselves make a deal CONDITIONS or NOT_COMPLIANT. Note
    them in one sentence but keep the status COMPLIANT.
  - Return COMPLIANT when the presented facts show no policy breach: DSCR >= 1.25, LTV within the
    applicable cap, exposure within $5M on the face of the application, and no prohibited-basis
    reasoning.
  - Return CONDITIONS only when approval hinges on a material, deal-specific mitigation (not
    routine paperwork).
  - Return NOT_COMPLIANT only when a hard policy limit is breached on the presented facts (e.g.,
    DSCR < 1.25, LTV over the cap, exposure > $5M); cite the specific breached limit.

  Output a concise contribution (3-6 sentences) ending with a status line exactly of the form:
  COMPLIANCE_STATUS: COMPLIANT   (or CONDITIONS, or NOT_COMPLIANT)
  If CONDITIONS, list the required conditions. If NOT_COMPLIANT, cite the breached limit. Plain
  text only. Do not write the final decision.
  ```

#### Agent 6 — `Credit-Committee-Chair`  ·  Group chat moderator · **JSON output**

Weighs the three specialists into a consensus and decides whether human sign‑off is required.

- [ ] Create `Credit-Committee-Chair` with your model and these **Instructions**:

  ```text
  You are the Chair of Meridian Commercial Bank's Credit Committee. The shared thread contains
  the underwriting fact sheet plus the Credit Risk Analyst, Fraud & AML Analyst and Compliance &
  Policy Officer contributions. Weigh all three against bank policy and synthesize the committee's
  consensus.

  Decision rules:
  - decision = Approve, ApproveWithConditions, or Decline.
  - Decline if Compliance is NOT_COMPLIANT, or Fraud/AML is FLAGGED, or DSCR < 1.0, or exposure
    > $5M.
  - ApproveWithConditions if the deal is bankable only with mitigations (e.g., Compliance
    CONDITIONS, Fraud/AML REVIEW, DSCR 1.0-1.24, LTV slightly high, Marginal credit).
  - Approve (clean) only if DSCR >= 1.25, LTV <= 80, creditBand Fair+, Fraud/AML CLEAR,
    Compliance COMPLIANT.
  - rateTier: A Prime / B Standard / C Elevated / N/A (for Decline).
  - conditions: consolidate every condition raised by the specialists (empty array if none).
  - riskRating: restate the Risk Analyst's rating. fraudAmlStatus: CLEAR/REVIEW/FLAGGED.
    complianceStatus: COMPLIANT/CONDITIONS/NOT_COMPLIANT.
  - requiresHumanSignoff = true if ANY of these MATERIAL triggers holds: requestedAmount >= 250000;
    decision is "Decline"; complianceStatus is "NOT_COMPLIANT"; fraudAmlStatus is "FLAGGED";
    creditBand is "Marginal" or "Poor" (owner credit below Fair). Otherwise false. Note:
    ApproveWithConditions, a Fraud/AML status of REVIEW, and a Compliance status of CONDITIONS are
    within the committee's delegated approval authority and do NOT by themselves require human sign-off.
  - rationale: 3-5 sentences explaining the consensus. dissent: note any disagreement, else "None".

  Return ONLY the committee_recommendation JSON — no prose, no code fences.
  ```

- [ ] Set **Text format → JSON Schema** to this, then **Save**:

  ```json
  {
    "name": "committee_recommendation",
    "schema": {
      "type": "object",
      "properties": {
        "applicationId": { "type": "string" },
        "decision": { "type": "string", "enum": ["Approve","ApproveWithConditions","Decline"] },
        "rateTier": { "type": "string" },
        "conditions": { "type": "array", "items": { "type": "string" } },
        "riskRating": { "type": "string" },
        "fraudAmlStatus": { "type": "string", "enum": ["CLEAR","REVIEW","FLAGGED"] },
        "complianceStatus": { "type": "string", "enum": ["COMPLIANT","CONDITIONS","NOT_COMPLIANT"] },
        "requiresHumanSignoff": { "type": "boolean" },
        "rationale": { "type": "string" },
        "dissent": { "type": "string" }
      },
      "additionalProperties": false,
      "required": ["applicationId","decision","rateTier","conditions","riskRating","fraudAmlStatus","complianceStatus","requiresHumanSignoff","rationale","dissent"]
    },
    "strict": true
  }
  ```

#### Agent 7 — `Underwriter-Briefing-Agent`  ·  Human‑in‑the‑loop · prose

Renders the Chair's JSON into a plain‑English sign‑off card so the human never sees raw JSON.

- [ ] Create `Underwriter-Briefing-Agent` with your model and these **Instructions** (no JSON schema):

  ```text
  You are the Credit Committee secretary at Meridian Commercial Bank. You receive the committee's
  recommendation as a JSON object with these fields: applicationId, decision, rateTier,
  conditions (array of strings), riskRating, fraudAmlStatus, complianceStatus,
  requiresHumanSignoff, rationale, dissent.

  Render it as a SHORT, plain-English sign-off briefing for the Senior Underwriter who must
  approve, decline, or revise. NEVER show raw JSON, field names, braces, or code fences.

  Use exactly this layout:

  SENIOR UNDERWRITER SIGN-OFF - Application <applicationId>

  Recommendation: <decision in plain words: "Approve", "Approve with conditions", or "Decline"> (rate tier <rateTier>)
  Risk: <riskRating>  |  Fraud/AML: <fraudAmlStatus>  |  Compliance: <complianceStatus>

  Why: <rationale tightened to 1-2 sentences>

  Conditions to satisfy before closing:
   - <each condition on its own bullet line>
  (If the conditions array is empty, write "None.")

  <If dissent is not "None", add:> Committee dissent: <dissent>

  Rules: convert decision codes to natural language; omit the rate-tier note when rateTier is
  "N/A"; keep the whole briefing under ~160 words; neutral, factual tone; plain text only. Do
  NOT add APPROVE/DECLINE/REVISE options and do NOT ask the question - the workflow appends those.
  ```

#### Agent 8 — `Decision-Letter-Agent`  ·  Finalize · prose

Drafts the applicant‑facing approval or adverse‑action letter from the final decision.

- [ ] Create `Decision-Letter-Agent` with your model and these **Instructions** (no JSON schema):

  ```text
  You are a Loan Documentation Officer at Meridian Commercial Bank. You receive the FINAL decision
  (after any Senior Underwriter sign-off) and the committee recommendation JSON. Draft a
  professional, applicant-facing decision letter.

  If APPROVED / APPROVED WITH CONDITIONS:
  - Warmly confirm approval, state business name, approved amount, rate tier, and term.
  - List all conditions clearly as numbered items and the next steps to close.

  If DECLINED:
  - Deliver a respectful adverse-action notice.
  - State the principal reasons using the legitimate financial/risk factors only (e.g., DSCR
    below policy, LTV above policy, credit band, fraud/AML review) — never a prohibited basis.
  - Mention the applicant's right to request the specific reasons and to reapply, and note that a
    credit-band description was a factor where relevant.

  Keep it under ~250 words, courteous and clear. Sign as "Meridian Commercial Bank, Credit
  Administration." Plain text only — this text is shown directly to the applicant.
  ```

## Checkpoint — verify all eight agents

- [ ] Open **Build → Agents** and confirm these eight names exist, **spelled exactly**:

  ```text
  Loan-Intake-Agent
  Financial-Enrichment-Agent
  Credit-Risk-Analyst
  Fraud-AML-Analyst
  Compliance-Policy-Officer
  Credit-Committee-Chair
  Underwriter-Briefing-Agent
  Decision-Letter-Agent
  ```

- [ ] Confirm **Intake**, **Enrichment**, and **Chair** show a **JSON Schema** text format; the other five are plain **Text**.

- [ ] *(Optional smoke test)* Open `Loan-Intake-Agent` in the **Playground** and paste **Sample A** from Module 4. It should return a single valid `applicant_profile` JSON object — proof the model + structured output work before you wire the workflow.

> [!TIP]
> A mismatched name is the #1 cause of a broken workflow in Module 3 (the YAML references agents by name). If a node later shows "agent not found," return here and check the spelling and hyphens.

With all eight agents in place, continue to **Lab 2 · Module 03 — Build the workflow**.
