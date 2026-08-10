"""Bind to the eight committee agents authored in the portal (Lab 2).

Primary path (`bind`): bind an existing service agent by name — the hybrid model.
Fallback path (`bind_from_code`): rebuild each agent on FoundryChatClient from the
instruction text in ../foundry-workflow/agents.md. Kept runnable across preview drift.
"""
from __future__ import annotations

from .config import credential, project_endpoint, chat_client

# Exact names created in Lab 2 — the orchestration references agents by name.
INTAKE = "Loan-Intake-Agent"
ENRICHMENT = "Financial-Enrichment-Agent"
RISK = "Credit-Risk-Analyst"
FRAUD_AML = "Fraud-AML-Analyst"
COMPLIANCE = "Compliance-Policy-Officer"
CHAIR = "Credit-Committee-Chair"
DECISION_LETTER = "Decision-Letter-Agent"
BRIEFING = "Underwriter-Briefing-Agent"

COMMITTEE = [RISK, FRAUD_AML, COMPLIANCE]
ALL_AGENTS = [INTAKE, ENRICHMENT, RISK, FRAUD_AML, COMPLIANCE, CHAIR, DECISION_LETTER, BRIEFING]


def bind(agent_name: str):
    """Bind to a portal-authored agent by name (hybrid model).

    VERIFY the exact factory against current preview docs:
    https://learn.microsoft.com/agent-framework/agents/providers/microsoft-foundry
    """
    from agent_framework.foundry import FoundryAgent

    # FoundryAgent binds to an existing service agent by name and is itself runnable.
    return FoundryAgent(
        agent_name=agent_name,
        project_endpoint=project_endpoint(),
        credential=credential(),
    )


def bind_from_code(agent_name: str):
    """Fallback: declare the agent in code over the model deployment.

    Rebuilds the agent from its Lab 2 instructions (short stubs below). Doubles as a
    teaching contrast to bind(): the same agent, once from the service and once in code.
    """
    from agent_framework import Agent

    return Agent(
        name=agent_name,
        instructions=INSTRUCTIONS.get(agent_name, "You are a helpful assistant."),
        client=chat_client(),
    )


def resolve(from_code: bool = False):
    """Return the chosen factory: name -> Agent."""
    return bind_from_code if from_code else bind


# Short instruction stubs for the fallback path. The full authored instructions live in
# ../foundry-workflow/agents.md — paste them here if you lean on --from-code.
INSTRUCTIONS = {
    INTAKE: "You are the Intake Officer at Meridian Commercial Bank. Parse the raw loan "
    "application into the applicant_profile JSON schema. Return ONLY JSON.",
    ENRICHMENT: "You are a Credit Analyst. From applicant_profile JSON compute the "
    "underwriting_fact_sheet (DSCR, LTV, leverage, credit band, policy checks). Return ONLY JSON.",
    RISK: "You are the Credit Risk Analyst on the committee. Assess repayment capacity, ratios, "
    "and collateral; propose a risk rating and rate tier.",
    FRAUD_AML: "You are the Fraud & AML Analyst. Flag fraud indicators and run a simulated "
    "AML/sanctions/PEP screen. End with 'FRAUD_AML_STATUS: CLEAR|REVIEW|FLAGGED'.",
    COMPLIANCE: "You are the Compliance & Policy Officer. Run fair-lending and policy-limit "
    "checks. End with 'COMPLIANCE_STATUS: COMPLIANT|CONDITIONS|NOT_COMPLIANT'.",
    CHAIR: "You are the Credit Committee Chair. Weigh the three opinions into a consensus "
    "committee_recommendation JSON and set requiresHumanSignoff per policy. Return ONLY JSON.",
    DECISION_LETTER: "You draft the applicant-facing approval or adverse-action letter.",
    BRIEFING: "You render the Chair's recommendation JSON into a short plain-English sign-off "
    "card for the Senior Underwriter.",
}
