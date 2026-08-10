A human might not reply for minutes — or days. A production sign‑off must survive the process exiting and restarting. The Agent Framework makes the paused run **durable** with **checkpoints**: the workflow's state (including the pending request) is persisted, and you can resume it later from a fresh process.

## Objectives

- Enable checkpointing with `FileCheckpointStorage`.
- **Pause** the borderline deal, exit the process, then **resume** it from the checkpoint.
- Understand why checkpoint storage is a **security boundary**.

## Concepts — checkpoints

Workflows run in **supersteps**; a checkpoint is written at the end of each. It captures executor state, shared state, queued messages, **and pending requests**. Restoring re‑emits the pending `request_info` event so you can answer it — even in a brand‑new run.

```python
from agent_framework import FileCheckpointStorage, WorkflowBuilder

storage = FileCheckpointStorage(storage_path="./checkpoints")

workflow = (
    WorkflowBuilder(start_executor=gate)
    .with_checkpointing(checkpoint_storage=storage)   # VERIFY exact builder call
    .build()
)

# Later, in a fresh process — list, pick the latest, resume:
checkpoints = await storage.list_checkpoints(workflow_name="meridian-underwriting")
latest = sorted(checkpoints, key=lambda c: c.timestamp, reverse=True)[0]
await workflow.run(checkpoint_id=latest.checkpoint_id, responses={request_id: "APPROVE"})
```

> [!CAUTION]
> **Checkpoint storage is a trust boundary.** A checkpoint contains the full run state. Store it in **trusted, access‑controlled** storage and **never resume from an untrusted or tampered checkpoint** — doing so replays attacker‑controlled state into your workflow. For the lab we use a local `./checkpoints` folder; in production use secured, private storage.

## Steps

- [ ] Enable checkpointing: run the borderline deal with `--checkpoint`: `python -m src.run --sample large --checkpoint`. When it pauses, **do not answer** — press `Ctrl+C` to exit.

- [ ] Confirm a checkpoint was written: list `./checkpoints` (a JSON state file per superstep).

- [ ] **Resume in a new process:** `python -m src.run --resume latest --decision APPROVE`. The workflow rehydrates, re‑emits the sign‑off request, applies your answer, and finishes the decision letter.

- [ ] Inspect `src/workflow.py` → `build_signoff_workflow()` to see where storage is attached, and `src/run.py` → `resume_from_checkpoint()` for the rehydrate path.

> [!NOTE]
> This is the durability Lab 2's in‑portal run could not give you: a sign‑off that outlives the session. It's also the foundation for **Lab 4**, where an approved decision triggers a real side effect.
