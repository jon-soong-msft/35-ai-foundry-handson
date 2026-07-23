---
title: '13. Build a custom engine agent (optional, extra credit)'
description: 'Build a Microsoft 365 Custom Engine Agent proxy that connects Teams to a Microsoft Foundry agent.'
lastUpdated: '2026-07-14'
track: 'introduction-foundry-agent-service'
module: 13
slug: '13-custom-engine-agent'
estimatedTimeMinutes: 60
difficulty: 'advanced'
prerequisites: ['Module 12']
audience:
  - 'attendee'
technologies:
  - 'Microsoft Foundry'
  - 'Microsoft 365 Agents SDK'
  - 'Azure Bot Service'
  - 'FastAPI'
  - 'Python'
tags:
  - 'foundry'
  - 'custom-engine-agent'
  - 'microsoft-365'
  - 'teams'
  - 'bot-service'
status: 'active'
contentType: 'lab'
---
# 13. Build a custom engine agent (optional, extra credit)

**Estimated time:** 60 minutes

![Architecture diagram showing Teams and Microsoft 365 Copilot connected through an attendee-owned Azure Bot Service and local Microsoft 365 Agents SDK proxy to the acl-remedy-advisor Foundry agent.](../../../docs/assets/diagrams/lab-13-custom-engine-agent-architecture.svg)

> [!IMPORTANT]
> This is an optional, extra-credit module. The hands-on path requires your **own Azure subscription** and Microsoft Entra tenant. You need permission to create an app registration and an Azure Bot Service resource. The shared workshop tenant does not grant these permissions and is not used by this module.

<!-- markdownlint-disable-next-line MD028 -->
> [!TIP]
> Tick the checkbox next to each step as you complete it. If you do not have access to another Azure subscription and tenant, follow along with the facilitator demonstration instead.

## Objectives

- Explain how a Custom Engine Agent differs from the native Foundry publishing flow in Module 12.
- Provision the identity and Azure Bot Service resources needed by a Microsoft 365 Agents SDK proxy.
- Run a FastAPI proxy locally and expose it to Microsoft 365 through a development tunnel.
- Package and sideload the proxy as a custom Teams app.
- Send a message through Teams and confirm that the existing `acl-remedy-advisor` Foundry agent responds.

## Concepts

### Native publishing and Custom Engine Agents

Module 12 uses Foundry's **Publish** flow. Foundry owns the public endpoint, the Azure Bot Service integration, and the bridge between the Microsoft 365 Activity protocol and the agent's Foundry protocol.

This module uses the Custom Engine Agent pattern. Your application owns the bot endpoint and the orchestration code. Azure Bot Service forwards Bot Framework Activity messages to the proxy's `POST /api/messages` route. The proxy uses the Microsoft 365 Agents SDK to authenticate and dispatch the Activity, then calls the existing `acl-remedy-advisor` agent through `azure-ai-projects`.

![Sequence diagram showing a Teams message arriving as a Bot Framework Activity at Azure Bot Service, reaching the local proxy at /api/messages, calling the Foundry agent, and returning an Activity response.](../../../docs/assets/diagrams/lab-13-custom-engine-agent-sequence.svg)

The two paths are intentionally different:

| Module 12 | Module 13 |
|---|---|
| Foundry-managed publishing endpoint | Attendee-owned proxy endpoint |
| Foundry manages the Activity-to-Responses bridge | The proxy translates between Activity and Foundry calls |
| Agent configuration remains in Foundry | The proxy owns the web host, identity configuration, and request handling |
| Requires publishing permissions in the workshop project | Requires an attendee-owned tenant and subscription |

### Microsoft 365 Agents SDK and Microsoft Agent Framework

The proxy is built on **FastAPI** and calls the existing `acl-remedy-advisor` Foundry agent through `azure-ai-projects`. The full production pattern uses the **Microsoft 365 Agents SDK** — its `CloudAdapter` validates the Bot Framework JWT on each incoming request and its `AgentApplication` dispatches the Activity to typed message handlers. The starter code in `src/main.py` includes a TODO for this integration; the solution uses a simplified direct HTTP handler so the workshop can focus on the Foundry call.

Microsoft Agent Framework is a separate SDK used in other workshop modules for multi-agent orchestration and is not used here.

### Activity protocol and `/api/messages`

Azure Bot Service sends an HTTP `POST` request to `/api/messages`. The request body is a Bot Framework Activity represented as JSON. In a production deployment, `CloudAdapter` would validate the `Authorization` header's Bot Framework JWT against the Entra app registration. The simplified solution in this module accepts the request without JWT validation so the workshop can focus on the Foundry integration.

The solution calls the Foundry agent with the incoming message text and returns an Activity-shaped JSON response as the synchronous HTTP reply. The proxy does not expose a Foundry Hosted Agent `/responses` endpoint: it is a plain web application that owns the `/api/messages` route.

### Resource ownership

The Azure Bot Service and Entra app registration are created in your own tenant and subscription. The proxy uses your local Azure CLI sign-in to call the shared workshop Foundry project endpoint, so your identity must retain access to `acl-remedy-advisor`. The client secret is provisioned for the Entra app; store it in your local `.env` file and never commit it to source control.

## Steps

### Part 1 - Confirm access and prepare the code

#### 1. Confirm the optional-module prerequisites

- [ ] Confirm that you have an Azure subscription and Microsoft Entra tenant where you can create an app registration and an Azure Bot Service resource.
- [ ] Confirm that `FOUNDRY_PROJECT_ENDPOINT` is set and that `acl-remedy-advisor` is available in your Foundry project:

  ```powershell
  uv run python -c "
  from azure.ai.projects import AIProjectClient; from azure.identity import DefaultAzureCredential; import os
  ep = os.environ['FOUNDRY_PROJECT_ENDPOINT']
  names = [a.name for a in AIProjectClient(endpoint=ep, credential=DefaultAzureCredential()).agents.list()]
  print('Available agents:', names)
  assert 'acl-remedy-advisor' in names, 'Agent not found - complete Module 12 first.'
  "
  ```

  > [!IMPORTANT]
  > If `acl-remedy-advisor` is not listed, complete [Module 12](../12-publishing-agents/README.md) first. The proxy cannot ground its responses without this agent.

- [ ] Confirm that you are signed in to the correct Azure tenant:

  ```powershell
  az login
  az account show --query "{subscription:id, tenant:tenantId, user:user.name}" -o table
  ```

- [ ] Confirm that your Teams tenant allows custom app uploads. Open the [Teams Admin Center](https://admin.teams.microsoft.com/policies/app-setup), select **Global (Org-wide default)** under **App setup policies**, and check that **Upload custom apps** is set to **On**. If it is **Off**, toggle it to **On** and select **Save**. Policy changes can take up to 24 hours to propagate.

  > [!NOTE]
  > You need the Teams Administrator role to change this setting. If you do not have it, ask your tenant administrator to enable it before continuing.

- [ ] Install the Microsoft 365 Agents Toolkit CLI (`atk`) if you want to use its scaffolding or sideload helpers. Manual Teams upload is the supported path in this module and does not require `atk`.

#### 2. Review the sample layout

- [ ] Open `src/main.py`, `src/agent.py`, and `src/start_server.py`.
- [ ] Review the completed implementation in `solution/` before filling in the starter TODOs.
- [ ] Install the optional Module 13 dependencies:

  ```powershell
  uv sync --group module-13
  ```

### Part 2 - Run the proxy and expose it through a development tunnel

#### 3. Start the local proxy

- [ ] Complete the TODOs in `src/` or run the solution directly:

  ```powershell
  uv run python labs/introduction-foundry-agent-service/13-custom-engine-agent/solution/start_server.py
  ```

- [ ] Confirm that the application listens on `http://localhost:3978` and exposes `POST /api/messages`.

#### 4. Create a development tunnel

- [ ] Install the devtunnel CLI if it is not already available and sign in:

  ```powershell
  winget install Microsoft.DevTunnel
  devtunnel user login
  ```

- [ ] Create and start a public HTTPS tunnel to port 3978:

  ```powershell
  devtunnel host -p 3978 --allow-anonymous
  ```

- [ ] Note the URL printed on the `Connect via browser:` line — it looks like `https://<id>-3978.<region>.devtunnels.ms`.
- [ ] Keep the proxy and tunnel running for all remaining steps. A tunnel URL change requires re-running the provisioning script.

### Part 3 - Provision the bot identity and Azure Bot Service

#### 5. Create the Entra app and Bot Service

- [ ] Choose names for your Bot Service and resource group. The provisioning script creates the resource group when it does not exist.
- [ ] Set the deployment values in your local shell, substituting the tunnel URL from Step 4:

  ```powershell
  $env:BOT_SERVICE_NAME     = 'acl-remedy-advisor-cea'
  $env:BOT_RESOURCE_GROUP   = 'rg-acl-remedy-advisor-cea'
  $env:BOT_LOCATION         = 'australiaeast'   # region for the resource group
  $env:BOT_SERVICE_LOCATION = 'global'          # Bot Service location; valid values: global, westeurope, westus, centralindia
  $env:BOT_MESSAGING_ENDPOINT = 'https://<your-id>-3978.<region>.devtunnels.ms/api/messages'
  ```

- [ ] Run the provisioning script:

  ```powershell
  uv run python labs/introduction-foundry-agent-service/13-custom-engine-agent/solution/provision_bot_service.py
  ```

- [ ] Copy `BOT_APP_CLIENT_ID`, `BOT_TENANT_ID`, and `BOT_SERVICE_NAME` from the output into your local `.env` file.
- [ ] Copy the client secret into `.env` as `BOT_APP_CLIENT_SECRET`. The secret is displayed once and must never be committed to source control.

### Part 4 - Package and sideload the Teams app

#### 6. Update and package the manifest

- [ ] Set the bot ID in `appPackage/manifest.json` to the app ID printed by the provisioning script.
- [ ] Review the manifest's bot scopes and display metadata.
- [ ] Create a ZIP file containing `manifest.json` and the referenced icons. Do not include `.env` or any secret.

#### 7. Upload the custom app

- [ ] Open Microsoft Teams in the tenant associated with your Entra app.
- [ ] Open **Apps**, select **Manage your apps**, and choose **Upload a custom app**.
- [ ] Upload the ZIP package and open the resulting `ACL Remedy Advisor` app.

### Part 5 - Send a test message

#### 8. Verify the end-to-end conversation

- [ ] Send this message to the app:

  ```text
  A customer returned a $1,200 fridge that stopped cooling after 14 months. What remedy should we offer under the Australian Consumer Law?
  ```

- [ ] Confirm that the local proxy logs an incoming Activity and a response.
- [ ] Confirm that Teams displays the response from `acl-remedy-advisor`.
- [ ] Stop the proxy and send another message. Confirm that the failure is observable, then restart the proxy before continuing.

## Validation

- The Entra app registration and Bot Service exist in the attendee-owned resource group.
- The proxy starts locally. The client secret is printed once during provisioning and stored only in the local `.env` file.
- `POST /api/messages` accepts Bot Framework Activity requests when the Bot Service sends them.
- The Teams custom app opens and delivers the test message to the local proxy.
- The response is grounded by the existing `acl-remedy-advisor` Foundry agent.
- You can explain why this proxy is different from the Foundry-managed publishing bridge in Module 12.

## Congratulations 🎉

You built a Custom Engine Agent integration: Microsoft 365 sends Activity messages to your own proxy, and the proxy connects those messages to a Microsoft Foundry agent. This pattern gives you control of the channel-facing application while keeping the agent configuration and grounding in Foundry.

> [!TIP]
> Compare this custom proxy path with the native Foundry publishing flow and return to the [workshop overview](../README.md) when you are ready.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `acl-remedy-advisor` agent not found (404) | Complete [Module 12](../12-publishing-agents/README.md) first to create the agent. Verify that `FOUNDRY_PROJECT_ENDPOINT` points to the correct workshop project and that your Azure CLI identity has access. |
| `AuthenticationFailedException` when the proxy starts | Confirm the Bot Service app ID, tenant ID, and client secret are set in the local environment. Create a new secret if the previous one expired. |
| Bot Service reports an invalid messaging endpoint | Use an HTTPS tunnel URL ending in `/api/messages`. Confirm that the tunnel forwards to port 3978 and is still running. |
| Teams app upload is blocked | Confirm that custom app upload is enabled by your tenant policy, or ask a Teams administrator to upload the package. |
| The proxy receives no Activity | Confirm the Bot Service channel is enabled, the messaging endpoint is public HTTPS, and the local proxy is running. |
| The proxy responds but Foundry fails | Run `az account show`, verify `FOUNDRY_PROJECT_ENDPOINT`, and confirm your signed-in identity can access the workshop project. |
| `NotImplementedException` | A starter TODO is still incomplete. Compare the file with the matching implementation in `solution/`. |
