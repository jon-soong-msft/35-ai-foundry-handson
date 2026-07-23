---
title: '10. Foundry Toolboxes'
description: 'Complete this lab to create a Foundry Toolbox, enable Tool Search, and deploy a hosted agent that consumes the toolbox as its single tool endpoint.'
lastUpdated: '2026-07-19'
track: 'introduction-foundry-agent-service'
module: 10
slug: '10-foundry-toolboxes'
estimatedTimeMinutes: 30
difficulty: 'intermediate'
prerequisites: ['Module 06', 'Module 08', 'Module 09']
audience:
  - 'attendee'
technologies:
  - 'Microsoft Foundry'
  - 'Python'
tags:
  - 'foundry'
  - 'toolbox'
  - 'tool-search'
  - 'hosted-agent'
status: 'active'
contentType: 'lab'
---
# 10. Foundry Toolboxes

![Diagram showing the Foundry Toolbox architecture - Build and Consume pillars expose a curated set of tools through a single MCP-compatible endpoint consumed by any agent framework.](../../../docs/assets/diagrams/foundry-toolbox.png)

**Estimated time:** 30 minutes

> [!NOTE]
> **Preview notice**: Foundry Toolboxes are generally available. **Tool Search** (`toolbox_search_preview`) remains in public preview and portal UI may change. See [Supplemental Terms of Use for Microsoft Azure Previews](https://azure.microsoft.com/support/legal/preview-supplemental-terms/).

<!-- markdownlint-disable-next-line MD028 -->
> [!IMPORTANT]
> This capstone module builds on three earlier modules:
>
> - [Module 06 - Integrate MCP tools](../06-mcp-tools/README.md): you need the `retail_remedy_ops` MCP server URL (`RETAIL_REMEDY_OPS_MCP_SERVER_URL`) - the shared Azure Container Apps server, or your own tunnel.
> - [Module 08 - Use Agent Framework for Python](../08-agent-framework-python/README.md): the hosted agent is a Python **Microsoft Agent Framework** app, reusing the client and agent patterns introduced there.
> - [Module 09 - Deploy hosted agents](../09-hosted-agents/README.md): you publish the agent as a hosted agent from **source code**, exactly as in Module 09, Part 2 - this module replaces its tools with the toolbox.

<!-- markdownlint-disable-next-line MD028 -->
> [!NOTE]
> If you could not complete Module 06, set `RETAIL_REMEDY_OPS_MCP_SERVER_URL` to the shared server URL from your organizer (or run and tunnel your own as described in Module 06) before continuing.

<!-- markdownlint-disable-next-line MD028 -->
> [!TIP]
> Tick the checkbox next to each step as you complete it to track your progress through this module.

## Objectives

- Bundle the **Retail Remedy Operations MCP server**, **Web Search**, and **Code Interpreter** into a single **Foundry Toolbox** managed through the portal.
- Enable **Tool Search** so the toolbox exposes tools by intent rather than returning the full tool list.
- Deploy a **hosted agent** from **source code** - as a new version of the `acl-remedy-advisor-hosted-code` agent from Module 09 - whose only tool is the toolbox.
- Invoke the hosted agent from code and confirm it produces a correct Australian Consumer Law remedy using Tool Search behind the toolbox endpoint.
- Inspect the agent in the portal and review its run traces and metrics.

## Concepts

### What is a Foundry Toolbox?

A **Foundry Toolbox** is a centrally managed collection of tools exposed through a single MCP-compatible endpoint. Instead of each agent wiring its own connections, you define the tools once in a toolbox and any agent connects to a single URL.

Key benefits:

| Benefit | Detail |
|---|---|
| **Centralised management** | Rotate credentials, swap servers, or add new tools without redeploying agents |
| **Versioning** | Create a new toolbox version, test it, then promote it to default when ready |
| **Guardrails** | Apply a named RAI content policy to all tool inputs and outputs at the toolbox layer |
| **Discoverability** | Any agent or MCP client in the organisation can reuse the same toolbox endpoint |

### What is Tool Search?

When a toolbox contains many tools, passing all definitions to the model on every turn wastes tokens and dilutes focus. **Tool Search** solves this by replacing the full tool list with two meta-tools:

| Meta-tool | What the model does |
|---|---|
| `tool_search` | Calls with a natural-language description of what it needs; Foundry returns the matching tool definitions |
| `call_tool` | Invokes any tool returned by `tool_search` |

The model never browses a full tool list - it describes intent, discovers the right tools, and calls them. The agent instructions need to tell the model to call `tool_search` when a needed tool is not already visible.

> [!NOTE]
> Tool descriptions drive match quality. A vague or missing description causes poor discovery. Every tool added to the toolbox should have a clear description.

### Why a hosted agent — not a prompt agent?

The toolbox MCP endpoint is an **authenticated Foundry service**. Every request — including the initial MCP handshake — must carry an Entra bearer token scoped to `https://ai.azure.com/.default`.

**Prompt-based agents** configured through the Foundry portal tool picker can add MCP servers, but the portal's MCP tool configuration cannot inject a per-request Entra bearer token onto the connection. Because the toolbox endpoint requires that token, prompt agents cannot connect to it today. This is [documented by Microsoft](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/toolbox): the official toolbox integration docs describe only hosted agents (Microsoft Agent Framework, LangGraph, Copilot SDK) as consumers.

**Hosted agents** written in code can inject the token themselves. `src/agent/main.py` does this by wrapping the toolbox endpoint in an `httpx.AsyncClient` with a custom `auth` handler that fetches a fresh token on every request, then passes that client to `MCPStreamableHTTPTool`.

Rather than run that app locally, you **deploy it as a hosted agent from source code** — the same publish flow as [Module 09, Part 2](../09-hosted-agents/README.md). Foundry builds the container, runs it managed, and gives the agent its own per-deploy Microsoft Entra identity. That identity authenticates to the toolbox endpoint, so the deployed agent reaches every tool — the retail MCP server, web search, and code interpreter — through the single toolbox URL with no local process to keep running.

This is the capstone pattern: **one managed agent, one toolbox endpoint, every tool discovered through Tool Search.**

## Steps

### Prepare

- [ ] Confirm the shared dependencies are installed:

  ```bash
  uv sync
  ```

- [ ] Sign in with the Azure CLI so `DefaultAzureCredential` can authenticate:

  ```bash
  az login
  ```

  > [!NOTE]
  > Your `.env` file is pre-configured by workshop provisioning. Confirm it sets:
  >
  > | Variable | Description |
  > |---|---|
  > | `FOUNDRY_PROJECT_ENDPOINT` | Your Foundry project endpoint |
  > | `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID |
  > | `AZURE_RESOURCE_GROUP` | Your resource group |
  > | `FOUNDRY_RESOURCE_NAME` | Your Foundry account name |
  > | `TOOLBOX_NAME` | `acl-remedy-toolbox` |
  > | `RETAIL_REMEDY_OPS_MCP_SERVER_URL` | The shared MCP server URL ending in `/mcp` |
  >
  > `HOSTED_AGENT_NAME_CODE` defaults to `acl-remedy-advisor-hosted-code` and `AGENT_MODEL` defaults to `chat`. Set them in `.env` only if your deployment uses different names.

---

### Part 1 - Get the MCP server URL

The toolbox wraps the same `retail_remedy_ops` MCP server from Module 06. You need its public URL (`RETAIL_REMEDY_OPS_MCP_SERVER_URL`) to add it to the toolbox.

#### 1. Confirm your MCP server URL

- [ ] Open your `.env` file and confirm `RETAIL_REMEDY_OPS_MCP_SERVER_URL` is set to the shared server URL your organizer provided, ending in `/mcp`. For example:

  ```text
  https://ca-mcp-<env>.<region>.azurecontainerapps.io/mcp
  ```

- [ ] Save this URL - you will paste it into the toolbox configuration in the next part.

  > [!NOTE]
  > If you are running your own MCP server instead of the shared one, make sure it is still running with port 8080 set to **Public**, and use its tunnel URL (ending in `/mcp`) as your `RETAIL_REMEDY_OPS_MCP_SERVER_URL`. See [Module 06](../06-mcp-tools/README.md), Part 1.

---

### Part 2 - Create the toolbox in the Foundry portal

> [!NOTE]
> If **Toolboxes** is not visible in the portal navigation below, use the [Python fallback](#code-fallback---create-the-toolbox-with-python) at the end of this part.

#### 2. Navigate to Toolboxes

- [ ] In a browser, navigate to [Microsoft Foundry](https://ai.azure.com) and sign in.
- [ ] In the left navigation, click **Build**.
- [ ] Under **Build**, click **Tools**.
- [ ] Select the **Toolboxes** tab.

  <details>
  <summary>📸 Screenshot: Tools page - Toolboxes tab</summary>

  ![Foundry portal Tools page with the Toolboxes tab selected, showing the option to create a new toolbox.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/01-tools-toolboxes-tab.png)

  </details>

#### 3. Create a new toolbox

- [ ] Click **+ Create** or **+ New toolbox**.
- [ ] Enter the following details:

  | Field | Value |
  |---|---|
  | Name | `acl-remedy-toolbox` |
  | Description | `Retail Remedy operations tools, web search, and code interpreter for ACCC and ACL guidance` |

  <details>
  <summary>📸 Screenshot: Create toolbox form</summary>

  ![Create toolbox form showing the name acl-remedy-toolbox and a description field for the new toolbox.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/02-toolbox-create-form.png)

  </details>

#### 4. Add the Web Search tool

- [ ] In the tool configuration area, click **+ Add tool**.
- [ ] Select **Web Search** from the tool picker.
- [ ] In the tool **Description** field, enter:

  ```text
  Search the web for ACCC rulings, Australian Consumer Law guidance, and current retail policy information.
  ```

  > This description is used by Tool Search to route queries. Make it specific to what users will ask about.

#### 5. Add the MCP tool

- [ ] Click **+ Add tool** again.
- [ ] Select **MCP** (or **Model Context Protocol** / **Custom MCP**) from the tool picker.
- [ ] Fill in the connection details:

  | Field | Value |
  |---|---|
  | Label / Server name | `retail_remedy_ops` |
  | Server URL | Your `RETAIL_REMEDY_OPS_MCP_SERVER_URL` (ending in `/mcp`) |
  | Authentication | None / Anonymous |
  | Description | `Retail Remedy Operations tools for looking up purchases, product profiles, store policies, replacement options, and creating remedy cases.` |

- [ ] Confirm the six MCP tools are discovered from the MCP server: `lookup_purchase`, `get_product_profile`, `search_store_policy`, `find_replacement_options`, `draft_remedy_summary`, `create_remedy_case`.

  <details>
  <summary>📸 Screenshot: MCP tool added to the toolbox</summary>

  ![Toolbox configuration showing the retail_remedy_ops MCP server added, with its discovered tools listed.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/04-mcp-tool-use-in-toolbox.png)

  </details>

  <details>
  <summary>📸 Screenshot: Toolbox detail with the MCP server</summary>

  ![Toolbox detail view showing the acl-remedy-toolbox with the retail_remedy_ops MCP server and its description.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/05-toolbox-detail-with-mcp.png)

  </details>

#### 6. Add the Code Interpreter tool

- [ ] Click **+ Add tool** again.
- [ ] Select **Code Interpreter** from the tool picker.

  > Code Interpreter runs calculations such as pro-rata refund amounts. Including it in the toolbox keeps every capability the app needs behind the single toolbox endpoint.

  <details>
  <summary>📸 Screenshot: Adding Code Interpreter to the toolbox</summary>

  ![Tool picker showing Code Interpreter being added to the acl-remedy-toolbox.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/06-toolbox-add-code-interpreter.png)

  </details>

- [ ] Confirm the toolbox now lists all three tools: **Web Search**, the `retail_remedy_ops` MCP server, and **Code Interpreter**.

  <details>
  <summary>📸 Screenshot: Toolbox with three tools</summary>

  ![Toolbox configuration showing all three tools - Web Search, the retail_remedy_ops MCP server, and Code Interpreter.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/07-toolbox-three-tools.png)

  </details>

#### 7. Enable Tool Search

- [ ] Look for a **Tool search** toggle or checkbox in the toolbox configuration.
- [ ] Enable it.

  > Enabling Tool Search adds the `toolbox_search_preview` configuration to the toolbox version. This hides the individual tools from the initial `tools/list` response and exposes them through `tool_search` instead, keeping the consuming app's active tool context small.

#### 8. Publish the toolbox and set it as the default version

- [ ] Click **Publish** (or **Save** / **Create**).
- [ ] Confirm a toolbox named `acl-remedy-toolbox` is created.
- [ ] Confirm the published version is set as the **default** version. The consumer endpoint resolves `?api-version=v1` to the default version, so this must be set for the app in Part 3 to connect.

  <details>
  <summary>📸 Screenshot: Toolbox published and set as default</summary>

  ![Toolbox list showing acl-remedy-toolbox published with a version marked as the default.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/03-toolbox-published.png)

  </details>

  <details>
  <summary>📸 Screenshot: Toolbox saved with three tools as the default version</summary>

  ![Toolbox detail confirming acl-remedy-toolbox saved with Web Search, the MCP server, and Code Interpreter as the default version.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/08-toolbox-saved-v3.png)

  </details>

#### 9. Copy the toolbox MCP endpoint

- [ ] After publishing, locate the **Consumer endpoint** URL for `acl-remedy-toolbox`. It has the form:

  ```text
  https://<account>.services.ai.azure.com/api/projects/<project>/toolboxes/acl-remedy-toolbox/mcp?api-version=v1
  ```

  The app in Part 3 builds this URL automatically from `FOUNDRY_PROJECT_ENDPOINT` and `TOOLBOX_NAME`, so you do not need to paste it anywhere - but confirm it matches the endpoint shown in the portal.

#### Code fallback - Create the toolbox with Python

If the Toolboxes UI is not available in your portal or you prefer to use code, run the fallback script instead of completing Steps 2–9. `RETAIL_REMEDY_OPS_MCP_SERVER_URL` must be set in your `.env` file.

- [ ] Run the setup script from the repository root:

  ```bash
  uv run python labs/introduction-foundry-agent-service/10-foundry-toolboxes/solution/setup_toolbox.py
  ```

  The script creates the `acl-remedy-toolbox` toolbox with Web Search, the `retail_remedy_ops` MCP server, Code Interpreter, and Tool Search enabled, promotes the new version to the toolbox default, then prints the consumer endpoint URL.

- [ ] Confirm the script prints `Default version for acl-remedy-toolbox is now ...` and the consumer endpoint URL. Continue with Part 3.

---

### Part 3 - Deploy the toolbox-wired agent as a hosted agent

You now deploy a **hosted agent** whose only tool is the toolbox. The agent is a Python **Microsoft Agent Framework** app (as in Module 08) that points its tool at the toolbox's MCP endpoint and supplies an Entra bearer token on every request. You publish it from **source code** as a new version of the `acl-remedy-advisor-hosted-code` agent from Module 09 - Foundry builds and runs it managed, and its per-deploy identity authenticates to the toolbox.

#### 10. Review the agent bundle

- [ ] Open the agent bundle in [`src/agent/`](https://github.com/PlagueHO/foundry-agentic-workshop/tree/main/labs/introduction-foundry-agent-service/10-foundry-toolboxes/src/agent) and review how it wires the toolbox into a hosted agent:
  - [`main.py`](https://github.com/PlagueHO/foundry-agentic-workshop/blob/main/labs/introduction-foundry-agent-service/10-foundry-toolboxes/src/agent/main.py) builds the toolbox MCP endpoint as `{FOUNDRY_PROJECT_ENDPOINT}/toolboxes/{TOOLBOX_NAME}/mcp?api-version=v1`, wraps it in an `MCPStreamableHTTPTool` backed by an `httpx.AsyncClient` that attaches a fresh Entra bearer token to every request, builds a `FoundryChatClient` and an `Agent` whose instructions tell the model to call `tool_search` when a needed tool is not already visible, and serves it over the **Responses** protocol with `ResponsesHostServer`.
  - [`agent.yaml`](https://github.com/PlagueHO/foundry-agentic-workshop/blob/main/labs/introduction-foundry-agent-service/10-foundry-toolboxes/src/agent/agent.yaml) declares the hosted agent (`acl-remedy-advisor-hosted`), the Responses protocol, the 1 vCPU / 2 GiB shape, and the baked environment variables.
  - [`requirements.txt`](https://github.com/PlagueHO/foundry-agentic-workshop/blob/main/labs/introduction-foundry-agent-service/10-foundry-toolboxes/src/agent/requirements.txt) and [`Dockerfile`](https://github.com/PlagueHO/foundry-agentic-workshop/blob/main/labs/introduction-foundry-agent-service/10-foundry-toolboxes/src/agent/Dockerfile) define the runtime Foundry builds remotely.

  > The agent reads `FOUNDRY_PROJECT_ENDPOINT` from the runtime environment Foundry injects, and `AZURE_AI_MODEL_DEPLOYMENT_NAME` and `TOOLBOX_NAME` from the values baked in at deploy time. It carries **no** MCP server URL - every tool now lives behind the toolbox.

#### 11. Confirm the required environment variables

- [ ] Confirm your `.env` file sets:

  | Variable | Value |
  |---|---|
  | `FOUNDRY_PROJECT_ENDPOINT` | Your Foundry project endpoint |
  | `AZURE_SUBSCRIPTION_ID` | Your subscription ID |
  | `AZURE_RESOURCE_GROUP` | Your resource group |
  | `FOUNDRY_RESOURCE_NAME` | Your Foundry account name |
  | `TOOLBOX_NAME` | `acl-remedy-toolbox` |

  > `HOSTED_AGENT_NAME_CODE` defaults to `acl-remedy-advisor-hosted-code` and `AGENT_MODEL` defaults to `chat`. Set them in `.env` only if your deployment uses different names.

#### 12. Deploy the agent from source code

- [ ] Run the deploy script from the repository root:

  ```bash
  uv run python labs/introduction-foundry-agent-service/10-foundry-toolboxes/solution/deploy_hosted_agent_code.py
  ```

- [ ] The script zips `src/agent/`, uploads it, and Foundry builds the container remotely. Wait for it to report the new version as **active** - the remote build takes a few minutes. The script then grants the agent's per-deploy identity the **Foundry User** role so it can call the model and the toolbox.

  > This publishes a **new version** of the `acl-remedy-advisor-hosted-code` agent from Module 09 - the toolbox edition - without disturbing the version you deployed there.

#### 13. View the agent in the portal

- [ ] In a browser, navigate to [Microsoft Foundry](https://ai.azure.com), open your project, and select **Agents** in the left navigation.
- [ ] Open `acl-remedy-advisor-hosted-code` and confirm the new version is listed and active.

  <details>
  <summary>📸 Screenshot: Hosted agent in the portal</summary>

  ![Foundry portal Agents page showing the acl-remedy-advisor-hosted-code agent with its new toolbox-edition version active.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/09-hosted-agent-in-portal.png)

  </details>

#### 14. Invoke the agent from code

- [ ] Run the invoke script from the repository root:

  ```bash
  uv run python labs/introduction-foundry-agent-service/10-foundry-toolboxes/solution/invoke_hosted_agent.py
  ```

- [ ] The script selects the latest active version, routes 100% of the agent endpoint traffic to it, and runs a two-turn Australian Consumer Law conversation for receipt `R-1007` (a laptop battery that failed about 14 months after a 12-month warranty). The first turn asks the agent to look up the purchase; the second adds that the customer still has the original box and charger.
- [ ] Confirm the printed response:
  - References the customer's purchase and the relevant store policy retrieved through the `retail_remedy_ops` tools.
  - Applies Australian Consumer Law reasoning (a major or minor failure and the appropriate remedy).
  - Recommends a concrete next step for the customer (such as a repair, replacement, or refund).

  > Because Tool Search is enabled, the agent first calls `tool_search` to discover the retail tools, then calls them through `call_tool` - it never receives the full tool list up front. The agent calls only the tools each turn needs; for the `R-1007` scenario that is the `retail_remedy_ops` lookups. Web Search and Code Interpreter stay available through the same toolbox for questions that need an external ruling or a calculation (such as a pro-rata refund). Every tool reaches the agent through the single toolbox endpoint.

#### 15. Review the run traces and metrics

- [ ] Back in the portal, with `acl-remedy-advisor-hosted-code` open, select the **Traces** tab.
- [ ] Open the most recent run and expand the trajectory. Confirm you can see the `execute_tool tool_search` span followed by the discovered `execute_tool call_tool` span flowing through the toolbox. For the `R-1007` scenario the dispatched tool is a `retail_remedy_ops` lookup; Web Search and Code Interpreter appear only on runs whose questions need them.

  <details>
  <summary>📸 Screenshot: Agent run traces</summary>

  ![Foundry portal trace view for the hosted agent run, showing the tool_search span followed by the discovered retail tool call dispatched through the toolbox.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/10-agent-run-traces.png)

  </details>

- [ ] Select the **Monitor** tab and confirm the run appears in the operational charts - agent runs, token usage, and tool calls.

  <details>
  <summary>📸 Screenshot: Agent metrics</summary>

  ![Foundry portal Monitor dashboard showing agent runs, token usage, and tool call metrics for the hosted agent.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-10/11-agent-metrics.png)

  </details>

---

## Validation

- The `acl-remedy-toolbox` toolbox exists in your Foundry project containing **Web Search**, the `retail_remedy_ops` MCP server, and **Code Interpreter**, with **Tool Search** enabled and a default version set.
- `python labs/introduction-foundry-agent-service/10-foundry-toolboxes/solution/deploy_hosted_agent_code.py` publishes a new version of `acl-remedy-advisor-hosted-code` that reports **active**.
- The new version appears in the portal **Agents** view for `acl-remedy-advisor-hosted-code`.
- `python labs/introduction-foundry-agent-service/10-foundry-toolboxes/solution/invoke_hosted_agent.py` runs to completion and prints a clear remedy recommendation citing store policy and Australian Consumer Law, and recommending the appropriate remedy.
- The portal **Traces** and **Monitor** views show the run, with tool calls (`tool_search` then `call_tool`) flowing through the toolbox via Tool Search.

## Congratulations 🎉

You packaged your tools for reuse and shipped them as a managed agent. You assembled an `acl-remedy-toolbox` that exposes **Web Search**, the `retail_remedy_ops` MCP server, and **Code Interpreter** through a single Tool Search–enabled endpoint, then deployed a **hosted agent from source code** - a new toolbox-driven version of `acl-remedy-advisor-hosted-code` - whose per-deploy identity reaches every tool through that one endpoint. This is the capstone pattern for sharing curated capabilities across teams and running them in production.

> [!TIP]
> **Next up → [Module 11: Agent operations and Agent ID](../11-agent-ops-and-agent-id/README.md)**
> Operationalize your agent with monitoring, run history, and Agent ID. No need to scroll - jump straight in!

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Toolboxes tab not visible in the portal** | The **Build → Tools → Toolboxes** tab may not be available in all regions or portal versions. Use the Python fallback script (`solution/setup_toolbox.py`) to create the toolbox, then continue with Part 3. |
| **Deploy never reports active / remote build fails** | The remote build takes a few minutes. If it fails, confirm `src/agent/requirements.txt` is valid and that your account can create agent versions in the project. Re-run `deploy_hosted_agent_code.py`. |
| **Agent run returns a `401` or `403` error** | The hosted agent authenticates to the toolbox with its own per-deploy identity. The deploy script grants it the **Foundry User** role automatically; if the first invoke fails right after deploy, wait a minute for the role assignment to propagate and retry. |
| **`MCP server failed to initialize` / `Cancelled via cancel scope`** | The toolbox endpoint can drop the first connection attempt on a cold start. Re-run the invoke script. If every attempt fails, confirm the toolbox has a default version set and that the MCP server behind it is still running and publicly exposed. |
| **`AuthenticationFailedException` / `DefaultAzureCredential` fails** | The deploy and invoke scripts rely on your Azure CLI session. Run `az login` in the terminal to re-authenticate, then retry. |
| **Empty or unhelpful response from the agent** | Tool descriptions drive `tool_search` match quality. Confirm the Web Search and MCP tools have clear, specific descriptions in the toolbox definition. Publish a new toolbox version with improved descriptions and set it as the default. |
| **MCP tools not discovered during toolbox creation** | Confirm the MCP server is running and the tunnel URL is still publicly accessible. Restart the server and re-expose port 8080 if needed, then re-create the toolbox with the updated URL. |
| **Wrong toolbox version is used** | The agent resolves the toolbox by `TOOLBOX_NAME` and uses the `default_version`. Confirm `TOOLBOX_NAME=acl-remedy-toolbox` in your `.env` file and that the intended version is set as the default in the portal. |
| **`500` on `tools/list`** | Transient server error. Retry after a few seconds. |
| **Environment variable is overwritten at runtime** | Foundry reserves all variables prefixed with `FOUNDRY_` and may silently overwrite user-defined values. Rename any custom variables that use this prefix. |
