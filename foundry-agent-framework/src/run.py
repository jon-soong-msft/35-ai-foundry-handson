"""CLI entry point for the Meridian underwriting orchestration.

    python -m src.run --smoke
    python -m src.run --list-agents [--from-code]
    python -m src.run --stage intake|committee --sample small|large
    python -m src.run --sample small|large [--checkpoint] [--trace]
    python -m src.run --resume latest --decision APPROVE
"""
from __future__ import annotations

import argparse
import asyncio
import json

from . import workflow as wf
from .agents import ALL_AGENTS, INTAKE, resolve
from .config import enable_tracing
from .samples import SAMPLES

CHECKPOINT_DIR = "./checkpoints"


async def smoke() -> None:
    agent = resolve(False)(INTAKE)
    print(await agent.run(SAMPLES["small"]))


async def list_agents(from_code: bool) -> None:
    make = resolve(from_code)
    for name in ALL_AGENTS:
        print(f"[check] {name}", flush=True)
        try:
            reply = await make(name).run("Reply with OK if you are online.")
            print(f"[ok]   {name}: {reply}")
        except Exception as exc:  # noqa: BLE001 - scaffold diagnostics
            print(f"[fail] {name}: {exc}")


async def run_stage(stage: str, sample: str, from_code: bool) -> None:
    text = SAMPLES[sample]
    if stage == "intake":
        result = await wf.build_intake_workflow(from_code).run(text)
        print(_final_output(result))
    elif stage == "committee":
        result = await wf.build_committee_workflow(from_code).run(text)
        recommendation = await wf.synthesize_recommendation(
            text, _final_output(result), from_code
        )
        print(json.dumps(recommendation, indent=2))
    else:
        return


async def run_full(sample: str, checkpoint: bool, from_code: bool) -> None:
    text = SAMPLES[sample]
    fact_sheet = _final_output(await wf.build_intake_workflow(from_code).run(text))          # Module 03
    committee = _final_output(await wf.build_committee_workflow(from_code).run(fact_sheet))  # Module 04
    rec = await wf.synthesize_recommendation(fact_sheet, committee, from_code)               # Module 04b: Chair
    signoff = wf.build_signoff_workflow(CHECKPOINT_DIR if checkpoint else None)  # Modules 05/06
    await _drive_signoff(signoff, rec)


async def _drive_signoff(signoff, rec: dict) -> None:
    result = await signoff.run(rec)
    requests = _pending_requests(result)
    while requests:
        responses = {}
        for req in requests:
            print("\n" + getattr(req.data, "briefing", str(req.data)))
            responses[req.request_id] = input("Decision [APPROVE/DECLINE/REVISE]: ").strip().upper()
        result = await signoff.run(responses=responses)
        requests = _pending_requests(result)
    print("\nFinal:", _final_output(result))


async def resume_from_checkpoint(which: str, decision: str) -> None:
    from agent_framework import FileCheckpointStorage

    storage = FileCheckpointStorage(
        storage_path=CHECKPOINT_DIR,
        allowed_checkpoint_types=wf.CHECKPOINT_ALLOWED_TYPES,
    )
    checkpoints = await storage.list_checkpoints(workflow_name=wf.WORKFLOW_NAME)  # VERIFY
    pending = [checkpoint for checkpoint in checkpoints if checkpoint.pending_request_info_events]
    if not pending:
        raise SystemExit("no pending checkpoints found — run with --checkpoint first")
    latest = sorted(pending, key=lambda checkpoint: checkpoint.timestamp, reverse=True)[0]
    signoff = wf.build_signoff_workflow(CHECKPOINT_DIR)
    result = await signoff.run(checkpoint_id=latest.checkpoint_id)   # rehydrate pending request
    responses = {r.request_id: decision.strip().upper() for r in _pending_requests(result)}
    result = await signoff.run(responses=responses)
    print("Final:", _final_output(result))


def _pending_requests(result):
    getter = getattr(result, "get_request_info_events", None)
    return list(getter()) if getter else []


def _text(value) -> str:
    return getattr(value, "text", None) or str(value)


def _final_output(result) -> str:
    """The workflow's final emitted output as text — not the raw event log."""
    outputs = result.get_outputs()
    return _text(outputs[-1]) if outputs else _text(result)


def main() -> None:
    p = argparse.ArgumentParser(description="Meridian underwriting — Agent Framework scaffold")
    p.add_argument("--smoke", action="store_true")
    p.add_argument("--list-agents", action="store_true")
    p.add_argument("--from-code", action="store_true", help="use code-declared agents (fallback)")
    p.add_argument("--stage", choices=["intake", "committee"])
    p.add_argument("--sample", choices=list(SAMPLES), default="small")
    p.add_argument("--checkpoint", action="store_true", help="durable HITL via checkpoints")
    p.add_argument("--resume", metavar="latest")
    p.add_argument("--decision", default="APPROVE")
    p.add_argument("--trace", action="store_true", help="send traces to Application Insights")
    args = p.parse_args()

    if args.trace:
        print("tracing:", "on" if enable_tracing() else "no APPLICATIONINSIGHTS_CONNECTION_STRING")

    if args.smoke:
        asyncio.run(smoke())
    elif args.list_agents:
        asyncio.run(list_agents(args.from_code))
    elif args.resume:
        asyncio.run(resume_from_checkpoint(args.resume, args.decision))
    elif args.stage:
        asyncio.run(run_stage(args.stage, args.sample, args.from_code))
    else:
        asyncio.run(run_full(args.sample, args.checkpoint, args.from_code))


if __name__ == "__main__":
    main()
