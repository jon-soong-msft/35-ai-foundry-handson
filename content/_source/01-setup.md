---
title: '01. Workshop setup and access verification'
description: 'Complete this lab to workshop setup and access verification.'
lastUpdated: '2026-07-13'
track: 'introduction-foundry-agent-service'
module: 1
slug: '01-setup'
estimatedTimeMinutes: 15
difficulty: 'beginner'
prerequisites: []
audience:
  - 'attendee'
technologies:
  - 'Microsoft Foundry'
  - 'Python'
tags:
  - 'foundry'
  - 'workshop'
  - 'setup'
  - 'and'
  - 'access'
status: 'active'
contentType: 'lab'
---
# 01. Workshop setup and access verification

**Estimated time:** 15 minutes

> [!TIP]
> Tick the checkbox next to each step as you complete it to track your progress through this module.

## Objectives

- Understand what Azure services you have been provisioned with for this lab.
- Install prerequisites and configure your local environment.
- Sign in to Azure and confirm access to your assigned Foundry project.
- Verify the pre-provisioned environment so you can focus on building agents.

> [!NOTE]
> **Individual mode:** If you completed the [Individual Quickstart](../../../docs/quickstart-individual.md), skip to [Part 2 - Access the Foundry portal](#part-2---access-the-foundry-portal).

## What your organizer provides

Your organizer provisions the shared Foundry environment and assigns you a project. Before you start, you should have received:

- **Attendee Portal URL** - sign in with your lab Microsoft account to get your personal `.env` values.
- `FOUNDRY_PROJECT_NAME` - for example, `attendee-01`.
- Shared values: `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `FOUNDRY_RESOURCE_NAME`, `FOUNDRY_PROJECT_ENDPOINT`, `AZURE_OPENAI_ENDPOINT`, and `AZURE_SEARCH_SERVICE_NAME`.

With the default `foundry-user` role you can build agents and use the models your organizer pre-deployed. You do not deploy models yourself.

> [!TIP]
> For the condensed setup flow, follow the [Attendee Quickstart](../../../docs/quickstart-attendee.md). For full details, troubleshooting, and Codespaces or dev container options, see the [Attendee Guide](../../../docs/guide-attendee.md).

## Prerequisites

Install the following before continuing:

1. [VS Code Insiders](https://code.visualstudio.com/insiders/) with the [Foundry Toolkit for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-windows-ai-studio.windows-ai-studio) extension.
1. [Python 3.13 or later](https://www.python.org/downloads/).
1. [uv](https://docs.astral.sh/uv/getting-started/installation/).
1. [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli).
1. [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd).
1. [Docker](https://www.docker.com/products/docker-desktop/) (optional) - required only for [Module 09](../09-hosted-agents/README.md) Part 1, which deploys a hosted agent from a container image. Every other module, including Module 09 Part 2 (deploy from source code), runs without it.

> [!NOTE]
> Docker is only needed for the container-image deployment path in Module 09. You can complete the rest of the workshop without it. GitHub Codespaces and local dev containers are fully supported, include Docker, and install all other prerequisites automatically. See the [Attendee Guide](../../../docs/guide-attendee.md) for setup steps.

## Steps

### Part 1 - Environment setup

> [!NOTE]
> **Individual mode:** If you completed the [Individual Quickstart](../../../docs/quickstart-individual.md), skip to [Part 2 - Access the Foundry portal](#part-2---access-the-foundry-portal).

- [ ] Clone the repository and open it in VS Code Insiders:

   ```bash
   git clone https://github.com/PlagueHO/foundry-agentic-workshop.git
   cd foundry-agentic-workshop
   code-insiders .
   ```

- [ ] Install the shared Python dependencies:

   ```bash
   uv sync
   ```

- [ ] Get your environment variables from the **Attendee Portal URL** your organizer shared. Sign in with your lab Microsoft account, then copy the values or click **Download .env** to save the file directly.

  If the portal is unavailable, copy the values from the onboarding file your organizer sent.

  In either case, copy `shared/.env.example` to `.env` in the repository root and populate:

  - `AZURE_SUBSCRIPTION_ID`
  - `AZURE_RESOURCE_GROUP`
  - `FOUNDRY_RESOURCE_NAME`
  - `FOUNDRY_PROJECT_NAME`
  - `FOUNDRY_PROJECT_ENDPOINT`
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_SEARCH_SERVICE_NAME`

- [ ] Sign in to Azure and select your subscription:

   ```bash
   az login
   ```

- [ ] Run the health check to validate your environment:

   ```bash
   uv run python labs/introduction-foundry-agent-service/shared/health-check.py
   ```

### Part 2 - Access the Foundry portal

> [!NOTE]
> **Individual mode:** If you haven't already, open the repository in VS Code Insiders:
>
> ```bash
> cd <foundry-agentic-workshop>
> code-insiders .
> ```

- [ ] Sign in to the [Foundry portal](https://ai.azure.com).

   > [!IMPORTANT]
   > All labs use the **New Foundry** experience. Enable the **New Foundry** toggle in the top navigation bar before starting.

- [ ] Enable the **New Foundry** toggle in the top navigation bar if it is not already on.

  <details>
  <summary>📸 Screenshot: New Foundry toggle in the top navigation bar</summary>

  ![New Foundry toggle in the top navigation bar](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-01/01-new-foundry-toggle.png)

  </details>

- [ ] When prompted, select the project named in your `FOUNDRY_PROJECT_NAME` from the dropdown and select **Let's go**.

   You should see the New Foundry project home page:

  <details>
  <summary>📸 Screenshot: New Foundry project home page</summary>

  ![New Foundry project home page](../../../docs/assets/screenshots/introduction-foundry-agent-service/lab-01/02-new-foundry-project-home.png)

  </details>

## Validation

- `az login` succeeds and the active subscription matches the workshop subscription.
- All required `.env` values are populated.
- `uv run python labs/introduction-foundry-agent-service/shared/health-check.py` reports a healthy environment.
- Your assigned project is visible in the [Foundry portal](https://ai.azure.com).

## Congratulations 🎉

You built a solid foundation for the rest of the workshop. You installed the shared dependencies with `uv sync`, populated your `.env` file, signed in to Azure, and confirmed access to your assigned Foundry project - with the health check passing and your project visible in the portal. Everything is in place to start building agents.

> [!TIP]
> **Next up → [Module 02: Foundry portal walkthrough](../02-foundry-portal-walkthrough/README.md)**
> Get oriented in the Microsoft Foundry portal so you know exactly where every model, tool, and setting lives. No need to scroll - jump straight in!

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `health-check.py` reports authentication failure | Not signed in or wrong subscription. | Re-run `az login` and `az account set --subscription <id>`. |
| Project not visible in the portal | Role not yet assigned, or wrong project name. | Confirm your `FOUNDRY_PROJECT_NAME` with your organizer or proctor. |
| Cannot deploy a model | Expected with the `foundry-user` role. | Use the models your organizer pre-deployed or request your organizer provides you with the necessary permissions. |
| Missing `.env` value | Assignment not yet received. | Confirm the values with your organizer. |
