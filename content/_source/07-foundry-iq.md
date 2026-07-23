---
title: '07. Ground the agent with Foundry IQ knowledge bases'
description: 'Complete this lab to ground the agent with foundry iq knowledge bases.'
lastUpdated: '2026-07-13'
track: 'introduction-foundry-agent-service'
module: 7
slug: '07-foundry-iq'
estimatedTimeMinutes: 25
difficulty: 'intermediate'
prerequisites: ['Module 06']
audience:
  - 'attendee'
technologies:
  - 'Microsoft Foundry'
  - 'Python'
tags:
  - 'foundry'
  - 'ground'
  - 'the'
  - 'agent'
  - 'with'
status: 'active'
contentType: 'lab'
---
# 07. Ground the agent with Foundry IQ knowledge bases

**Estimated time:** 25 minutes

![Diagram showing the Microsoft Foundry IQ knowledge base structure.](../../../docs/assets/diagrams/foundry-iq-knowledge-bases.png)

> [!IMPORTANT]
> Creating a Foundry IQ knowledge base requires the **`foundry-project-manager`** role or higher. If you were assigned the `foundry-user` role, ask your organizer to elevate it before proceeding. Organizers: ensure `AZURE_ATTENDEE_DEFAULT_ROLE=foundry-project-manager` (the recommended default).

<!-- markdownlint-disable-next-line MD028 -->
> [!IMPORTANT]
> This module builds on [Module 06 - Integrate MCP tools](../06-mcp-tools/README.md). After Module 06 the `acl-remedy-advisor` agent has **three direct tools** - **Web search**, **Code Interpreter**, and the **MCP** server.

<!-- markdownlint-disable-next-line MD028 -->
> [!NOTE]
> If you could not complete the earlier modules, recreate the agent from code before continuing. The Module 06 solution script creates the three-tool agent, which is a valid starting point for this module:
>
> ```bash
> uv run python labs/introduction-foundry-agent-service/06-mcp-tools/solution/create_agent_with_mcp.py
> ```

<!-- markdownlint-disable-next-line MD028 -->
> [!TIP]
> Tick the checkbox next to each step as you complete it to track your progress through this module.

## Objectives

- Understand how **Foundry IQ** turns Azure AI Search indexes into a grounding layer for agents.
- Verify that the pre-seeded `retail-products` and `retail-policies` indexes exist and are populated.
- Create a **Foundry IQ knowledge base** that combines both indexes as knowledge sources.
- Attach the knowledge base to the `acl-remedy-advisor` agent through the Foundry portal.
- Update the agent instructions so it routes between the knowledge base, the `retail-remedy-ops` tools, web search, and Code Interpreter.
- Test the agent with queries that require accurate product and policy knowledge.

## Concepts

### What you are building

The following diagram shows the architecture you will build in this lab.

![Architecture diagram: Python Client calls the acl-remedy-advisor Agent Definition inside a Foundry Project inside a Foundry Account. The Agent Definition calls the chat Model Deployment and may invoke the Web Search Tool (which calls the Internet), the Code Interpreter Tool (sandboxed Python), the MCP Tool (which connects over an HTTPS dev tunnel to a Retail Remedy Operations MCP Server on the local dev machine), and a Knowledge Base connection - connected as an MCP tool - to a Foundry IQ Knowledge Base in the connected Azure AI Search service. The Knowledge Base contains two Knowledge Sources that read from the retail-products and retail-policies search indexes.](../../../docs/assets/diagrams/lab-07-foundry-iq-architecture.svg)

This lab adds a **fourth** connection to `acl-remedy-advisor`: a **Foundry IQ Knowledge Base**, wired to the agent as an **MCP tool** (its citations resolve to `mcp://searchindex/...` sources) alongside the three tools from earlier modules. The Knowledge Base lives in the connected **Azure AI Search** service and combines two **Knowledge Sources** - each one reads from a pre-seeded search index (`retail-products` and `retail-policies`) using the index's semantic configuration. At query time the agent routes between all four capabilities: the Knowledge Base for grounded product and policy answers, the `retail-remedy-ops` MCP server for operational lookups, Web Search for current ACCC guidance, and Code Interpreter for calculations.

### What is Foundry IQ?

**Foundry IQ** is the knowledge layer in Microsoft Foundry. It lets you combine multiple Azure AI Search indexes, remote data sources and MCP Servers behind a single, agent-ready retrieval endpoint called a **knowledge base**. Instead of wiring one Azure AI Search index, remote data source or MCP Server at a time, you create a knowledge base that holds multiple **knowledge sources** and exposes them to agents through a single connection.

When an agent has a knowledge base attached and the user asks a question, Foundry IQ runs retrieval across all configured knowledge sources, re-ranks the results, and injects the most relevant passages into the model's context. The agent's response is then grounded in your enterprise data - not just in model training knowledge.

You can think of Foundry IQ as a customizable knowledge Agent that lives in your Azure AI Search service and serves up contextual information to your agents on demand. It frees you from hard-coding retrieval logic and gives you a single place to manage all your knowledge sources, configure retrieval behaviour, and monitor usage.

![Diagram showing how Foundry IQ retrieves and ranks information from multiple knowledge sources before returning to your agent.](../../../docs/assets/diagrams/foundry-iq-agentic-retrieval-pipeline.png)

### Knowledge sources

A **knowledge source** is a single Azure AI Search index registered inside a knowledge base. Each source has a **name**, an optional **description**, and a reference to the **search index** it reads from. You do **not** map individual fields by hand - Foundry IQ reads the index's **semantic configuration** to determine which fields supply content, titles, and keywords automatically.

Both workshop indexes were seeded with a semantic configuration and pre-computed 1536-dimension embeddings, so Foundry IQ can run semantic and vector retrieval against them with no extra setup. When you add a knowledge source, the dialog notes that the *"Search index must contain semantic configuration"* - the workshop indexes already satisfy this requirement.

### Why not just use the Azure AI Search tool?

You could connect each index individually using the **Azure AI Search** tool in the agent's tool picker (as shown in Module 05's tool list). Foundry IQ knowledge bases offer three advantages over individual connections:

1. **Multi-source fusion** - a single knowledge base retrieves across both indexes in one call, re-ranking results from both before injecting context.
1. **Managed configuration** - retrieval behaviour (reasoning effort, output mode, and retrieval instructions) is configured once in the knowledge base and reused by any agent that attaches it.
1. **Consistent grounding** - the same retrieval behaviour applies everywhere the knowledge base is used, making evaluations reproducible.
1. **MCP Server** - Agents connect to the knowledge base as an MCP tool, so you get consistent `mcp://searchindex/...` citations in responses and a single connection point for all your knowledge sources. This also enables Foundry IQ to be used with 3rd party Agents.

### Output modes and retrieval instructions

When you create a knowledge base you choose how it returns results and - when it holds more than one source - how it decides which source to query. Two settings control this, and both depend on the **retrieval reasoning effort** you pick.

The **output mode** determines what the knowledge base hands back to the agent:

- **Extractive data** (used in this lab) returns the highest-ranked passages straight from the search indexes. The agent's own model reads those passages, writes the answer, and adds the `mcp://searchindex/...` citations. This mode adds no extra LLM call inside the knowledge base, so it is the fastest and lowest-cost option - and it is the only mode available when reasoning effort is **Minimal**.
- **Answer synthesis** asks an LLM *inside the knowledge base* to compose a grounded, natural-language answer with inline citations before returning it. It needs a chat model on the knowledge base and a reasoning effort of **Low** or **Medium**; it is not available with **Minimal** effort.

Both modes ground the agent in your data - they differ in *where* the answer is written. This lab uses **Extractive data** so the `acl-remedy-advisor` agent keeps control of the final wording and tool routing.

> [!NOTE]
> The **retrieval reasoning effort** sets how much LLM query planning the knowledge base performs. **Minimal** (this lab) disables query planning and always searches every source - predictable, fast, and inexpensive. **Low** (the service default) runs a single pass of LLM query planning and source selection. **Medium** adds an iterative second pass for harder questions.

**Retrieval instructions** are an optional prompt that tells the knowledge base's query-planning LLM *which sources to use for which questions* - for example, route returns and warranty questions to the policies source and catalog questions to the products source. Because they steer the LLM query-planning step, they only take effect at **Low** or **Medium** reasoning effort. With **Minimal** effort there is no query planning and every source is always searched, so this lab leaves **Retrieval instructions** empty. If you raise the effort to **Low** or **Medium** with multiple sources, add retrieval instructions so the engine routes each question to the right source.

## Prerequisites - the search indexes are already provisioned

This module uses two Azure AI Search indexes that the workshop provisioning scripts created and populated during setup. They live in the Azure AI Search service connected to your Foundry project (`aisrch-foundry-hol8`):

| Index | Default name | Environment variable | Contents | Key fields |
|---|---|---|---|---|
| Retail products | `retail-products` | `AZURE_SEARCH_PRODUCT_INDEX_NAME` | ~100 supermarket products | `id`, `title`, `content`, `category`, `tags`, `price`, `rating`, `contentVector` |
| Retail policies | `retail-policies` | `AZURE_SEARCH_DOCUMENT_INDEX_NAME` | ~50 store policies | `id`, `title`, `content`, `policyType`, `category`, `effectiveDate`, `contentVector` |

> [!NOTE]
> The **Indexes** tab on the Knowledge page lists only indexes created *inside* Foundry. The workshop indexes live in the connected Azure AI Search service, so they will **not** appear on that tab - this is expected. You select them directly by name when you add knowledge sources in Part 2. If you need to confirm they exist, view the indexes in the [Azure portal](https://portal.azure.com) under the AI Search resource, or ask your proctor. To recreate them if necessary:
>
> ```bash
> uv run python scripts/seed-product-index.py
> uv run python scripts/seed-document-index.py
> ```

<!-- markdownlint-disable-next-line MD028 -->
> [!NOTE]
> At query time the agent retrieves from the knowledge base as your Foundry **project's managed identity**, which needs the **Search Index Data Reader** role on the Azure AI Search service. The workshop infrastructure (`infra/main.bicep`) assigns this automatically. If grounded answers fail with an access error, see **Access denied (HTTP 403)** in Troubleshooting.

## Steps

### Part 1 - Create the knowledge base

#### 1. Open the Knowledge page

- [ ] In the [Microsoft Foundry portal](https://ai.azure.com), navigate to your project.
- [ ] In the left navigation, click **Knowledge**.
- [ ] Confirm the page heading reads **Knowledge (Foundry IQ)** and the **Knowledge bases** tab is selected. A **Connection** dropdown at the top shows the connected Azure AI Search service — this is pre-selected automatically; leave it as is.

  <details>
  <summary>📸 Screenshot: Knowledge (Foundry IQ) page</summary>

  ![Knowledge (Foundry IQ) page showing the Knowledge bases tab selected, a Connection dropdown with the connected AI Search service pre-selected, and a Create a knowledge base button.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-07/01-knowledge-page-empty.png)

  </details>

#### 2. Start creating a knowledge base

- [ ] Click **Create a knowledge base**.

  The **Create a new knowledge base** page opens directly — there is no intermediate dialog. It shows a **Basic configuration** section at the top and a **Knowledge sources (Foundry IQ)** section below.

#### 3. Set the name and basic configuration

- [ ] In the **Basic configuration** section, set:
  - **Name**: replace the auto-generated name (for example `knowledgebase124`) with your per-attendee knowledge base name from `KNOWLEDGE_BASE_NAME` (for example, `acl-remedy-knowledge-lab-attendee-1`).
  - **Description** (optional):

    ```text
    Retail product catalog and store policy knowledge for the ACL Remedy Advisor agent.
    ```

  - **Chat completions model**: leave as **Select model**. A model is only needed for **Answer synthesis** or for **Low**/**Medium** reasoning effort, neither of which this lab uses.
  - **Retrieval reasoning effort**: confirm **Minimal** is selected (the default). This searches both sources on every query with the lowest latency and cost. See [Output modes and retrieval instructions](#output-modes-and-retrieval-instructions) for the alternatives.
  - **Output mode**: confirm **Extractive data** is selected (the default). The knowledge base returns ranked passages and the agent writes the grounded answer. Extractive data is required when reasoning effort is **Minimal**.
  - **Retrieval instructions**: leave **empty**. These steer the LLM query-planning step, which **Minimal** effort disables. If you later raise the effort to **Low** or **Medium**, add an instruction such as:

    ```text
    Use the retail-policies source for questions about returns, refunds, warranties, loyalty, and store-brand guarantees. Use the retail-products source for questions about specific products, prices, ratings, and stock.
    ```

  <details>
  <summary>📸 Screenshot: Create a new knowledge base - Basic configuration</summary>

  ![Create a new knowledge base page showing the Basic configuration section with a per-attendee name filled in, Retrieval reasoning effort set to Minimal, and Output mode set to Extractive data.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-07/02-create-kb-page.png)

  </details>

#### 4. Add the retail-products knowledge source

- [ ] Scroll down to the **Knowledge sources (Foundry IQ)** section.
- [ ] Click **Add sources** and select **Azure AI Search Index** from the dropdown.
- [ ] In the **Create a knowledge source** dialog, set the fields:
  - **Name**: replace the default (for example `ks-searchindex-69`) with:

    ```text
    retail-products
    ```

  - **Description** (optional):

    ```text
    Retail product catalog: specifications, compatibility, and feature details for store products.
    ```

  - **Select search index**: choose **retail-products** from the dropdown.

  > [!NOTE]
  > There is no field mapping step. Foundry IQ reads the index's **semantic configuration** to locate content, titles, and keywords. The dialog notes *"Search index must contain semantic configuration"* — the workshop indexes already include one.

- [ ] Click **Create**. The source appears in the **Knowledge sources** table with status **Active**.

#### 5. Add the retail-policies knowledge source

- [ ] Click **Add sources** again and select **Azure AI Search Index**.
- [ ] In the **Create a knowledge source** dialog, set:
  - **Name**:

    ```text
    retail-policies
    ```

  - **Description** (optional):

    ```text
    Store policies: returns, refunds, warranties, loyalty program, and store-brand guarantees.
    ```

  - **Select search index**: choose **retail-policies**.
- [ ] Click **Create**. Both `retail-products` and `retail-policies` now appear in the **Knowledge sources** table with status **Active**.

#### 6. Save the knowledge base

- [ ] Confirm both `retail-products` and `retail-policies` are listed with type **Azure AI Search Index** and status **Active**.
- [ ] Click **Save knowledge base** in the top-right.
- [ ] Wait for creation to complete. The knowledge base detail page opens — its heading is the knowledge base name — with **Save**, **Use in an agent**, and **More options** buttons in the top-right.

  <details>
  <summary>📸 Screenshot: Knowledge base created</summary>

  ![Knowledge base detail page showing the knowledge base name as the heading, both knowledge sources listed as Active, and the Use in an agent button.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-07/03-kb-created.png)

  </details>

---

### Part 2 - Attach the knowledge base to the agent

#### 7. Use the knowledge base in an agent

- [ ] On the knowledge base detail page, click **Use in an agent** in the top-right.
- [ ] In the **Recent agents** dropdown, select **acl-remedy-advisor**. (Use **View all agents** if it is not listed.)

#### 8. Confirm the Knowledge section

- [ ] You land on the **acl-remedy-advisor** agent's **Playground** page.
- [ ] Scroll the configuration panel and confirm a **Knowledge** section now lists your knowledge base, separate from the **Tools** section (which still shows **Code interpreter**, **Web search**, and the `retail-remedy-ops` MCP server).

  > [!NOTE]
  > Attaching the knowledge base auto-saves the agent as a new version — the version number in the top-right increments by one. You will save again after updating the instructions.

  <details>
  <summary>📸 Screenshot: Agent Playground - Knowledge section added</summary>

  ![acl-remedy-advisor Playground showing a Knowledge section listing the attached knowledge base alongside the existing Tools section with Code interpreter, Web search, and retail-remedy-ops.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-07/04-agent-knowledge-added.png)

  </details>

---

### Part 3 - Update the agent instructions

The agent now has the knowledge base attached, but it needs guidance on *when* to use each capability. Without explicit routing instructions the model may answer from training knowledge, or never call the `retail-remedy-ops`, web search, or Code Interpreter tools.

#### 9. Add tool-routing and grounding instructions

- [ ] In the **Instructions** field, position your cursor at the end of the existing instructions.
- [ ] Press **Enter** twice, then add the following paragraphs:

  ```text
  When a staff member provides a receipt ID, order ID, or customer ID - or asks
  you to look up a purchase, verify an order, or open a support case - use the
  retail-remedy-ops tools to perform that operational lookup or action. Never
  invent receipt, order, or case details; always retrieve them with the tools.

  When answering questions about specific products available in the store -
  including product names, descriptions, categories, prices, ratings, or stock
  availability - use the knowledge base to retrieve accurate product information
  and cite the source in your response.

  When answering questions about store policies - including return windows,
  refund eligibility, warranty coverage, loyalty program rules, or store-brand
  guarantees - use the knowledge base to retrieve the relevant policy and quote
  it directly.

  Prefer knowledge base retrieval over your training knowledge for all product
  and policy questions. The knowledge base reflects the store's current catalog
  and policies, not general retail conventions.

  To summarise tool routing: use the retail-remedy-ops tools for operational
  lookups and actions, the knowledge base for product and policy questions, web
  search for current ACCC and Australian Consumer Law guidance, and code
  interpreter for refund, depreciation, pro-rata, or price calculations.
  ```

  > [!NOTE]
  > Earlier modules already added guidance for **web search** (current ACCC guidance) and **Code Interpreter** (refund and depreciation calculations). The tool-routing summary above reinforces them so no tool is left unused.
  >
  > **Tip:** An **Optimize** button appears below the Instructions panel. Do not use it during this lab — it rewrites instructions using AI and will replace the tool-routing text you just added.

#### 10. Save the agent

- [ ] Click **Save** in the top-right.
- [ ] Wait for the save to complete and confirm the agent advances to a new version.

---

### Part 4 - Test grounded retrieval

> [!IMPORTANT]
> **Check the MCP server is running and publicly tunneled before testing the agent.** The `retail_remedy_ops` MCP server from [Module 06](../06-mcp-tools/README.md) must still be running and exposed on a **Public** port 8080 tunnel, with `RETAIL_REMEDY_OPS_MCP_SERVER_URL` set to its URL ending in `/mcp`. The agent routes operational lookups (step 12) to this server, so if it stopped, restart it and re-expose the port (see [Module 06](../06-mcp-tools/README.md), Part 2):
>
> ```bash
> uv run python shared/mcp-servers/retail-remedy-ops/src/server.py
> ```

#### 11. Run a combined policy query

- [ ] The **Playground** (Chat) panel is on the right side of the agent page.
- [ ] Send the following message:

  > According to our store's return policy, how many days do customers have to return non-perishable items with a receipt, and within what timeframe should spoiled perishable items be reported?

- [ ] Review the response. Confirm the agent:
  - Answers **14 days** for non-perishable returns with a receipt and **48 hours** for reporting spoiled perishable items.
  - Includes source citation markers in the response text.
  - Shows a `kb-...` tool chip in the response metadata.

  <details>
  <summary>📸 Screenshot: Playground - grounded policy response</summary>

  ![Agent playground showing a grounded response citing the 14-day non-perishable return window and 48-hour perishable reporting window, with a kb- tool chip in the response metadata.](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-07/05-grounded-response.png)

  </details>

  > [!TIP]
  > This query does not include a receipt or customer ID, so the agent grounds from the knowledge base and does **not** invoke the `retail-remedy-ops` MCP tools — exactly the routing behaviour the instructions describe.

#### 12. (Optional) Exercise the other tools

- [ ] **Product lookup (knowledge base):** *"Recommend a healthy breakfast cereal with nuts, and include its price and rating."* - expect a specific product from `retail-products` with a citation.
- [ ] **Operational lookup (retail-remedy-ops):** provide a receipt ID from Module 06 and ask the agent to look it up - expect an MCP tool call.
- [ ] **Consumer law guidance (web search):** *"What does the ACCC say about repair versus replacement for a major failure?"* - expect a web-search-grounded answer citing accc.gov.au.
- [ ] **Calculation (Code Interpreter):** *"A customer paid $480 for an appliance 18 months into a 36-month expected life. Calculate a pro-rata refund."* - expect a worked calculation.

## Validation

- [ ] **Knowledge base created**: Your knowledge base (the `KNOWLEDGE_BASE_NAME` value, for example `acl-remedy-knowledge-lab-attendee-1`) is listed on the **Knowledge bases** tab.
- [ ] **Two knowledge sources**: The knowledge base shows both `retail-products` and `retail-policies` as **Azure AI Search Index** sources with status **Active**.
- [ ] **Attached to agent**: The knowledge base appears in the `acl-remedy-advisor` agent's **Knowledge** section, and the agent has advanced to a new version.
- [ ] **Grounded policy answers**: Policy queries return grounded answers with source citation markers and a `kb-...` tool chip visible in the response metadata, rather than relying on generic retail conventions.
- [ ] **Grounded product answers**: Product queries return specific product names, prices, and ratings that match the `retail-products` index.
- [ ] **Tool routing intact**: Operational queries (with a receipt ID) still call the `retail-remedy-ops` MCP server, web search still answers consumer-law questions, and Code Interpreter still performs calculations. Adding the knowledge base does not displace the existing tools.

## Congratulations 🎉

You grounded your agent in trusted knowledge. You created a Foundry IQ knowledge base, connected the `retail-products` and `retail-policies` search indexes, and attached it to `acl-remedy-advisor` - so policy and product answers now cite grounded sources while your existing MCP, web search, and Code Interpreter tools keep routing correctly. Your agent now blends retrieval with reasoning and live operations.

> [!TIP]
> **Next up → [Module 08: Use Agent Framework for Python](../08-agent-framework-python/README.md)**
> Drive your fully grounded agent from Python using the Microsoft Agent Framework. No need to scroll - jump straight in!

## Troubleshooting

### An index is not selectable in the "Select search index" dropdown

The `retail-products` and `retail-policies` indexes live in the connected Azure AI Search service, not in Foundry, so they do **not** appear on the Foundry **Indexes** tab - but they are still selectable in the **Select search index** dropdown when you create a knowledge source. If an index does not appear:

1. Confirm the AI Search service is connected to your project and the seed scripts ran during setup.
1. Confirm the index exists in the [Azure portal](https://portal.azure.com): open the AI Search resource, then **Search management > Indexes**.
1. If an index is missing, run the seed scripts from the repository root:

   ```bash
   uv run python scripts/seed-product-index.py
   uv run python scripts/seed-document-index.py
   ```

1. Reopen the **Create a knowledge source** dialog and confirm both indexes are now selectable.

### "Search index must contain semantic configuration"

Foundry IQ requires each source index to have a semantic configuration. The workshop seed scripts create one automatically. If you see this message, the index was created without it - rerun the relevant seed script above to recreate the index with its semantic configuration.

### Knowledge base returns empty results

- Check the index document count in the [Azure portal](https://portal.azure.com) under the AI Search resource (**Search management > Indexes**). A count of 0 means the seed script did not upload documents - rerun it.
- Confirm both knowledge sources show status **Active** in the knowledge base.

### Responses are not cited - the agent uses training knowledge instead

- Confirm the knowledge base appears in the agent's **Knowledge** section.
- Re-read the instructions you added in Part 5. The phrase "Prefer knowledge base retrieval over your training knowledge" is important - without it, the model may default to training knowledge for common retail questions.
- Try a more specific query that includes a product name or exact policy topic that only appears in the workshop data.

### Access denied (HTTP 403) when retrieving from the knowledge base

At query time the agent authenticates to the knowledge base retrieval endpoint as your Foundry **project's system-assigned managed identity**, which needs the **Search Index Data Reader** role on the Azure AI Search service (the service uses RBAC-only authentication).

- The workshop infrastructure (`infra/main.bicep`) assigns this role to every project's managed identity automatically. Data-plane role assignments can take several minutes to propagate - wait and retry.
- Organizers can verify or add the assignment:

  ```bash
  az role assignment create \
    --assignee <project-managed-identity-object-id> \
    --role "Search Index Data Reader" \
    --scope <azure-ai-search-resource-id>
  ```

  Alternatively, ask your organizer to re-run `azd provision` to reconcile role assignments.

### Cannot create a knowledge base

- Confirm your account has the `foundry-project-manager` role or higher. The `foundry-user` role cannot create knowledge bases.
- If your role was recently elevated, sign out of the portal and sign back in to refresh your token.
