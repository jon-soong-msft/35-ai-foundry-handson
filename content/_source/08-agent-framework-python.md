---
title: '08. Use Agent Framework for Python'
description: 'Complete this lab to use agent framework for python.'
lastUpdated: '2026-07-13'
track: 'introduction-foundry-agent-service'
module: 8
slug: '08-agent-framework-python'
estimatedTimeMinutes: 25
difficulty: 'intermediate'
prerequisites: ['Module 07']
audience:
  - 'attendee'
technologies:
  - 'Microsoft Foundry'
  - 'Python'
tags:
  - 'foundry'
  - 'use'
  - 'agent'
  - 'framework'
  - 'for'
status: 'active'
contentType: 'lab'
---
# 08. Use Agent Framework for Python

**Estimated time:** 25 minutes

![Microsoft Agent Framework overview: an open-source engine for building and orchestrating AI agents, summarised in five pillars - Unified SDK (AIAgent, AgentThread, and AgentTool primitives built on Microsoft.Extensions.AI), Local-first and cloud-agnostic (run agents locally then move the same code to Foundry Agent Service or any cloud containers), Multi-agent orchestration (sequential, concurrent, handoff, group chat, magentic, and workflow patterns), Tools and extensibility (out-of-the-box integrations plus functions, APIs, and MCP servers as tools), and Enterprise-grade foundations (approval flows, content-policy hooks, OpenTelemetry observability, and long-running execution).](../../../docs/assets/diagrams/agent-framework-introduction.png)

> [!IMPORTANT]
> This module builds on [Module 07 - Ground the agent with Foundry IQ knowledge bases](../07-foundry-iq/README.md). It connects to the grounded `acl-remedy-advisor` Prompt Agent you built across Modules 04-07 and runs it from Python with the Agent Framework.

<!-- markdownlint-disable-next-line MD028 -->
> [!NOTE]
> If you could not complete the earlier modules, recreate the agent's end state from code before continuing. The Module 08 solution script restores the grounded knowledge-base agent, which is a valid starting point for this module:
>
> ```bash
> uv run python labs/introduction-foundry-agent-service/08-agent-framework-python/solution/create_knowledge_base_agent.py
> ```
>
> This script also requires `KNOWLEDGE_BASE_NAME` and `AZURE_SEARCH_SERVICE_NAME` to be set in `.env` in addition to the variables from earlier modules. These should have been set by the lab onboarding.

<!-- markdownlint-disable-next-line MD028 -->
> [!TIP]
> Tick the checkbox next to each step as you complete it to track your progress through this module.

## Objectives

- Understand what the Microsoft Agent Framework is and why you would use it.
- Connect to the `acl-remedy-advisor` Prompt Agent you built in Modules 04-07
  from Python using the Agent Framework.
- Run the agent and print its response, then stream the response as it is
  generated.

## Concepts

So far you have built and tested the `acl-remedy-advisor` agent entirely in the
Foundry portal. The portal is excellent for designing, grounding, and testing a
single agent - but real applications call agents from code. That is where the
Microsoft Agent Framework comes in.

### What the Agent Framework is

The **[Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/?pivots=programming-language-python)** is an open-source SDK, available for both
Python and .NET, for building, running, and orchestrating AI agents and
[multi-agent workflows](https://learn.microsoft.com/en-us/agent-framework/workflows/?pivots=programming-language-python). It brings together the lessons from Semantic Kernel and
AutoGen into a single, consistent programming model.

### Why it exists

A chat playground gets you a working agent, but a production application needs
more:

- Call an agent from your own app, API, or background job.
- Add custom logic and your own function tools around the agent.
- Stream responses to a UI as they are generated.
- [Orchestrate several agents into a multi-agent workflow](https://learn.microsoft.com/en-us/agent-framework/workflows/?pivots=programming-language-python).
- Add observability, middleware, and consistent error handling.

The Agent Framework provides these building blocks with one programming model
that works the same way across model providers, so you are not rewriting your
app when the underlying model or service changes.

### What it enables

The framework gives you two complementary ways to work with Foundry:

1. **Connect to an agent you already built** - [`FoundryAgent`](https://learn.microsoft.com/en-us/agent-framework/agents/providers/microsoft-foundry/?pivots=programming-language-python) binds to an
   existing Prompt Agent or Hosted Agent by name. Its model, instructions, and
   tools all live on the Foundry service; you simply connect and run. This is
   the path you use in this module.
1. **Define an agent in code** - [`FoundryChatClient`](https://learn.microsoft.com/en-us/agent-framework/agents/providers/microsoft-foundry/?pivots=programming-language-python) plus [`Agent`](https://learn.microsoft.com/en-us/agent-framework/agents/?pivots=programming-language-python) let you
   declare a model, instructions, and tools directly in Python. You use this
   pattern in Module 10.

> [!NOTE]
> While this workshop focuses on Foundry, the SDK supports many other providers - including OpenAI, Azure OpenAI, Ollama, and more - so the same agent code runs against different backends without rewriting. See the [Providers Overview](https://learn.microsoft.com/en-us/agent-framework/agents/providers/?pivots=programming-language-python) for the full list.

In this module you take the agent that already exists in Foundry - the grounded
`acl-remedy-advisor` Prompt Agent from Module 07 - and run it from Python with
`FoundryAgent`, authenticating with `DefaultAzureCredential` so no keys appear in
your code.

## Steps

- [ ] Confirm the shared dependencies (which include `agent-framework`) are installed:

   ```bash
   uv sync
   ```

- [ ] Sign in with the Azure CLI so `DefaultAzureCredential` can authenticate. You are probably already signed in from earlier modules, but the authentication may have expired. Run the following command and follow the prompts to sign in again if necessary:

   ```bash
   az login
   ```

   > [!NOTE]
   > `AGENT_NAME` defaults to `acl-remedy-advisor`. Leave `AGENT_VERSION` empty to use the latest published version of the agent, or set it to pin a specific version.

- [ ] Confirm the `acl-remedy-advisor` agent exists in your Foundry project. If you did not finish Module 07, recreate its end state from the solution folder:

   ```bash
   uv run python labs/introduction-foundry-agent-service/08-agent-framework-python/solution/create_knowledge_base_agent.py
   ```

- [ ] Open `src/starter.py` and complete each TODO using the snippets below.

   **Snippet 1 - import the `FoundryAgent` client** (TODO 1):

   ```python
   from agent_framework.foundry import FoundryAgent
   ```

   **Snippet 2 - connect to the existing Prompt Agent** (TODO 2). The model, instructions, and tools are configured on the service, so you only pass the connection details:

   ```python
   agent = FoundryAgent(
       project_endpoint=endpoint,
       agent_name=agent_name,
       agent_version=agent_version,
       credential=credential,
   )
   ```

   **Snippet 3 - [run the agent once](https://learn.microsoft.com/en-us/agent-framework/agents/running-agents/?pivots=programming-language-python) and print the full response** (TODO 3):

   ```python
   result = await agent.run(QUERY)
   print(f'\nAgent:\n{result.text}\n')
   ```

   **Snippet 4 - run the agent again and [stream the response](https://learn.microsoft.com/en-us/agent-framework/agents/running-agents/?pivots=programming-language-python#streaming-and-non-streaming)** (TODO 4). Each chunk is printed as the agent generates it:

   ```python
   print('Agent (streaming): ', end='', flush=True)
   async for chunk in agent.run(QUERY, stream=True):
       if chunk.text:
           print(chunk.text, end='', flush=True)
   print('\n')
   ```

> [!IMPORTANT]
> **Confirm `RETAIL_REMEDY_OPS_MCP_SERVER_URL` is set before running the starter.** When your `QUERY` triggers an operational lookup, the agent calls the `retail_remedy_ops` MCP server from [Module 06](../06-mcp-tools/README.md) at the `RETAIL_REMEDY_OPS_MCP_SERVER_URL` in your `.env`. By default this is the shared **Azure Container Apps** server your organizer deployed, so there is nothing to keep running. If you are running your own copy locally instead, make sure it is still running with port 8080 set to **Public**:
>
> ```bash
> uv run python shared/mcp-servers/retail-remedy-ops/src/server.py
> ```

- [ ] Run the completed starter and confirm it connects to your project and returns a response:

   ```bash
   uv run python labs/introduction-foundry-agent-service/08-agent-framework-python/src/starter.py
   ```

- [ ] Change the `QUERY` string to a different retail scenario and rerun to observe a different grounded response.

- [ ] In the Foundry portal, open the `acl-remedy-advisor` agent and select the **Traces** tab to see your Python runs recorded alongside the playground conversations from earlier modules.

  <details>
  <summary>📸 Screenshot: Traces tab showing Python runs</summary>

  ![acl-remedy-advisor agent Traces tab with completed Python runs listed, showing Trace ID, Response ID, Status, Created at, Duration, token counts, and estimated cost](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-08/01-traces-python-runs.png)

  </details>

## Validation

- The starter runs without authentication or connection errors.
- The first call prints a complete answer under `Agent:`.
- The second call prints the same kind of answer token by token under
  `Agent (streaming):`.
- Changing the `QUERY` string changes the response.
- Your runs appear under the agent's **Traces** tab in the Foundry portal.

## Congratulations 🎉

You took your agent from the portal into code. Using the Microsoft Agent Framework, you connected to your grounded `acl-remedy-advisor` prompt agent from Python, ran it both synchronously and as a token-by-token stream, and saw your runs appear under the agent's **Traces** tab. You can now drive Foundry agents programmatically and observe exactly what they do.

> [!TIP]
> **Next up → [Module 09: Build and run a hosted agent](../09-hosted-agents/README.md)**
> Take full control of agent logic by building and running a code-first hosted agent. No need to scroll - jump straight in!

## Troubleshooting

- **Authentication fails** - the script uses `DefaultAzureCredential`, which
  relies on your Azure CLI session. Run `az login` in the terminal to
  re-authenticate, then confirm the active subscription with `az account show`.
- **`FOUNDRY_PROJECT_ENDPOINT` is missing** - confirm the endpoint and project
  name with `azd env get-values`, then set `FOUNDRY_PROJECT_ENDPOINT` in your
  `.env` file.
- **Agent not found** - confirm `AGENT_NAME` matches the agent in your project
  (default `acl-remedy-advisor`). If you skipped Module 07, run
  `solution/create_knowledge_base_agent.py` to create it.
- **Version error on a Prompt Agent** - leave `AGENT_VERSION` empty to use the
  latest published version, or set it to a specific version shown on the agent's
  page in the Foundry portal.
- **`agent_framework` is not installed** - run `uv sync` from the repo root to reinstall all dependencies.
