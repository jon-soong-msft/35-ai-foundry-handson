Now you assemble the eight agents into a running **workflow**. The fastest, least error‑prone way is to **paste the workflow YAML** into the designer's YAML view — so that's what you'll do, then walk the nodes so you understand exactly what each one does. The YAML is the single source of truth: it defines the sequential handoffs, the group chat, the human gate, and the re‑ask loop.

> [!TIP]
> Tick each step as you go. **Foundry does not autosave — click Save after every change.** If a paste is rejected (preview schemas drift over time), the node‑by‑node walkthrough further down is your exact map to rebuild it visually.

## Objectives

- Open the **Workflows** designer and paste a complete workflow definition.
- Understand each **node kind** and the **variables** that carry state.
- Learn the **Power Fx** gotchas unique to Foundry workflows (they explain why the workflow is shaped the way it is).
- Save a workflow that references your eight agents by name.

## Concepts — the building blocks

A workflow is a **trigger** plus a tree of **nodes**. Foundry supports a limited set of node kinds; these are the ones this workflow uses:

| Node kind | What it does |
|---|---|
| `SetVariable` | Store a value in a `Local.*` variable. |
| `InvokeAzureAgent` | Run one of your agents; save its output to a variable. |
| `SendActivity` | Post a message into the conversation (e.g., "Committee in session"). |
| `ConditionGroup` | Branch: run the first matching condition's actions, else `elseActions`. |
| `Question` | **Pause** and wait for a human reply; store it in a variable (this is HITL). |
| `GotoAction` | Jump to another node by id (used for the re‑ask loop). |
| `EndConversation` | End the run. |

**Variables** (all `Local.*`) carry state between nodes. The key ones:

| Variable | Holds |
|---|---|
| `Local.LatestMessage` | The running message the sequential + committee agents rewrite. |
| `Local.committeeMessages` / `Local.committeeText` | The Chair's output as a table, then captured as a **string**. |
| `Local.briefingText` | The friendly sign‑off card (only when a human is needed). |
| `Local.humanDecision` | The underwriter's reply (APPROVE / DECLINE / REVISE). |
| `Local.finalDecision` | What actually happened, fed to the letter agent. |
| `Local.decisionLetter` | The applicant‑facing letter. |

> [!IMPORTANT]
> **Three Power Fx facts that shape this workflow.** Foundry's expression language is a *small* subset of Power Fx:
> 1. **No `ParseJSON` / `ParseValue`, no array‑join.** You can't parse the Chair's JSON — so the HITL gate **string‑matches** the text, and the `Underwriter-Briefing-Agent` (not the engine) reshapes it.
> 2. **An agent's `messages` output is a *Table*, not text.** Read the text with `=Last(<var>).Text`. Calling `Lower()`/`Find()` on the table directly fails with *"Invalid argument type (Table)"*.
> 3. **`System.LastMessage(.Text)` is the last *user* message**, not the agent's reply. Using it for the gate was a classic bug — the gate would test the original application, never the Chair's flag. That's why the Chair's output is captured into `Local.committeeText` explicitly.

## Steps

### Part 1 — Open the Workflows designer

- [ ] In the [Foundry portal](https://ai.azure.com), open your project (New Foundry ON).

- [ ] Go to **Build → Workflows → Create new workflow**, and pick the **Group chat** template (it gives a sensible starting canvas). If prompted, name it `commercial-loan-underwriting-workflow`.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> the new‑workflow dialog under <em>Build → Workflows</em>.</span>
  </div>

### Part 2 — Paste the workflow YAML

- [ ] Turn the **YAML Visualizer View** toggle **ON** and open the **YAML** tab.

- [ ] **Delete the template contents** and paste the full workflow below:

  ```yaml
  # =============================================================================
  # Commercial Loan Underwriting — Foundry Multi-Agent Workflow
  # Orchestration = Sequential -> Group chat -> Human-in-the-loop -> Finalize
  # =============================================================================
  kind: workflow

  trigger:
    kind: OnConversationStart
    id: trigger_loan_wf
    actions:

      # ---- seed the running message with the applicant's submission ----
      - kind: SetVariable
        id: init_latest
        variable: Local.LatestMessage
        value: =UserMessage(System.LastMessageText)

      # =======================================================================
      # STAGE 1 — SEQUENTIAL intake pipeline
      # =======================================================================
      - kind: InvokeAzureAgent
        id: agent_intake
        agent:
          name: Loan-Intake-Agent
        description: Parse the raw application into applicant_profile JSON.
        conversationId: =System.ConversationId
        input:
          messages: =Local.LatestMessage
        output:
          messages: Local.LatestMessage
          autoSend: true

      - kind: InvokeAzureAgent
        id: agent_enrichment
        agent:
          name: Financial-Enrichment-Agent
        description: Compute DSCR / LTV / leverage / credit band -> underwriting_fact_sheet JSON.
        conversationId: =System.ConversationId
        input:
          messages: =Local.LatestMessage
        output:
          messages: Local.LatestMessage
          autoSend: true

      # =======================================================================
      # STAGE 2 — GROUP CHAT credit committee (shared conversation, Chair-moderated)
      # =======================================================================
      - kind: SendActivity
        id: committee_open
        activity: "[Credit Committee is now in session] Panel: Credit Risk, Fraud & AML, Compliance. Reviewing the underwriting fact sheet..."

      - kind: InvokeAzureAgent
        id: agent_risk
        agent:
          name: Credit-Risk-Analyst
        description: Repayment capacity, ratios, collateral -> risk rating + rate tier.
        conversationId: =System.ConversationId
        input:
          messages: =Local.LatestMessage
        output:
          messages: Local.LatestMessage
          autoSend: true

      - kind: InvokeAzureAgent
        id: agent_fraud
        agent:
          name: Fraud-AML-Analyst
        description: Red flags + simulated AML/sanctions/PEP -> CLEAR / REVIEW / FLAGGED.
        conversationId: =System.ConversationId
        input:
          messages: =Local.LatestMessage
        output:
          messages: Local.LatestMessage
          autoSend: true

      - kind: InvokeAzureAgent
        id: agent_compliance
        agent:
          name: Compliance-Policy-Officer
        description: Fair lending, policy limits, disclosures -> COMPLIANT / CONDITIONS / NOT_COMPLIANT.
        conversationId: =System.ConversationId
        input:
          messages: =Local.LatestMessage
        output:
          messages: Local.LatestMessage
          autoSend: true

      - kind: InvokeAzureAgent
        id: agent_chair
        agent:
          name: Credit-Committee-Chair
        description: Weigh the three opinions -> committee_recommendation JSON (+ requiresHumanSignoff).
        conversationId: =System.ConversationId
        input:
          messages: =Local.LatestMessage
        output:
          messages: Local.committeeMessages
          autoSend: true

      # Capture the Chair's JSON output as a STRING (agent output is a Table; use Last(...).Text).
      - kind: SetVariable
        id: capture_committee
        variable: Local.committeeText
        value: =Last(Local.committeeMessages).Text

      # =======================================================================
      # STAGE 3 — HUMAN-IN-THE-LOOP: Senior Underwriter sign-off (conditional)
      # =======================================================================
      - kind: ConditionGroup
        id: gate_signoff
        conditions:
          - id: needs_human
            # Foundry Power Fx has no ParseJSON(), so string-match the compact JSON:
            # lowercase, strip spaces, then look for "requireshumansignoff":true.
            condition: '=Not(IsBlank(Find("""requireshumansignoff"":true", Substitute(Lower(Local.committeeText), " ", ""))))'
            actions:

              # Human-friendly rendering: turn the Chair's JSON into a plain-English card.
              # autoSend:false keeps it out of the transcript so it appears once, in the prompt.
              - kind: InvokeAzureAgent
                id: agent_briefing
                agent:
                  name: Underwriter-Briefing-Agent
                description: Render the committee_recommendation JSON into a readable sign-off card.
                conversationId: =System.ConversationId
                input:
                  messages: =UserMessage(Local.committeeText)
                output:
                  messages: Local.briefingMessages
                  autoSend: false
              - kind: SetVariable
                id: capture_briefing
                variable: Local.briefingText
                value: =Last(Local.briefingMessages).Text

              - kind: Question
                id: underwriter_question
                variable: Local.humanDecision
                entity: StringPrebuiltEntity
                skipQuestionMode: SkipOnFirstExecutionIfVariableHasValue
                prompt: |
                  {Local.briefingText}

                  Reply with one of:
                    APPROVE            - accept the committee recommendation as-is
                    DECLINE            - decline the application
                    REVISE <notes>     - approve with your revised terms/conditions

              - kind: ConditionGroup
                id: route_human
                conditions:
                  - id: human_approve
                    condition: =StartsWith(Upper(Trim(Local.humanDecision)), "APPROVE")
                    actions:
                      - kind: SetVariable
                        id: set_final_approve
                        variable: Local.finalDecision
                        value: '=Concatenate("APPROVED by Senior Underwriter. ", Local.committeeText)'
                  - id: human_decline
                    condition: =StartsWith(Upper(Trim(Local.humanDecision)), "DECLINE")
                    actions:
                      - kind: SetVariable
                        id: set_final_decline
                        variable: Local.finalDecision
                        value: '="DECLINED by Senior Underwriter after committee review."'
                  - id: human_revise
                    condition: =StartsWith(Upper(Trim(Local.humanDecision)), "REVISE")
                    actions:
                      - kind: SetVariable
                        id: set_final_revise
                        variable: Local.finalDecision
                        value: '=Concatenate("APPROVED WITH REVISED TERMS by Senior Underwriter: ", Local.humanDecision, " | Base committee rec: ", Local.committeeText)'
                elseActions:
                  # invalid reply -> explain and re-ask (loops back to the Question)
                  - kind: SendActivity
                    id: reask_msg
                    activity: "Please reply exactly APPROVE, DECLINE, or REVISE <notes>."
                  - kind: GotoAction
                    id: goto_reask
                    actionId: underwriter_question

        elseActions:
          # Clean, small, low-risk deal -> auto-finalize (demonstrates the HITL bypass)
          - kind: SetVariable
            id: set_final_auto
            variable: Local.finalDecision
            value: '=Concatenate("AUTO-APPROVED per policy (no human sign-off required). ", Local.committeeText)'
          - kind: SendActivity
            id: auto_msg
            activity: "Auto-approved per policy - no Senior Underwriter sign-off required."

      # =======================================================================
      # FINALIZE — draft the applicant-facing decision letter
      # =======================================================================
      - kind: InvokeAzureAgent
        id: agent_letter
        agent:
          name: Decision-Letter-Agent
        description: Draft the approval / adverse-action letter from the final decision.
        conversationId: =System.ConversationId
        input:
          messages: '=UserMessage(Concatenate("Draft the applicant decision letter. FINAL DECISION: ", Local.finalDecision))'
        output:
          messages: Local.decisionLetter
          autoSend: true

      - kind: EndConversation
        id: end_wf

  id: ""
  name: commercial-loan-underwriting-workflow
  description: |
    Commercial loan underwriting & approval. Sequential intake (parse -> enrich), a group-chat
    credit committee (Risk + Fraud/AML + Compliance, moderated by a Chair), a conditional
    human-in-the-loop Senior Underwriter sign-off, and a final applicant decision letter.
  ```

### Part 3 — Verify the nodes and agent bindings

- [ ] Switch back to the **Visualizer**. Confirm the nodes render in this order:

  ```text
  Set variable → Intake → Enrichment → (committee banner)
    → Risk → Fraud → Compliance → Chair → capture
    → If/else sign-off gate
         (true)  Briefing → Ask underwriter → route APPROVE/DECLINE/REVISE (else: re-ask)
         (false) Auto-approve
    → Decision letter → End
  ```

- [ ] Select each **Invoke agent** node and confirm it's bound to the matching agent you created in Module 2 (Intake, Enrichment, Risk, Fraud, Compliance, Chair, Briefing, Letter).

- [ ] Click **Save**.

> [!NOTE]
> The portal may **regenerate node ids** and re‑register the workflow as an agent named `commercial-loan-underwriting-workflow` on save. That's expected — the behavior is unchanged.

## How the workflow works — node‑by‑node

Understanding *why* each node exists is the real learning of this lab:

1. **`init_latest` (Set variable)** — seeds `Local.LatestMessage` with the applicant's submission via `=UserMessage(System.LastMessageText)`. This is the only place `System.LastMessageText` is valid (in the trigger it *is* the user's message).
2. **`agent_intake` → `agent_enrichment` (Sequential)** — each reads `Local.LatestMessage` and **overwrites it** with its own richer output. This is the sequential pattern: a value transformed step by step. Intake produces the profile JSON; Enrichment turns it into the fact sheet with DSCR/LTV/credit band.
3. **`committee_open` (Send message)** — a cosmetic banner so the transcript reads like a real committee convening.
4. **`agent_risk` → `agent_fraud` → `agent_compliance` → `agent_chair` (Group chat)** — all four share `=System.ConversationId`, so each sees the running deliberation. The three specialists opine; the **Chair** weighs them and emits the `committee_recommendation` JSON, including the all‑important `requiresHumanSignoff` flag.
5. **`capture_committee` (Set variable)** — copies the Chair's output into `Local.committeeText` as a **string** using `=Last(Local.committeeMessages).Text`, so the next node can string‑match it.
6. **`gate_signoff` (If/else)** — the HITL gate. Its condition lowercases the text, strips spaces, and looks for `"requireshumansignoff":true`. If found → the human branch; otherwise → the auto‑approve branch.
7. **Human branch** — `agent_briefing` renders the JSON into a friendly card (`Local.briefingText`); the **`underwriter_question` (Question) pauses the run**; `route_human` maps the reply to `Local.finalDecision`. An invalid reply falls to `elseActions`, which posts a hint and **`GotoAction` loops back** to the question.
8. **Auto‑approve branch (`elseActions`)** — sets `Local.finalDecision` to an auto‑approval and posts a short notice. No human involved.
9. **`agent_letter` (Finalize)** — the Decision‑Letter agent drafts the applicant‑facing letter from `Local.finalDecision`.
10. **`end_wf` (End conversation)** — done.

> [!TIP]
> **Why is this "group chat" and not just four more sequential steps?** Because nodes 4's agents share one `System.ConversationId`, so each committee member can *see and react to* what the others said, and the Chair dynamically synthesizes the debate — that shared‑context, moderated deliberation is the group‑chat pattern.

## Common workflow gotchas

| Symptom | Fix |
|---|---|
| Paste rejected / node won't validate | Preview YAML dialects drift. Use the **node‑by‑node** list above to reproduce the same nodes visually; the Power Fx strings are the exact ones to enter. |
| Changes don't take effect | Click **Save** — Foundry never autosaves. |
| *"Name isn't valid"* in an expression | Add the scope prefix: `System.` or `Local.`. |
| *"Invalid argument type (Table)"* | You're calling a text function on an agent's `messages` output. Wrap it with `=Last(<var>).Text` first. |
| Gate never triggers a human (everything auto‑approves) | You matched against `System.LastMessage` (the user's text) instead of the captured `Local.committeeText`. |
| Gate always triggers a human | Check the Chair agent's `requiresHumanSignoff` rule (Module 2) and confirm the fact sheet gives it a `creditBand`. |

With the workflow saved, continue to **Lab 2 · Module 04 — Run & trace** to watch both paths execute and confirm traceability.
