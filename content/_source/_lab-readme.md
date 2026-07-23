# Introduction to Foundry Agent Service

This Lab covers the full end-to-end journey for building and shipping agentic solutions with Microsoft Foundry.

In this Lab, you will learn how to:

1. Set up your workshop environment and verify access.
1. Build prompt-based and hosted agents.
1. Orchestrate tools and multi-agent patterns.
1. Apply Agent Framework patterns in Python.
1. Use Foundry IQ and Toolboxes for richer agent workflows.
1. Prepare agent identity and publishing workflows.

The module pages are generated automatically during docs build and preview from source README files in the lab directories under `labs/introduction-foundry-agent-service`.

## Scenario

Throughout the lab, you will build a single production-grade agent called `acl-remedy-advisor` - an Australian Consumer Law (ACL) Remedy Advisor designed to help retail staff determine the correct remedy when a customer reports a product problem. Starting with a simple prompt-based agent in Microsoft Foundry Agent Builder, the agent is incrementally enriched across twelve core modules: web search and Code Interpreter tools are added for live ACCC guidance and pro-rata refund calculations; a custom Model Context Protocol (MCP) server called `retail-remedy-ops` is wired in to look up real purchase records, product profiles, store policies, and replacement stock; a Foundry IQ knowledge base grounds the agent in the retailer's own policy documents; the agent is driven programmatically via the Python Agent Framework; and finally it is packaged as a containerised hosted agent and consumed through a Foundry Toolbox - all the way through to agent identity, operational monitoring, and publishing. Module 13 is an optional extra-credit extension for building a Microsoft 365 Custom Engine Agent proxy in an attendee-owned tenant.

## Modules

| #  | Module | Estimated Time | Required | End State |
|----|--------|----------------|:--------:|-----------|
| 1  | [Setup](./01-setup/README.md) | 15 min | ✅ | Working environment with verified Foundry access - no agent created yet. |
| 2  | [Foundry Portal Walkthrough](./02-foundry-portal-walkthrough/README.md) | 10 min | ✅ | Comfortable navigating the portal - nothing created. |
| 3  | [Foundry Toolkit for VS Code](./03-foundry-toolkit-vscode/README.md) | 15 min | ✅ | Foundry Toolkit installed and connected to your project in VS Code. |
| 4  | [Prompt Agents](./04-prompt-based-agents/README.md) | 20 min | ✅ | The `acl-remedy-advisor` prompt agent created and chattable. |
| 5  | [Agent Tools and Evaluations](./05-agent-tools-and-evaluations/README.md) | 30 min | ✅ | `acl-remedy-advisor` extended with tools plus an evaluation run. |
| 6  | [MCP Tools](./06-mcp-tools/README.md) | 30 min | ✅ | A running `retail_remedy_ops` MCP server wired into the agent. |
| 7  | [Foundry IQ](./07-foundry-iq/README.md) | 25 min | ✅ | A Foundry IQ knowledge base grounding the agent's answers. |
| 8  | [Agent Framework Python](./08-agent-framework-python/README.md) | 25 min | ✅ | A Python Agent Framework app driving the agent. |
| 9  | [Hosted Agents](./09-hosted-agents/README.md) | 35 min | ✅ | A hosted agent deployed in your Foundry project as a container and as source code. |
| 10 | [Foundry Toolboxes](./10-foundry-toolboxes/README.md) | 30 min | ✅ | An `acl-remedy-toolbox` consumed from a Python Agent Framework app. |
| 11 | [Agent Ops and Agent ID](./11-agent-ops-and-agent-id/README.md) | 30 min | ✅ | Agent identity and operational monitoring configured. |
| 12 | [Publishing Agents](./12-publishing-agents/README.md) | 25 min | ✅ | `acl-remedy-advisor` published to Microsoft 365 Copilot and Teams and verified in a live conversation. |
| 13 | [Custom Engine Agent (optional, extra credit)](./13-custom-engine-agent/README.md) | 60 min | ❌ | A Microsoft 365 Agents SDK proxy bot connected to Teams from your own Azure subscription and Entra tenant. |

Total time: ~3-4 hours for the 12 core modules, depending on your familiarity with the concepts. Module 13 adds approximately 60 minutes and requires your own Azure subscription and Entra tenant; it is not part of the shared workshop environment. Each core module builds on the previous ones, so we recommend following them in order.

However, if you are short on time or want to jump to a specific topic, you can pick and choose modules. Many of the modules include scripts in the `solution` folder that set up the end state of that module, so you can start from there if you don't have time to complete the earlier modules.
