This module connects **Work IQ** — the workplace intelligence layer over Microsoft 365 — to a Foundry agent as an **MCP tool**. Once connected, your agent can reason over email, calendar, Teams chats, and files with the signed-in user's permissions, sensitivity labels, and tenant policy applied automatically, so you never build a retrieval pipeline or compliance layer yourself.

> [!TIP]
> Tick the checkbox next to each step as you complete it. Your progress is saved in this browser and shown on the [workshop overview](../index.html).

> [!IMPORTANT]
> This module spans **three portals** — Entra, the Microsoft 365 admin center, and Foundry. Work through the parts in order. Parts 1–4 are one-time-per-tenant setup that an admin performs once; Parts 5–7 are per-project and are repeated for every Foundry project that uses Work IQ. A fourth portal, the Power Platform admin center, appears only in the optional remediation appendix at the end.

## Objectives

- Provision the **Work IQ service principal** so the API exists in your tenant.
- Create an Entra app registration and grant admin consent for **`WorkIQAgent.Ask`**.
- Enable **Copilot Credits** — the usage-based billing Work IQ requires before it will answer a single call.
- Create a **Work IQ MCP** tool connection in your Foundry project and complete the OAuth round-trip.
- Add the tool to an agent and confirm a grounded Microsoft 365 answer comes back.

## Prerequisites

This module needs more than the usual Foundry access, because Work IQ touches tenant-wide identity and billing. Parts 1–4 require tenant administration rights:

| You want to… | Typical role needed |
|---|---|
| Provision the Work IQ service principal | **Global Administrator** |
| Grant admin consent for `WorkIQAgent.Ask` | **Global Administrator** or **Privileged Role Administrator** |
| Attach pay-as-you-go billing | **Owner** or **Contributor** on the Azure subscription |
| Create the Power Platform billing plan *(optional — remediation only)* | **Power Platform Administrator** or **Global Administrator** |
| Create the Foundry tool connection | **Foundry Project Manager** on the project |
| Run the agent and complete OAuth sign-in | **Foundry User** on the project |

> [!NOTE]
> Work IQ uses **delegated** Entra authentication only. Application-only (client-credentials) auth is **not supported** — every call runs in the context of a signed-in user, which is what makes the permission and sensitivity-label enforcement possible.

### Microsoft 365 licensing

This is the most misunderstood part of Work IQ. What you need depends entirely on *which path* you use:

| Connection path | Requirement type | What you need |
|---|---|---|
| **Work IQ API** via MCP, A2A, or REST — this module | **Usage-based billing** | Copilot Credits enabled (Part 4). **No connector licensing.** |
| Connector-backed Microsoft 365 tools | **Connector licensing** | The specific connector's prerequisites, which *can* include a **Microsoft 365 Copilot** licence per calling user. |

> [!IMPORTANT]
> The Work IQ API path in this module does **not** require a Microsoft 365 Copilot licence for anybody — not the developer, not the calling user. Billing is purely consumption-based through Copilot Credits. A tenant holding only, say, **Microsoft 365 E5** and no Copilot SKUs at all can complete this module end to end. The per-user Copilot licence requirement applies only to *connector-backed* tools, which are a different feature.

These values are the same in every tenant — keep them handy:

| Item | Value |
|---|---|
| Work IQ application ID | `fdcc1f02-fc51-4226-8753-f668596af7f7` |
| Delegated permission | `WorkIQAgent.Ask` |
| MCP endpoint | `https://workiq.svc.cloud.microsoft/mcp` |
| Scope (full form) | `api://workiq.svc.cloud.microsoft/WorkIQAgent.Ask` |

## Steps

### Part 1 — Provision the Work IQ service principal

Work IQ has no presence in your tenant until you create its service principal. Until you do, it will not even appear in the **API permissions** picker in Part 3.

- [ ] Sign in with a Global Administrator account and create the service principal:

  ```bash
  az ad sp create --id fdcc1f02-fc51-4226-8753-f668596af7f7
  ```

- [ ] Confirm it now resolves:

  ```bash
  az ad sp show --id fdcc1f02-fc51-4226-8753-f668596af7f7 --query "{name:displayName, id:id}" -o table
  ```

  <details>
  <summary>Alternative — create it from Graph Explorer</summary>

  1. Open [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) and sign in as an admin.
  2. Set the method to **POST** and the URL to `https://graph.microsoft.com/v1.0/servicePrincipals`. Enter the URL *before* consenting, so Graph Explorer surfaces the right scopes.
  3. Select **Modify permissions** and consent to `Application.ReadWrite.All`. This grants the scope only for your Graph Explorer session — it does not change organization-wide permissions.
  4. Use this request body:

     ```json
     { "appId": "fdcc1f02-fc51-4226-8753-f668596af7f7" }
     ```
  5. Select **Run query**. **201 Created** confirms success; a conflict error means it already exists.

  </details>

> [!WARNING]
> `Insufficient privileges to complete the operation` here almost always means your Global Administrator role is **PIM-eligible but not activated**. Activate it in [Privileged Identity Management](https://entra.microsoft.com/) and retry. This is easy to misdiagnose: Graph's `transitiveMemberOf` only returns *activated* roles, so an un-activated role looks exactly like no role at all.

### Part 2 — Create the Entra app registration

This app is the OAuth client Foundry uses to obtain delegated tokens on each user's behalf.

- [ ] In the [Entra admin center](https://entra.microsoft.com/), go to **Entra ID → App registrations → New registration**.

- [ ] Name it something recognisable, such as `Foundry-WorkIQ-Connector`:
  - Leave **Supported account types** on **Accounts in this organizational directory only**.
  - Leave the redirect URI **blank** — Foundry generates it in Part 6, and you cannot know it yet.

- [ ] Copy the **Application (client) ID** and the **Directory (tenant) ID**.

- [ ] Go to **Certificates & secrets → New client secret**, set an expiry, and select **Add**.

- [ ] Copy the secret **Value** immediately and store it somewhere safe. It is shown only once.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> the <em>Certificates &amp; secrets</em> blade with the new secret's Value column.</span>
  </div>

> [!CAUTION]
> The secrets blade shows two columns: **Value** and **Secret ID**. You want **Value** (roughly 40 characters). **Secret ID** is a 36-character GUID. Pasting the Secret ID by mistake produces one of the most confusing failures in this module — Foundry reports **"Sign in successful"** and then loops on consent forever, because the authorize leg genuinely succeeds and only the token exchange fails.

<details>
<summary>💡 Creating the secret from the CLI — Azure CLI hides the value</summary>

`az ad app credential reset` scrubs secrets from **all** output, printing `******`. There is no flag to disable this. Fetch the secret through Microsoft Graph instead, using a token the CLI does not scrub:

```powershell
$token = az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv
$body  = @{ passwordCredential = @{
             displayName = "foundry"
             endDateTime = (Get-Date).AddYears(2).ToString("o")
           } } | ConvertTo-Json

$r = Invoke-RestMethod -Method Post -ContentType "application/json" `
       -Uri "https://graph.microsoft.com/v1.0/applications/{object-id}/addPassword" `
       -Headers @{ Authorization = "Bearer $token" } -Body $body

$r.secretText | Set-Content secret.txt
```

Use the app's **object ID** (not the client ID) in the URL. Then sanity-check the length before you paste it anywhere:

```powershell
(Get-Content secret.txt -Raw).Trim().Length   # expect ~40, never 36
```

Delete `secret.txt` once the value is in Foundry.

</details>

### Part 3 — Grant admin consent for `WorkIQAgent.Ask`

- [ ] In your app registration, open **API permissions → Add a permission → APIs my organization uses**.

- [ ] Search for **Work IQ**, select it, choose **Delegated permissions**, and tick **`WorkIQAgent.Ask`**.

- [ ] Add **`offline_access`** from **Microsoft Graph → Delegated permissions**. Without it, Entra issues no refresh token and your users are re-prompted to sign in constantly.

- [ ] Select **Grant admin consent for \<your tenant\>** and confirm both permissions show a green check in the **Status** column.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> <em>API permissions</em> showing WorkIQAgent.Ask granted for the tenant.</span>
  </div>

> [!NOTE]
> If **Work IQ** does not appear in the search results, Part 1 has not taken effect. Re-run `az ad sp create` and allow a minute for directory replication before searching again.

### Part 4 — Turn on Copilot Credits

Work IQ API usage is billed against **Copilot Credits**. With no credits policy in place, every call is rejected — no matter how correct your Entra configuration is.

- [ ] Open the [Microsoft 365 admin center](https://admin.microsoft.com) and go to **Copilot → Cost management**.

- [ ] Select **Get started**, then choose **Pay-as-you-go** as the billing method and select your Azure subscription.

- [ ] Set the **budget scope**. **All users** is simplest for a workshop; scope to a security group for production.

- [ ] Choose a spending limit (or **No limit**) and optionally configure budget alerts.

- [ ] Select **Customize setup configuration** and confirm **Work IQ API** is ticked under agents and services. Leave **Auto-apply new services** on.

- [ ] **Activate** the policy and confirm it shows **Enabled**.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> <em>Cost management</em> showing the policy Enabled with Work IQ API included.</span>
  </div>

> [!TIP]
> Entitlement does not apply instantly. Expect **30–60 minutes** before Work IQ stops returning `403 NoPolicy`, and occasionally longer on CDX or demo tenants (`MngEnvMCAP*`). If Parts 1–4 are all correct, waiting genuinely is the fix — resist the urge to start dismantling a working Entra configuration. If it still fails well beyond that window, see [the optional remediation appendix](#appendix--optional-power-platform-billing-plan).

### Part 5 — Create the Work IQ MCP tool connection

- [ ] Open your project in [Microsoft Foundry](https://ai.azure.com) and select **Tools** in the left navigation.

- [ ] Select **Connect a tool**, then open the **Catalog** tab.

- [ ] Search for **`Work IQ MCP`** — the exact phrase — select it, and choose **Create**.

> [!CAUTION]
> There are **two** Work IQ cards in the catalog and they are not interchangeable. The plain **"Work IQ"** card is the A2A connector: its endpoint is locked to `/a2a/`, and because its agent card declares no `securitySchemes` and it returns 401 without a `WWW-Authenticate` header, Foundry has nothing to build a consent URL from. The result is *"Sign-in couldn't start because the tool returned an invalid consent link."* Always choose **Work IQ MCP**.

- [ ] Fill in the connection using the values you copied in Part 2:

  | Field | Value |
  |---|---|
  | Endpoint | `https://workiq.svc.cloud.microsoft/mcp` |
  | Authentication | **OAuth Identity Passthrough** |
  | Client ID | Application (client) ID |
  | Client secret | Secret **Value** (~40 characters) |
  | Authorization URL | `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/authorize` |
  | Token URL | `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token` |
  | Refresh URL | `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token` |
  | Scopes | `api://workiq.svc.cloud.microsoft/WorkIQAgent.Ask,offline_access` |

- [ ] Replace `{tenant-id}` with your Directory (tenant) ID in all three URLs, then save the connection.

- [ ] Reopen the saved connection and **verify the three URLs kept their full path**.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> the saved Work IQ MCP connection showing the OAuth fields.</span>
  </div>

> [!WARNING]
> The portal sometimes saves the OAuth URLs as a bare `https://login.microsoftonline.com/`, dropping the tenant ID and the `/oauth2/v2.0/...` path. The symptom is unmistakable: after signing in, the popup lands on **`m365.cloud.microsoft/chat`** instead of returning to Foundry, because there is no valid redirect target. Re-enter the full URLs and save again. Note the **Scopes** field uses a **comma** separator here, not a space.

### Part 6 — Register the OAuth redirect URI

Foundry generates its redirect URL only **after** the connection is saved, so this step has to come second.

- [ ] Open the saved connection and copy the **OAuth redirect URL**. It looks like `https://global.consent.azure-apim.net/redirect/<guid>`.

- [ ] In the [Entra admin center](https://entra.microsoft.com/), open your app registration and go to **Authentication → Add a platform → Web**.

- [ ] Paste the redirect URL into **Redirect URIs** and select **Configure**.

> [!NOTE]
> Every connection gets its **own** redirect GUID. If you experimented with the A2A card earlier, its redirect URI will not work for the MCP connection — add the new one alongside it rather than replacing it. Registering several is harmless.

### Part 7 — Add Work IQ to your agent

- [ ] Open the agent that should use Microsoft 365 context — for example `acl-remedy-advisor`.

- [ ] Add the **Work IQ MCP** tool and select the connection you created in Part 5.

- [ ] If Foundry asks you to configure MCP tool access, allow the Work IQ tools the agent should be able to call, and decide whether calls require approval or run automatically.

- [ ] Save or publish the agent configuration.

- [ ] Start a **new thread** and send a prompt that needs work data:

  ```text
  Show me my unread email
  ```

- [ ] When the consent card appears, select **Open consent** **exactly once**, complete sign-in, and let the popup close on its own.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> the agent returning a grounded Microsoft 365 answer.</span>
  </div>

> [!CAUTION]
> Clicking **Open consent** more than once — or retrying in a thread that already has consent cards stacked up from an earlier failure — causes `AADSTS54005: authorization code was already redeemed`. An authorization code is single-use. After changing *any* connection setting, always start a **fresh thread** rather than retrying in the old one.

- [ ] Try a few more prompts to confirm the grounding is real:

  ```text
  Summarize my upcoming meetings for today.
  Find recent messages from my manager from this week.
  Retrieve the latest email related to the quarterly business review.
  ```

## Validation

- `az ad sp show --id fdcc1f02-fc51-4226-8753-f668596af7f7` resolves the Work IQ service principal.
- **API permissions** lists `WorkIQAgent.Ask` and `offline_access`, both with tenant-wide admin consent granted.
- **Copilot → Cost management** shows an **Enabled** policy that includes **Work IQ API**.
- *(Only if you applied the optional remediation)* The Power Platform billing plan shows a non-empty **Target environments** and includes the **Copilot Studio** meter.
- The Foundry connection's Authorization and Token URLs both contain your tenant ID and `/oauth2/v2.0/`.
- The connection's redirect URL appears under the app registration's **Authentication → Web → Redirect URIs**.
- The agent answers a Microsoft 365 prompt with real tenant data, with no consent loop and no `403`.

## Congratulations 🎉

Your agent can now reason over Microsoft 365 work data through Work IQ. You provisioned the Work IQ service principal, created an Entra app with delegated `WorkIQAgent.Ask` consent, enabled Copilot Credits so the API is billable, and wired an MCP tool connection into a Foundry agent with a working OAuth round-trip. Every answer is scoped to the signed-in user's own permissions and sensitivity labels — with no retrieval pipeline, no orchestration code, and no custom compliance logic on your side, and no per-user Microsoft 365 Copilot licence required.

> [!TIP]
> **Next up → [Workshop overview](../index.html)**
> Revisit [Module 06: MCP tools](06-mcp-tools.html) to compare this managed catalog connection against a custom MCP server, or [Module 11: Agent ops and Agent ID](11-agent-ops-and-agent-id.html) to monitor Work IQ calls in production.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Sign-in couldn't start because the tool returned an invalid consent link` | You used the **A2A** "Work IQ" card. Its agent card declares no `securitySchemes` and it returns 401 with no `WWW-Authenticate`, so Foundry cannot construct a consent URL. | Delete that connection and use the **Work IQ MCP** card instead. The app registration, secret, and admin consent all carry over unchanged. |
| `403 NoPolicy — AI credits access is not configured for this user` | Copilot Credits policy missing or not yet propagated. Entitlement is not instant. | Complete Part 4 and confirm the policy is **Enabled** with **Work IQ API** included, then wait 30–60 minutes before assuming anything is broken. Only if it persists well beyond that, work through the remediation appendix below. |
| `403 Forbidden` on a connector-backed tool | That connector has its own licensing requirement. | Connector-backed tools are a separate feature from the Work IQ API and can require a **Microsoft 365 Copilot** licence per calling user. The MCP path in this module does not. |
| Sign-in popup lands on `m365.cloud.microsoft/chat` | The connection saved its OAuth URLs as a bare `https://login.microsoftonline.com/`, so there is no valid redirect target. | Re-enter the full tenant-scoped `/oauth2/v2.0/authorize` and `/token` URLs, save, and reopen to confirm they persisted. |
| "Sign in successful" but consent re-prompts endlessly | Secret **ID** (36 chars) pasted instead of secret **Value** (~40 chars). The authorize leg succeeds; only the token exchange fails. | Replace it with the secret Value. If the value was never copied, create a new secret — existing values cannot be retrieved. |
| `AADSTS54005: authorization code was already redeemed` | **Open consent** clicked twice, or stale consent cards queued in the thread from an earlier failure. | Close the popup, start a **new thread**, and click **Open consent** exactly once. |
| `AADSTS50011: redirect URI mismatch` | Foundry's generated redirect URL is not registered on the app. | Copy the connection's redirect URL and add it under **Authentication → Web**. Each connection has its own GUID. |
| **Work IQ** missing from the API permissions picker | Service principal not provisioned in the tenant. | Run Part 1, then wait a minute for directory replication. |
| `az ad sp create` fails with *Insufficient privileges* | Global Administrator role is PIM-eligible but not activated. | Activate the role in PIM and retry. `transitiveMemberOf` lists only activated roles, so this is easy to misread as missing access. |
| `az ad app credential reset` prints `******` | Azure CLI scrubs secrets from all output by design. | Use the Graph `addPassword` approach in the Part 2 deep-dive. |
| Users prompted to sign in on every request | `offline_access` missing, so Entra issues no refresh token. | Add `offline_access` to the app's delegated permissions and re-grant admin consent. |
| Billing plan created but credits still unavailable *(remediation only)* | The environment link on page 2 of the wizard was skipped. | Open the plan with **See details** and confirm **Target environments**. Re-edit the plan if it is empty. |
| Environment missing from the billing plan picker *(remediation only)* | An environment can belong to only one billing plan, and another plan already claims it. | Remove it from the other plan first, or add the Copilot Studio meter to that existing plan instead. |

## Appendix — optional Power Platform billing plan

> [!NOTE]
> **Do not do this as part of normal setup.** It is a remediation step, listed here only because the *Enable Work IQ* prerequisites still reference a Copilot Studio billing plan. Reach for it only when `403 NoPolicy` survives a correctly configured Part 4 **and** a full propagation window.

### When to consider it

Work through this in order, and stop as soon as calls succeed:

1. Confirm Part 4 is genuinely complete — policy **Enabled**, **Work IQ API** ticked, billing method attached.
2. Wait a **full 60 minutes** from the moment the policy was activated. Most `403 NoPolicy` reports are simply impatience.
3. Confirm the failure is really billing and not auth: a billing block returns `403` with `NoPolicy`, whereas a consent problem returns `403` with `Required scopes = [...]` and an audience problem returns `401`.
4. Only then add the billing plan below.

### Create the plan

- [ ] Open the [Power Platform admin center](https://admin.powerplatform.microsoft.com) and go to **Licensing → Pay-as-you-go plans**.

- [ ] Select **New billing plan** and choose **Azure subscription**.

- [ ] Give the plan a name, then select your **Azure subscription** and a **Resource group**.

- [ ] Under **Meter**, make sure **Copilot Studio** is ticked alongside the other products.

- [ ] Select **Next**, choose the **Region**, and tick the **environment** your users sit in — commonly `<Tenant> (default)`.

- [ ] Select **Save**, then reopen the plan with **See details** and confirm **Target environments** is **not empty**.

  <div class="shot-placeholder">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>
  <span><strong>Add your own screenshot:</strong> the billing plan details pane showing Meter and Target environments.</span>
  </div>

- [ ] Allow another propagation window before retesting.

> [!IMPORTANT]
> Creating the plan is **not** the same as applying it. The environment link lives on the *second* page of the wizard and is easy to skip — and a plan with zero target environments silently does nothing. An environment can belong to only one billing plan at a time, so if your environment does not appear in the picker, another plan already claims it.

<details>
<summary>💡 Deep dive — do you really need both billing surfaces?</summary>

Short answer: **no — Copilot Credits (Part 4) is the requirement. This appendix is almost certainly unnecessary.**

The confusion is real, and comes from the documentation contradicting itself:

- **[Connect agents to Microsoft 365 with Work IQ](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/work-iq)** — the most specific page for this exact scenario — states that the Work IQ API through *A2A, REST, or MCP* requires **usage-based billing via Copilot Credits**, and that "this path doesn't use connector licensing." Its troubleshooting entry for `403 Forbidden` reads: *"Enable Copilot Credits billing for Work IQ API calls."* The Power Platform is never mentioned.
- **[Copilot Credits overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/usage-based-billing-overview-copilot-credits)** lists **Work IQ API (for third-party agents)** as a service managed in the Microsoft 365 admin center — and separately directs Copilot Studio to its *own*, different pay-as-you-go path.
- **[Enable Work IQ](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/enable-work-iq)** prerequisites say *"a usage-based billing plan set up in Copilot Studio with an Azure subscription and resource group assigned."* The tell that this sentence is stale: the words say *Copilot Studio*, but the hyperlink on them points at the **Copilot Credits** article. It reads like a line inherited from an earlier preview, when Work IQ was gated behind Copilot Studio pay-as-you-go.

Two independent, more specific sources say Copilot Credits; one older, more general prerequisite list says Copilot Studio while linking to Copilot Credits. Weigh accordingly.

**Why this is hard to settle by experiment:** entitlement takes 30–60 minutes to propagate in *both* directions. If you configure both surfaces and calls start working, you cannot attribute the fix to either one. Isolating it means removing one, waiting an hour, testing, then restoring and waiting again — rarely worth it on a tenant that finally works.

**Practical guidance:** do Part 4, skip this appendix, and give it an hour before concluding anything is wrong.

</details>

## References

- [Enable Work IQ APIs](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/enable-work-iq)
- [Connect a Microsoft Foundry project to Work IQ](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/mcp/quickstart/foundry)
- [Connect agents to Microsoft 365 with Work IQ](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/work-iq)
- [Understand usage-based billing for Copilot Credits](https://learn.microsoft.com/en-us/microsoft-365/copilot/usage-based-billing-overview-copilot-credits)
- [Set up pay-as-you-go in Power Platform](https://learn.microsoft.com/en-us/power-platform/admin/pay-as-you-go-set-up)
