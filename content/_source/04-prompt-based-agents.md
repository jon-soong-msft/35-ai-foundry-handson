---
title: '04. Create and chat with a Prompt Agent'
description: 'Complete this lab to create and chat with a prompt agent.'
lastUpdated: '2026-07-13'
track: 'introduction-foundry-agent-service'
module: 4
slug: '04-prompt-based-agents'
estimatedTimeMinutes: 20
difficulty: 'intermediate'
prerequisites: ['Module 03']
audience:
  - 'attendee'
technologies:
  - 'Microsoft Foundry'
  - 'Python'
tags:
  - 'foundry'
  - 'create'
  - 'and'
  - 'chat'
  - 'with'
status: 'active'
contentType: 'lab'
---
# 04. Create and chat with a Prompt Agent

**Estimated time:** 20 minutes

![Diagram showing the Microsoft Foundry Agent Service architecture, with agents, tools, knowledge bases, and model deployments connected through a Foundry project.](../../../docs/assets/diagrams/foundry-agent-service.png)

Foundry Agent Service supports two agent types. **Prompt agents** are fully configuration-driven: you specify a model, instructions, and tools, then Foundry runs the agent loop with no application code or container to maintain. **Hosted agents** (preview) are code-based: you write the agent logic with Agent Framework, LangGraph, the OpenAI Agents SDK, or your own code, package it as a container, and Foundry provides a managed endpoint, automatic scaling, and a dedicated Microsoft Entra identity. Prompt agents suit fast starts and production workloads that do not need custom orchestration logic; Hosted agents give you full control over agent logic when you need it. This module covers Prompt agents. [Module 09](../09-hosted-agents/README.md) introduces Hosted agents.

> [!TIP]
> Tick the checkbox next to each step as you complete it to track your progress through this module.

## Objectives

- Understand what a Prompt Agent is and how the Agent Loop works.
- Create a Prompt Agent using the **Agent Builder** in the Foundry Toolkit for VS Code.
- Chat with the agent from Python code using `AIProjectClient`.

## Concepts

### What is a Prompt Agent?

A **Prompt Agent** is a fully managed agent you configure with three things: a model, a set of instructions, and optional tools. There is no code to write or maintain - Foundry Agent Service handles the runtime for you.

### The Agent Loop

Every agent runs a loop: it receives your message, reasons about it, optionally calls tools to gather information, then generates a response. This cycle repeats for each turn of the conversation.

You can implement this loop yourself - write code that calls a model, parses any tool-call requests from the response, runs the tools, and feeds the results back to the model. That gives you full control but requires code to maintain.

With a **Prompt Agent**, Foundry Agent Service hosts the loop for you. You send a message and receive a finished response. The service handles tool calls, context management, and retries on your behalf.

> **Module 08** introduces the **Microsoft Agent Framework**, which gives you the control of a code-implemented loop while providing structured patterns for complex, multi-agent workflows. For now, you'll use `AIProjectClient` - the simplest path for interacting with a Prompt Agent from code.

### Agent versioning

Every time you **Save to Foundry**, Foundry Agent Service stores an immutable snapshot of the agent's configuration (model, instructions, tools, and settings) and assigns it an incrementing version number - `v1`, `v2`, and so on. The version badge appears in the Agent Builder header next to the agent name once the save succeeds.

The version your code calls is controlled by the `agent_reference` you pass in each request. Referencing an agent by **name** always routes to the **latest** saved version. This means you can iterate and improve the agent in Agent Builder without changing any code - the next time your script runs, it picks up the latest version automatically.

### What you are building

The following diagram shows the architecture you will build in this lab.

![Architecture diagram: Python Client calls the acl-remedy-advisor Agent Definition inside a Foundry Project inside a Foundry Account. The Agent Definition calls the Web Search Tool, which calls out to the Internet.](../../../docs/assets/diagrams/lab-04-prompt-agent-architecture.svg)

Your **Python Client** (`src/starter.py`) sends a message to the **Agent Definition** (`acl-remedy-advisor`) using `responses.create()`. The Agent Definition lives inside your **Foundry Project**, which is itself inside your **Foundry Account** deployed into an Azure Region. Each time you save changes in Agent Builder a new immutable version (`v1`, `v2`, ...) is recorded - referencing the agent by name always resolves to the latest. During a turn the agent may invoke the **Web Search Tool** (a built-in tool provisioned inside the project), which calls out to the internet to retrieve current ACCC guidance. The service returns the finished response directly to your client; your code never sees the intermediate tool-call steps.

### Agent Builder vs code creation

There are two ways to create a Prompt Agent:

| Approach | When to use |
|---|---|
| **Agent Builder** (this module) | Quick creation, visual configuration, playground testing - no code required |
| **SDK (`PromptAgentDefinition`)** | Programmatic creation, CI/CD pipelines, version-controlled agent definitions |

Both produce the same agent. This module uses Agent Builder so you can see the configuration visually before writing any code.

## Steps

### Part 1 - Create the Prompt Agent in Agent Builder

#### 1. Open Agent Builder

- [ ] Click the **Foundry Toolkit** icon in the Activity Bar.
- [ ] In the **Developer Tools** section, click **Create Agent**.

  <details>
  <summary>📸 Screenshot: Agent Builder - Create Agent</summary>

  ![Foundry Toolkit Developer Tools section showing the Create Agent option leading to Agent Builder](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-04/01-agent-builder-new.png)

  </details>

- [ ] On the Create Agent screen, click **Open Agent Builder** under *Design an agent without code*.

#### 2. Configure the agent

- [ ] In the **Agent name** field, enter `acl-remedy-advisor`.
- [ ] In the **Model** dropdown, select `chat (via Microsoft Foundry)`.
- [ ] In the **Instructions** field, paste the following:

  ```text
  You are an Australian Consumer Law (ACL) Remedy Advisor for retail staff.
  When a customer reports a problem with a product, help staff determine the
  correct remedy under the ACL consumer guarantees.

  Distinguish between a **major failure** (the customer may choose a refund,
  replacement, or repair) and a **minor failure** (the business may choose to
  repair the product within a reasonable time, or offer a replacement or
  refund).

  When assessing a situation consider:
  - The type of product and its expected lifespan
  - The price paid
  - How long the customer has had the product
  - What a reasonable consumer would expect

  Use web search to ground your guidance in current ACCC guidance at
  accc.gov.au and always cite your sources with links.

  Always state clearly that you provide general guidance, not legal advice,
  and that "no refund" signs are unlawful under the ACL.

  Be concise and practical - retail staff need fast, clear answers in a
  busy store environment.
  ```

  <details>
  <summary>📸 Screenshot: Agent Builder - configured instructions</summary>

  ![Agent Builder showing acl-remedy-advisor configured with the chat model and instructions filled in](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-04/02-agent-builder-config.png)

  </details>

#### 3. Add the Web Search tool

- [ ] Scroll down to the **TOOL** section and click **Add Tool**.
- [ ] In the dialog that opens, click the **Configured** tab.
- [ ] Select **Web search** (Built-in · Microsoft Foundry).
- [ ] Click **Add Tools (1)**.

  <details>
  <summary>📸 Screenshot: Agent Builder - Web search tool added</summary>

  ![Agent Builder Configured tools dialog showing Web search selected with a checkmark](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-04/03-agent-builder-web-search.png)

  </details>

- [ ] Confirm **Web search** appears in the TOOL section of the Agent Builder.

#### 4. Save and test in the playground

- [ ] Click **Save to Foundry**.
- [ ] Wait for the confirmation notification: *Agent 'acl-remedy-advisor' published to Foundry successfully.*
- [ ] Confirm the Agent Builder header now shows `acl-remedy-advisor | Microsoft Foundry | v1`. This is the **agent version** - each subsequent save produces `v2`, `v3`, and so on. Referencing the agent by name in your code always routes to the latest version.
- [ ] Once saved, type a test message in the playground at the bottom of the Agent Builder:

  > A customer wants to return a $1,200 TV that stopped working after 18 months. What are their rights under Australian Consumer Law?

- [ ] Send the message and review the response. Confirm the agent:
  - Identifies whether the failure is major or minor.
  - Cites ACCC guidance (accc.gov.au) or a state consumer affairs site.
  - States that its answer is general guidance, not legal advice.

  <details>
  <summary>📸 Screenshot: Agent Builder - playground response</summary>

  ![Agent Builder playground showing the acl-remedy-advisor agent responding with ACCC citations and major/minor failure analysis](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-04/04-agent-playground-test.png)

  </details>

- [ ] Ask a follow-up question to confirm conversation context is preserved:

  > The customer says they just want a refund and don't want a repair. Can the store insist on repairing it first?

### Part 2 - Chat with the agent from code

#### 5. Complete the starter code

Open `src/starter.py`. The file contains the program structure and four `TODO` comments. Work through each one below, then run the finished script in step 7.

##### TODO 1 - Connect to the Foundry project

Replace `# TODO 1` with:

```python
client = AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential())
openai = client.get_openai_client()
```

`AIProjectClient` connects to your Foundry project using your Azure identity. `get_openai_client()` returns an OpenAI-compatible client that is already scoped to the project, so every call is automatically routed to your Foundry endpoint.

> [!NOTE]
> `DefaultAzureCredential` authenticates using the Azure CLI session established by `az login`. If authentication fails when you run the script, open a terminal and run `az login` to sign in, then retry.

##### TODO 2 - Start a conversation thread

Replace `# TODO 2` with:

```python
conversation = openai.conversations.create()
print(f'Conversation started: {conversation.id}\n')
```

`conversations.create()` creates a persistent thread on the service. Passing the same `conversation.id` on every subsequent call tells the agent service to accumulate context across turns - the agent can refer back to earlier messages in the same session.

##### TODO 3 - Send a message to the agent

Replace `# TODO 3` with:

```python
response = openai.responses.create(
    conversation=conversation.id,
    extra_body={
        'agent_reference': {
            'name': agent_name,
            'type': 'agent_reference',
        },
    },
    input=user_input,
)
```

`responses.create()` sends the user's message to the service. The `agent_reference` in `extra_body` tells the service which saved agent to use - by name, so it always resolves to the latest saved version. The service runs the full agent loop (reasoning, tool calls, response) and returns the finished result.

##### TODO 4 - Display the response

Replace `# TODO 4` with:

```python
for item in response.output:
    if item.type == 'web_search_call':
        print('[web search]')

print(f'\nAdvisor: {response.output_text}\n')
```

`response.output` contains all the items the agent loop produced - tool calls, run steps, and the final message. Checking for `web_search_call` lets you show an indicator when the agent searched the web. `response.output_text` is the agent's final text response.

#### 6. Run the starter script

- [ ] Open a terminal and run:

  ```bash
  uv run python labs/introduction-foundry-agent-service/04-prompt-based-agents/src/starter.py
  ```

- [ ] When prompted, type the same question you used in the playground:

  > A customer wants to return a $1,200 TV that stopped working after 18 months. What are their rights under Australian Consumer Law?

- [ ] Confirm the advisor's response cites at least one ACCC or state consumer affairs URL. A `[web search]` indicator should appear before the answer - if it does not, see the **Web search does not fire** troubleshooting note below.

- [ ] Ask the follow-up question to confirm the conversation remembers the first turn:

  > The customer says they just want a refund and don't want a repair. Can the store insist on repairing it first?

- [ ] Type `exit` to quit.

#### 7. Inspect the conversation in Agent Builder

Every conversation your code creates is recorded by Foundry Agent Service and visible in the Agent Builder. This lets you inspect exactly what the agent loop did - which tool calls were made, in what order, and how the response was assembled - without adding any observability code.

- [ ] Return to the **Agent Builder** tab in VS Code.
- [ ] Click the **Conversations** tab in the Agent Builder header.
- [ ] Confirm your conversation appears in the list with a **Completed** status and token counts.

  <details>
  <summary>📸 Screenshot: Agent Builder - Conversations tab</summary>

  ![Agent Builder Conversations tab showing a list of completed conversations with token counts and timestamps](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-04/05-agent-conversations-list.png)

  </details>

- [ ] Click the top conversation ID to open the detail view.
- [ ] In the detail panel, observe the full agentic loop recorded by the service:
  - The user message that triggered the turn.
  - The `web_search_call` tool invocation - the agent decided to search and the service executed it.
  - The final `message` run step containing the response text.

  > The entire loop - reasoning, tool dispatch, result processing, and response generation - ran inside Foundry Agent Service. Your Python code only sent the user message and received the finished response; it never saw the intermediate steps.

  <details>
  <summary>📸 Screenshot: Agent Builder - conversation detail</summary>

  ![Agent Builder conversation detail showing the agentic loop: user message, web_search_call tool step, and final message response](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-04/06-agent-conversation-detail.png)

  </details>

## Validation

- `acl-remedy-advisor` appears under **Prompt Agents** in the Foundry Toolkit **My Resources** panel.
- The Agent Builder header shows `acl-remedy-advisor | Microsoft Foundry | v1` after saving.
- The playground response for the TV question cites at least one link from `accc.gov.au` or a state consumer affairs site.
- Running `src/starter.py` prints a conversation ID and returns a cited response with at least one ACCC or state consumer affairs URL. A `[web search]` indicator should appear - it may be absent if the agent answers from its training data rather than searching.
- The follow-up question receives an answer that references the TV from the first question, confirming conversation memory is working.

## Congratulations 🎉

You built your first real agent. You created the `acl-remedy-advisor` prompt agent, gave it grounded instructions and web search, and chatted with it both in the portal and from Python - confirming it cites real consumer-law sources and remembers earlier turns in a conversation. You now have a working agent to build on throughout the rest of the workshop.

> [!TIP]
> **Next up → [Module 05: Agent tools and evaluations](../05-agent-tools-and-evaluations/README.md)**
> Extend your agent with Code Interpreter and measure its quality with a structured evaluation run. No need to scroll - jump straight in!

## Troubleshooting

- **Save to Foundry fails** - confirm your Default Project is set correctly via the Foundry Toolkit **Set Default Project** action in My Resources. If the Codespace cannot reach the endpoint, create the agent from code using `PromptAgentDefinition` by running `solution/create_agent.py`:

  ```bash
  uv run python labs/introduction-foundry-agent-service/04-prompt-based-agents/solution/create_agent.py
  ```

- **Web search does not fire** - rephrase your prompt to explicitly request current information, for example: *Search accc.gov.au for the current rules on major failures.*
- **`AIProjectClient` raises an auth error** - `DefaultAzureCredential` uses your Azure CLI session. Run `az login` in the terminal to re-authenticate, then confirm `FOUNDRY_PROJECT_ENDPOINT` is set correctly in your `.env` file.
- **Agent not found** - confirm `AGENT_NAME` in `.env` matches exactly (`acl-remedy-advisor` is case-sensitive).
- **Model unavailable** - confirm the `chat` deployment exists in the **Models** section of your project in the Foundry Toolkit.
