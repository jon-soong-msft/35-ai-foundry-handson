# Meridian Underwriting — Microsoft Agent Framework (Lab 3)

The **code** twin of Lab 2's portal workflow. You author the eight committee agents in the
Foundry portal (Lab 2), then **orchestrate them here in Python** with the Microsoft Agent
Framework — sequential intake, a **Magentic** credit committee, a **human‑in‑the‑loop**
sign‑off gate, durable **checkpointing**, an **evaluation harness**, and **tracing**.

This is the forward path as the portal Workflows designer retires (**Dec 1, 2026**).

> **Preview‑tracking scaffold.** The Agent Framework is in active preview; APIs shift between
> releases. `requirements.txt` asks you to pin a build, and volatile calls are marked `# VERIFY`
> with a doc link. Follow the live docs where they differ: https://learn.microsoft.com/agent-framework/

## Prerequisites

- The eight Lab 2 agents exist in your Foundry project, by name.
- Python 3.10+ and the Azure CLI — or just use the bundled `.devcontainer`.
- `az login` with **Contributor** (or higher) on the project.

## Setup

```bash
pip install -r requirements.txt
cp .env.sample .env      # then fill in the values
az login
```

## Run

| Command | Does |
|---|---|
| `python -m src.run --smoke` | Call one bound agent (setup check). |
| `python -m src.run --list-agents [--from-code]` | Ping all eight agents. |
| `python -m src.run --stage intake --sample small` | Sequential intake only (Module 03). |
| `python -m src.run --stage committee --sample large` | Magentic committee only (Module 04). |
| `python -m src.run --sample large [--checkpoint] [--trace]` | Full run with HITL sign‑off (05, 06, 09). |
| `python -m src.run --resume latest --decision APPROVE` | Resume a checkpointed sign‑off (Module 06). |
| `python -m src.evaluate` | Score both deals; gate on the sign‑off decision (Module 08). |

## Layout

| File | Module(s) |
|---|---|
| `src/config.py` | env, credential, client, tracing (01, 09) |
| `src/agents.py` | bind the 8 portal agents by name (02) |
| `src/workflow.py` | sequential, Magentic, HITL gate, checkpointing (03–06) |
| `src/samples.py` | two Meridian applications |
| `src/evaluate.py` | evaluation harness (08) |
| `src/run.py` | CLI + pause/resume loop |

## Hybrid model

Agents (instructions, JSON schemas, content filters, RBAC) are **authored in the portal**.
Only the **orchestration** lives here. See [`../ROADMAP.md`](../ROADMAP.md) for how this lab fits
the 5‑stage Implementation Path.
