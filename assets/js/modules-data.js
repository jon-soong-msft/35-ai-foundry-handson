window.WORKSHOP_MODULES = [
  {
    "num": "01",
    "slug": "01-setup",
    "title": "Setup & access verification",
    "type": "handson",
    "minutes": 15,
    "difficulty": "beginner",
    "taskCount": 8,
    "summary": "Sign in to the Foundry portal, enable New Foundry, select or create a project, and deploy a model in your own subscription.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "02",
    "slug": "02-foundry-portal-walkthrough",
    "title": "Foundry portal walkthrough",
    "type": "handson",
    "minutes": 10,
    "difficulty": "beginner",
    "taskCount": 7,
    "summary": "Tour the Home, Discover, Build, and Operate tabs so you know where every model, tool, and setting lives.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "03",
    "slug": "03-foundry-toolkit-vscode",
    "title": "Foundry Toolkit for VS Code",
    "type": "concept",
    "minutes": 15,
    "difficulty": "beginner",
    "taskCount": 0,
    "summary": "How the Foundry Toolkit brings models, agents, and playgrounds into VS Code. Read-only overview.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "04",
    "slug": "04-prompt-based-agents",
    "title": "Create & chat with a Prompt Agent",
    "type": "handson",
    "minutes": 20,
    "difficulty": "beginner",
    "taskCount": 17,
    "summary": "Build the acl-remedy-advisor prompt agent in Agent Builder and chat with it in the portal.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "05",
    "slug": "05-agent-tools-and-evaluations",
    "title": "Agent tools & evaluations",
    "type": "handson",
    "minutes": 30,
    "difficulty": "intermediate",
    "taskCount": 19,
    "summary": "Add web search and Code Interpreter tools, then run an evaluation on the agent — all in the portal.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "06",
    "slug": "06-mcp-tools",
    "title": "Integrate MCP tools",
    "type": "handson",
    "minutes": 30,
    "difficulty": "intermediate",
    "taskCount": 16,
    "summary": "Wire a custom Model Context Protocol (MCP) server into the agent from the Foundry portal.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "07",
    "slug": "07-foundry-iq",
    "title": "Ground with Foundry IQ knowledge",
    "type": "handson",
    "minutes": 25,
    "difficulty": "intermediate",
    "taskCount": 16,
    "summary": "Ground the agent in your own policy documents with a Foundry IQ knowledge base.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "08",
    "slug": "08-agent-framework-python",
    "title": "Agent Framework for Python",
    "type": "concept",
    "minutes": 25,
    "difficulty": "intermediate",
    "taskCount": 0,
    "summary": "How to drive the agent programmatically with the Python Agent Framework. Read-only overview.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "09",
    "slug": "09-hosted-agents",
    "title": "Build & run a hosted agent",
    "type": "concept",
    "minutes": 35,
    "difficulty": "advanced",
    "taskCount": 0,
    "summary": "How hosted agents run as containers and from source in your Foundry project. Read-only overview.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "10",
    "slug": "10-foundry-toolboxes",
    "title": "Foundry Toolboxes",
    "type": "concept",
    "minutes": 30,
    "difficulty": "intermediate",
    "taskCount": 0,
    "summary": "How to package and consume agent capabilities as a Foundry Toolbox. Read-only overview.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "11",
    "slug": "11-agent-ops-and-agent-id",
    "title": "Agent operations & Agent ID",
    "type": "handson",
    "minutes": 30,
    "difficulty": "intermediate",
    "taskCount": 36,
    "summary": "Configure agent identity (Agent ID) and monitor operations from the Operate tab.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "12",
    "slug": "12-publishing-agents",
    "title": "Publish an agent",
    "type": "handson",
    "minutes": 25,
    "difficulty": "intermediate",
    "taskCount": 28,
    "summary": "Publish the agent to Microsoft 365 Copilot and Teams and verify a live conversation.",
    "optional": false,
    "lab": 1
  },
  {
    "num": "13",
    "slug": "13-custom-engine-agent",
    "title": "Custom Engine Agent",
    "type": "concept",
    "minutes": 60,
    "difficulty": "advanced",
    "taskCount": 0,
    "summary": "How to build an M365 Custom Engine Agent proxy in your own tenant. Optional extra credit, read-only overview.",
    "optional": true,
    "lab": 1
  },
  {
    "num": "14",
    "slug": "14-work-iq",
    "title": "Ground with Work IQ (Microsoft 365)",
    "type": "handson",
    "minutes": 45,
    "difficulty": "advanced",
    "taskCount": 40,
    "summary": "Connect Work IQ as an MCP tool so the agent can reason over email, calendar, Teams, and files with the signed-in user's permissions. Requires tenant admin.",
    "optional": true,
    "lab": 1
  },
  {
    "num": "01",
    "slug": "lab2-01-workflow-overview",
    "title": "Agent workflow concepts & architecture",
    "type": "concept",
    "minutes": 15,
    "difficulty": "intermediate",
    "taskCount": 0,
    "summary": "Meet the commercial loan-underwriting scenario and see how sequential, group-chat, and human-in-the-loop orchestration combine into one Foundry workflow.",
    "optional": false,
    "lab": 2
  },
  {
    "num": "02",
    "slug": "lab2-02-create-agents",
    "title": "Create the eight committee agents",
    "type": "handson",
    "minutes": 30,
    "difficulty": "intermediate",
    "taskCount": 17,
    "summary": "Deploy a chat model and create the eight prompt agents — intake, enrichment, the credit committee, briefing, and decision letter — with copy-ready instructions and schemas.",
    "optional": false,
    "lab": 2
  },
  {
    "num": "03",
    "slug": "lab2-03-build-workflow",
    "title": "Assemble the multi-agent workflow",
    "type": "handson",
    "minutes": 25,
    "difficulty": "advanced",
    "taskCount": 7,
    "summary": "Paste the workflow YAML into the designer, wire the agents, and walk every node from intake through the human sign-off gate.",
    "optional": false,
    "lab": 2
  },
  {
    "num": "04",
    "slug": "lab2-04-run-and-trace",
    "title": "Run & trace the workflow",
    "type": "handson",
    "minutes": 20,
    "difficulty": "intermediate",
    "taskCount": 10,
    "summary": "Run a clean auto-approval and a borderline human-in-the-loop deal, then confirm end-to-end traces in Application Insights.",
    "optional": false,
    "lab": 2
  },
  {
    "num": "01",
    "slug": "lab3-01-setup-and-first-run",
    "title": "Set up the code environment",
    "type": "handson",
    "minutes": 20,
    "difficulty": "intermediate",
    "taskCount": 7,
    "summary": "Open the foundry-agent-framework project in its devcontainer, authenticate, and call one portal-authored agent from Python.",
    "optional": false,
    "lab": 3
  },
  {
    "num": "02",
    "slug": "lab3-02-bind-portal-agents",
    "title": "Bind the portal agents from code",
    "type": "handson",
    "minutes": 15,
    "difficulty": "intermediate",
    "taskCount": 4,
    "summary": "Reuse the eight Lab 2 committee agents by name — the hybrid model: author in the portal, orchestrate in code.",
    "optional": false,
    "lab": 3
  },
  {
    "num": "03",
    "slug": "lab3-03-sequential-intake",
    "title": "Sequential intake pipeline",
    "type": "handson",
    "minutes": 20,
    "difficulty": "intermediate",
    "taskCount": 4,
    "summary": "Build a Sequential orchestration that runs intake then enrichment, and inspect the structured fact sheet.",
    "optional": false,
    "lab": 3
  },
  {
    "num": "04",
    "slug": "lab3-04-committee-magentic",
    "title": "The credit committee with Magentic",
    "type": "handson",
    "minutes": 30,
    "difficulty": "advanced",
    "taskCount": 4,
    "summary": "Coordinate the three specialists under a planning manager with Magentic orchestration to produce the committee recommendation.",
    "optional": false,
    "lab": 3
  },
  {
    "num": "05",
    "slug": "lab3-05-human-in-the-loop",
    "title": "Human-in-the-loop sign-off",
    "type": "handson",
    "minutes": 30,
    "difficulty": "advanced",
    "taskCount": 5,
    "summary": "Pause the run for a Senior Underwriter with request/response HITL, and resume on APPROVE / DECLINE / REVISE.",
    "optional": false,
    "lab": 3
  },
  {
    "num": "06",
    "slug": "lab3-06-durable-checkpointing",
    "title": "Durable pause & resume",
    "type": "handson",
    "minutes": 25,
    "difficulty": "advanced",
    "taskCount": 4,
    "summary": "Make the sign-off survive a process restart with FileCheckpointStorage, and resume from a checkpoint in a fresh run.",
    "optional": false,
    "lab": 3
  },
  {
    "num": "07",
    "slug": "lab3-07-memory-and-state",
    "title": "Memory & workflow state",
    "type": "concept",
    "minutes": 10,
    "difficulty": "intermediate",
    "taskCount": 0,
    "summary": "How conversation memory and shared workflow state carry the fact sheet and recommendation between stages.",
    "optional": false,
    "lab": 3
  },
  {
    "num": "08",
    "slug": "lab3-08-evaluation-harness",
    "title": "Evaluation harness",
    "type": "handson",
    "minutes": 25,
    "difficulty": "advanced",
    "taskCount": 4,
    "summary": "Score the committee over a dataset in code and gate the build on the human-signoff decision being correct.",
    "optional": false,
    "lab": 3
  },
  {
    "num": "09",
    "slug": "lab3-09-trace-and-observe",
    "title": "Trace & observe the run",
    "type": "handson",
    "minutes": 15,
    "difficulty": "intermediate",
    "taskCount": 4,
    "summary": "Send OpenTelemetry traces to Application Insights and read a full underwriting run as a span tree.",
    "optional": false,
    "lab": 3
  }
];
window.WORKSHOP_LABS = [
  {
    "lab": 1,
    "stage": 2,
    "status": "available",
    "theme": "Portal · prompt agent",
    "title": "Lab 1 — Prompt Agent with Foundry",
    "navTitle": "Lab 1 · Prompt Agent",
    "blurb": "Build, tool, ground, evaluate, and publish a single prompt agent — entirely in the Foundry portal."
  },
  {
    "lab": 2,
    "stage": 3,
    "status": "available",
    "theme": "Portal · agent workflow",
    "title": "Lab 2 — Multi-agent with Agent Workflow",
    "navTitle": "Lab 2 · Agent Workflow",
    "blurb": "Compose eight agents into one governed workflow that combines sequential, group-chat, and human-in-the-loop orchestration."
  },
  {
    "lab": 3,
    "stage": 3,
    "status": "available",
    "theme": "Python · Agent Framework",
    "title": "Lab 3 — Multi-agent with Agent Framework",
    "navTitle": "Lab 3 · Agent Framework",
    "blurb": "Rebuild the underwriting flow in Python — Magentic orchestration, human-in-the-loop sign-off, checkpointing, evaluation, and tracing."
  }
];
window.WORKSHOP_UPCOMING = [
  {
    "lab": 4,
    "stage": 4,
    "status": "upcoming",
    "theme": "Hybrid · code-led",
    "title": "Lab 4 — Integrated & Autonomous",
    "navTitle": "Lab 4 · Integrated & Autonomous",
    "blurb": "Let the orchestration act on real systems, safely — connect line-of-business systems, automate end-to-end, and enforce guardrails and approvals on every side effect.",
    "topics": [
      "Connect a line-of-business system as an MCP tool / Foundry Toolbox",
      "End-to-end automation — book the action on APPROVE",
      "Guardrails & approval gates on money-moving tools",
      "Bounded autonomy with human oversight",
      "Deploy the workflow as a hosted agent with azd"
    ]
  },
  {
    "lab": 5,
    "stage": 5,
    "status": "upcoming",
    "theme": "Hybrid · azd + CI",
    "title": "Lab 5 — Scale & Operate (AgentOps)",
    "navTitle": "Lab 5 · Scale & Operate",
    "blurb": "Run it reliably in production — monitor and continuously evaluate, optimise cost and performance, and manage agent lifecycle and versions.",
    "topics": [
      "Monitoring, tracing & alerting dashboards",
      "Continuous evaluation with regression gates",
      "Cost & performance optimisation",
      "Lifecycle & versioning with azd-based CI/CD",
      "Governance & Responsible AI reporting at scale"
    ]
  }
];
