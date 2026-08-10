Everything you've run in this lab can be **traced** — every agent turn, the manager's planning, the human pause, the resume — as OpenTelemetry spans in **Application Insights**, the same resource Lab 2 traced into. This final module turns tracing on and reads the end‑to‑end story of one run.

## Objectives

- Send OpenTelemetry traces to **Application Insights** from code.
- Read a full underwriting run as a span tree.
- Connect the trace back to the concepts from Modules 03–08.

## Concepts — one line to trace

```python
# src/config.py
from azure.monitor.opentelemetry import configure_azure_monitor

def enable_tracing() -> None:
    conn = os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING")
    if conn:
        configure_azure_monitor(connection_string=conn)   # Foundry Observability
```

Call `enable_tracing()` once at startup (already wired in `src/run.py`) and the framework instruments agent calls, orchestration rounds, and workflow events for you.

## Steps

- [ ] Confirm `APPLICATIONINSIGHTS_CONNECTION_STRING` is set in your `\.env` (from your project's **Tracing / Observability** tab — the `appi-foundry-playground` resource from Lab 2).

- [ ] Run a full borderline deal with tracing on: `python -m src.run --sample large --trace`. Approve when prompted.

- [ ] In the [Foundry portal](https://ai.azure.com), open your project → **Observability / Tracing**, and find the run. Expand the span tree.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>
  <span><strong>Add your own screenshot:</strong> the run's span tree under <em>Observability / Tracing</em>, showing intake → committee → sign‑off → letter.</span>
  </div>

- [ ] Trace‑read the run: the **sequential intake** spans, the **Magentic manager** planning and delegating to the three specialists, the **request_info** pause, the resume, and the **decision letter**.

## Where this goes next

You've completed the flagship code lab. The same building blocks carry forward:

| Next | Builds on |
|---|---|
| **Lab 4 — Integrated & Autonomous** | On APPROVE, call a real line‑of‑business system; enforce approvals on side effects; deploy as a hosted agent. |
| **Lab 5 — Scale & Operate (AgentOps)** | Run the Module 08 evaluators **continuously**; watch cost/latency; version and roll out. |

> [!NOTE]
> This lab is the forward path from the portal Workflows designer (Lab 2), which retires **Dec 1, 2026**. The same underwriting logic now lives in code you own — traceable, testable, and ready to deploy.
