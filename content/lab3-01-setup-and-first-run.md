In **Lab 2** you composed the eight Meridian credit‑committee agents into a workflow **visually**, in the portal designer. In **Lab 3** you rebuild that same underwriting flow in **code** with the **Microsoft Agent Framework (Python)** — the forward path as the portal designer retires (Dec 1, 2026). This first module gets your code environment running and makes one round‑trip to a portal‑authored agent.

> [!IMPORTANT]
> **Preview‑tracking scaffold.** The Microsoft Agent Framework is in active preview and its APIs shift between releases. This lab **pins a version** in `requirements.txt`, and every spot where the preview surface is volatile is flagged with a `# VERIFY` comment in the code and a link to the current doc. Treat the snippets as a close guide, and follow the live [Agent Framework docs](https://learn.microsoft.com/agent-framework/) where they differ.

## Objectives

- Open the `foundry-agent-framework/` project in its **devcontainer** (or a local virtual environment).
- Install `agent-framework` + `azure-identity` and sign in with `az login`.
- Configure your **project endpoint**, **model**, and **Application Insights** connection.
- Run a **smoke test** that calls one portal‑authored agent from Python.

## Concepts — the hybrid model

You keep the agents where they are easiest to author and govern — **in the portal** — and you move only the **orchestration** into code:

| Authored in the portal (Lab 2) | Written in code (Lab 3) |
|---|---|
| The 8 prompt agents: instructions, model, JSON‑schema outputs | Sequential, Magentic, and HITL orchestration |
| Content filters, RBAC, knowledge | Checkpointing, memory, evaluation, tracing |

This is the delivery model for every code lab in the course: **author in the portal, orchestrate in code.**

## Steps

### Part 1 — Open the project

- [ ] Open the `foundry-agent-framework/` folder in VS Code. When prompted, **Reopen in Container** to use the bundled `.devcontainer` (Python + the Azure CLI preinstalled). *Local alternative:* create a venv and `pip install -r requirements.txt`.

- [ ] In the devcontainer terminal, confirm the install: `python -c "import agent_framework, azure.identity; print('ok')"`.

### Part 2 — Authenticate

- [ ] Sign in so `DefaultAzureCredential` / `AzureCliCredential` can get tokens: `az login` (add `--tenant <your-tenant>` if you have several).

- [ ] Confirm you can see the project: `az account show`. You need **Contributor** (or higher) on the Foundry project — the same access you used in Lab 2.

### Part 3 — Configure

- [ ] Copy `\.env.sample` to `\.env` and fill in the three values (defaults point at the Lab 2 `proj-foundry-playground` project):

  ```bash
  FOUNDRY_PROJECT_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>
  FOUNDRY_MODEL=gpt-5
  APPLICATIONINSIGHTS_CONNECTION_STRING=<from your project's Tracing/Observability tab>
  ```

### Part 4 — First run

- [ ] Smoke‑test one agent end‑to‑end: `python -m src.run --smoke`. It binds to `Loan-Intake-Agent` and prints a structured `applicant_profile` for a tiny sample application.

- [ ] If you see JSON come back, your environment, auth, and agent binding all work. Continue to Module 02.

> [!TIP]
> No agents in your project yet? They come from **Lab 2 · Module 02**. Create the eight agents there first — Lab 3 reuses them by name, so nothing needs re‑authoring.
