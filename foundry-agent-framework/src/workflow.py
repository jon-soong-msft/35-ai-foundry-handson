"""Meridian underwriting, orchestrated in code with the Agent Framework.

Stages: sequential intake -> Magentic committee -> HITL sign-off gate -> letter.
Each function maps to a Lab 3 module. Preview APIs are marked `# VERIFY`.
"""
import json
from dataclasses import dataclass
from typing import Any, Never

from agent_framework import Executor, WorkflowBuilder, WorkflowContext, handler, response_handler

from .agents import CHAIR, COMPLIANCE, ENRICHMENT, FRAUD_AML, INTAKE, RISK, resolve

SIGNOFF_AMOUNT_THRESHOLD = 250_000
WORKFLOW_NAME = "meridian-underwriting"
CHECKPOINT_ALLOWED_TYPES = ["src.workflow:SignoffRequest"]


# --- Module 03: Sequential intake -------------------------------------------
def build_intake_workflow(from_code: bool = False):
    """Loan-Intake-Agent -> Financial-Enrichment-Agent (Sequential orchestration)."""
    from agent_framework.orchestrations import SequentialBuilder

    make = resolve(from_code)
    return SequentialBuilder(participants=[make(INTAKE), make(ENRICHMENT)]).build()


# --- Module 04: Magentic committee ------------------------------------------
def build_committee_workflow(from_code: bool = False):
    """Risk + Fraud/AML + Compliance, coordinated by a neutral Magentic manager."""
    from agent_framework import Agent
    from agent_framework.orchestrations import MagenticBuilder

    from .config import chat_client, manager_model

    make = resolve(from_code)
    risk, fraud, compliance = make(RISK), make(FRAUD_AML), make(COMPLIANCE)
    # The Chair's strict committee_recommendation schema can't emit the progress
    # ledger's next_speaker, so the manager must be a neutral, free-form agent.
    manager_instructions = (
        f"You coordinate a credit committee of three specialists: {RISK}, "
        f"{FRAUD_AML}, and {COMPLIANCE}. Have each specialist assess the deal at "
        "least once, then mark the request satisfied and synthesize their "
        "contributions into a consensus summary. Don't recall a speaker whose "
        "point is already made."
    )
    manager = Agent(
        name="Magentic-Manager",
        instructions=manager_instructions,
        client=chat_client(manager_model()),
    )
    return MagenticBuilder(
        participants=[risk, fraud, compliance],
        intermediate_output_from=[risk, fraud, compliance],
        manager_agent=manager,
        max_round_count=6,
        max_stall_count=2,
        max_reset_count=2,
    ).build()


# --- Module 04b: Chair synthesis --------------------------------------------
async def synthesize_recommendation(
    fact_sheet: str, deliberation: str, from_code: bool = False
) -> dict[str, Any]:
    """Turn the committee's free-form deliberation into committee_recommendation JSON.

    The neutral Magentic manager emits prose, so the Chair (schema intact) runs once
    more here to produce the structured recommendation the sign-off gate consumes.
    """
    chair = resolve(from_code)(CHAIR)
    reply = await chair.run(
        f"UNDERWRITING FACT SHEET:\n{fact_sheet}\n\n"
        f"COMMITTEE DELIBERATION:\n{deliberation}\n\n"
        "Weigh these into the committee_recommendation JSON."
    )
    recommendation = parse_recommendation(getattr(reply, "text", None) or str(reply))
    return _add_fact_sheet_context(recommendation, fact_sheet)


# --- Module 05: the sign-off gate -------------------------------------------
def requires_human_signoff(rec: dict[str, Any]) -> bool:
    """Meridian delegated-authority policy — material triggers only (same as Lab 2)."""
    amount = float(rec.get("requestedAmount", 0) or 0)
    decision = str(rec.get("decision", "")).lower()
    credit_band = str(rec.get("creditBand", "")).lower()
    return (
        amount >= SIGNOFF_AMOUNT_THRESHOLD
        or decision == "decline"
        or str(rec.get("complianceStatus", "")).upper() == "NOT_COMPLIANT"
        or str(rec.get("fraudAmlStatus", "")).upper() == "FLAGGED"
        or credit_band in {"marginal", "poor"}
    )


@dataclass
class SignoffRequest:
    briefing: str
    recommendation: dict[str, Any]


class HumanSignoffExecutor(Executor):
    """Modules 05/06: pause for a Senior Underwriter when policy demands it."""

    def __init__(self) -> None:
        super().__init__(id="human_signoff")

    @handler
    async def review(self, rec: dict[str, Any], ctx: WorkflowContext[Never, dict[str, Any]]) -> None:
        if requires_human_signoff(rec):
            await ctx.request_info(
                request_data=SignoffRequest(briefing=_briefing_card(rec), recommendation=rec),
                response_type=str,  # "APPROVE" | "DECLINE" | "REVISE"
            )
        else:
            await ctx.yield_output(_auto_finalize(rec))

    @response_handler
    async def on_decision(
        self, req: SignoffRequest, decision: str, ctx: WorkflowContext[Never, dict[str, Any]]
    ) -> None:
        await ctx.yield_output(_apply_decision(req.recommendation, decision))


def build_signoff_workflow(checkpoint_dir: str | None = None):
    """Wrap the gate in a workflow, optionally durable via FileCheckpointStorage."""
    gate = HumanSignoffExecutor()
    storage = None
    if checkpoint_dir:
        from agent_framework import FileCheckpointStorage

        storage = FileCheckpointStorage(
            storage_path=checkpoint_dir,
            allowed_checkpoint_types=CHECKPOINT_ALLOWED_TYPES,
        )
    builder = WorkflowBuilder(
        name=WORKFLOW_NAME,
        start_executor=gate,
        checkpoint_storage=storage,
    )
    return builder.build()


# --- helpers ----------------------------------------------------------------
def _briefing_card(rec: dict[str, Any]) -> str:
    return (
        f"SIGN-OFF REQUIRED — {rec.get('businessName', 'applicant')}\n"
        f"Amount: {rec.get('requestedAmount')}  Decision: {rec.get('decision')}  "
        f"Credit band: {rec.get('creditBand')}\n"
        "Reply APPROVE / DECLINE / REVISE."
    )


def _auto_finalize(rec: dict[str, Any]) -> dict[str, Any]:
    return {**rec, "finalDecision": rec.get("decision", "Approve"), "signoff": "auto"}


def _apply_decision(rec: dict[str, Any], decision: str) -> dict[str, Any]:
    return {**rec, "finalDecision": decision.strip().upper(), "signoff": "human"}


def _add_fact_sheet_context(rec: dict[str, Any], fact_sheet: str) -> dict[str, Any]:
    """Carry application metadata omitted by the Chair's strict output schema."""
    try:
        facts = parse_recommendation(fact_sheet)
    except (json.JSONDecodeError, TypeError):
        return rec

    aliases = {
        "businessName": {"businessname", "applicantname"},
        "requestedAmount": {"requestedamount", "loanamount"},
        "creditBand": {"creditband", "creditriskband"},
    }
    enriched = dict(rec)
    for output_key, source_keys in aliases.items():
        if enriched.get(output_key) is None:
            value = _find_nested_value(facts, source_keys)
            if value is not None:
                enriched[output_key] = value
    return enriched


def _find_nested_value(value: Any, normalized_keys: set[str]) -> Any:
    if isinstance(value, dict):
        for key, item in value.items():
            normalized = "".join(character for character in key.lower() if character.isalnum())
            if normalized in normalized_keys and item is not None:
                return item
        for item in value.values():
            found = _find_nested_value(item, normalized_keys)
            if found is not None:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _find_nested_value(item, normalized_keys)
            if found is not None:
                return found
    return None


def parse_recommendation(text: str) -> dict[str, Any]:
    """Best-effort parse of the Chair's JSON output (tolerates prose around it)."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start : end + 1])
        raise
