# Foundry Admin Pre-Work Runbook

**Workshop:** Lab 1 — Prompt Agent with Foundry (Modules 01–13)
**Audience:** the Foundry / Azure administrator preparing the client tenant
**Status:** ready to execute

---

## Outcome

On workshop day every attendee opens [ai.azure.com](https://ai.azure.com), selects a project that
is already waiting for them, and immediately creates an agent against a pre-deployed model, with
agent tracing already flowing. **Zero provisioning during the session.**

## Decisions locked in

| Decision | Value |
|---|---|
| Project model | One project per attendee, **pre-created by admin** — see [Appendix D](#appendix-d--variant-one-shared-project-for-the-whole-room) for the single-shared-project variant |
| Primary region | **`southeastasia`** (Singapore) |
| Fallback region | **`australiaeast`** |
| Chat model | `gpt-5.6-luna` |
| Embedding model | `text-embedding-3-small` |
| Deployment type | **`GlobalStandard`** — the only SKU carrying both models in-region |
| Shared capacity | `gpt-5.6-luna` **1000**, `text-embedding-3-small` **200** (units of 1K TPM) |
| Observability | One Application Insights, attached account-wide via `isSharedToAll` |
| Attendee role | **Foundry User** on their own project + **Reader** on the account |

Module 01 Part 2 becomes *"select your project"* rather than *"create a project"* — the module
already supports this via its pre-provisioned note.

## Choose your path: Portal or CLI

> [!TIP]
> **In a hurry?** [portal-quickstart.md](portal-quickstart.md) is a one-page, six-step, portal-only
> version using a single shared project (Appendix D). Roughly 20 minutes, no CLI. Use this document
> when you want per-attendee projects, scripting, or the reasoning behind each choice.

Every provisioning step below is given **both ways**. Pick one and stay with it; they produce the
same result, with one exception noted in the table.

| | **Portal** (`ai.azure.com`) | **CLI** (PowerShell + `az`) |
|---|---|---|
| Best for | Up to ~10 attendees | Any size; essential past ~15 |
| Setup needed | None — just a browser | Azure CLI 2.80+, extensions, `az login` |
| Effort per attendee | ~2 min of clicking | Zero after the loop is written |
| Repeatability | Manual, easy to misclick | Scripted, identical every run |
| Auditability | No record of what you did | The script *is* the record |
| **Shared App Insights** | ⚠️ **Not supported** — must connect per project | ✅ One connection covers all projects |

> [!IMPORTANT]
> **The one real difference is observability.** The `isSharedToAll` flag that makes a single
> Application Insights connection flow to every project is **not exposed in the portal** — the
> portal only creates project-scoped connections. Via the portal you must repeat the connection
> for each attendee project.
>
> A practical hybrid, and the recommended approach for a large room: **do the visual work in the
> portal, then run the single CLI/REST command in Step 3b** to attach observability once. That one
> command saves the most repetitive part of the job.

**Rule of thumb:** small room and you want to see what you're doing → Portal. Large room, or you
want to tear down and rebuild for a second delivery → CLI.

## Conventions

The CLI path assumes these. Set them once per shell.

```powershell
$RG   = "rg-foundry-workshop"
$ACC  = "fdy-workshop-01"
$LOC  = "southeastasia"            # verified; australiaeast is a drop-in fallback (Step 2)
$APPI = "appi-foundry-workshop"

# Built-in role definition ID -- a fixed, global Azure constant. NOT a placeholder.
$FOUNDRY_USER = "53ca6127-db72-4b80-b1b0-d745d6d5456d"
```

> [!NOTE]
> **`$FOUNDRY_USER` is a literal, not a value you look up.** Azure **built-in** role definition
> IDs are global constants — identical in every tenant and subscription on the planet. Only
> *custom* role IDs are per-tenant. Verify in any tenant with:
>
> ```powershell
> az role definition list --name "Foundry User" -o json |
>   ConvertFrom-Json | Select-Object roleName, roleType, @{n='guid';e={$_.name}}
> ```
>
> It returns `roleType: BuiltInRole` and the same GUID every time. The GUID is used here
> deliberately **because the display name is not stable** — this role was renamed from
> *Azure AI User* to *Foundry User*, and scripts keyed to the name broke. The GUID did not change.

---

## Step 0 — Prepare the admin workstation

**Both paths:**

- [ ] Confirm you hold **Owner** on the target resource group. Contributor can create resources
      but **cannot** perform the Step 5 role assignments — and those are mandatory.

- [ ] Register the Bot Service provider now (needed by Module 12; one-time per subscription and slow).
      Portal: *Subscription → Resource providers → search `Microsoft.BotService` → Register*. CLI:

  ```powershell
  az provider register --namespace Microsoft.BotService
  az provider show --namespace Microsoft.BotService --query registrationState -o tsv
  ```

**CLI path only:**

- [ ] Azure CLI **2.80.0 or later** — required for `az cognitiveservices account project` commands.
      Confirmed: 2.79.0 does **not** have that command group and fails with *"'project' is
      misspelled or not recognized"*.

  ```powershell
  az version
  az upgrade
  ```

- [ ] Application Insights extension, for Step 3b:

  ```powershell
  az extension add --name application-insights
  ```

- [ ] Sign in and pin the subscription:

  ```powershell
  az login
  az account set --subscription "<SUBSCRIPTION_ID>"
  az account show --query "{name:name, id:id}" -o table
  ```

---

## Step 1 — Lock the attendee list

Create `attendees.csv`. This drives every later step. Use **Entra UPNs**, not display names or
personal email.

```csv
alias,upn,displayName
alice,alice@contoso.com,Alice Tan
bob,bob@contoso.com,Bob Lim
carol,carol@contoso.com,Carol Ng
```

- [ ] Validate every UPN resolves in the same tenant as the subscription:

  ```powershell
  Import-Csv .\attendees.csv | ForEach-Object {
    $id = az ad user show --id $_.upn --query id -o tsv 2>$null
    if ($id) { "OK    $($_.upn)" } else { "FAIL  $($_.upn) — not found in tenant" }
  }
  ```

- [ ] Flag any guest (B2B) accounts — they sign in fine but often hit extra consent prompts on
      first Foundry load. Test one guest yourself.

- [ ] Freeze the list. Late additions mean repeating Step 5 for that person, plus role-propagation lag.

---

## Step 2 — Confirm quota and fix your capacity numbers

Both models are confirmed available on **GlobalStandard** in `southeastasia` and `australiaeast`,
with identical quota in each. **The region decision is already made — use `southeastasia`.**
`australiaeast` is a verified drop-in fallback, not a compromise.

### 2a. Capacity you are aiming for

There is **one shared deployment per model**, sized once, drawn on by every project on the account
(see Step 4). `--sku-capacity` is in units of 1,000 TPM.

Deploy at the **default quota ceiling**. There is no saving to be had by under-sizing — these are
pay-per-token SKUs, so unused capacity costs nothing, while under-sizing throttles the whole room
at the worst possible moment (Module 05's LLM-judge evaluators fire many calls in parallel and are
by far the spikiest part of Lab 1).

| Deployment | `--sku-capacity` | Effective |
|---|---:|---|
| `gpt-5.6-luna` | **1000** | 1M TPM shared |
| `text-embedding-3-small` | **200** | 200K TPM shared |

This comfortably covers a full room. Embedding is sized well under its ceiling on purpose —
Module 07's recommended **Path A (File Search)** touches it lightly, on a handful of small
documents.

### 2b. Verified — no decision required

This has already been run against a live subscription in **both** regions. The results were
identical, so **the region choice is settled: use `southeastasia`.** `australiaeast` remains a
drop-in fallback only if something unrelated blocks the primary.

Measured quota for our two models (units of 1,000 TPM):

| Quota bucket | Used | Limit |
|---|---:|---:|
| `OpenAI.GlobalStandard.gpt-5.6-luna` | 0 | **1000** |
| `OpenAI.GlobalStandard.text-embedding-3-small` | 0 | **3000** |
| `OpenAI.DataZoneStandard.text-embedding-3-small` | 0 | 1000 |

> **The single most useful fact here: quota buckets are per-model, not a shared pool.**
> The subscription probed was already running nine other model deployments — including
> `gpt-5.6-sol` and `gpt-5.6-terra` each at 600/1000 — and `gpt-5.6-luna` still read **0 / 1000**,
> completely untouched. Existing workloads in the client's tenant therefore **cannot** eat into the
> workshop's capacity, and the workshop cannot disrupt them. No coordination with other teams is
> needed before deploying.

Structural limits, per the [official limits table](https://learn.microsoft.com/azure/foundry/foundry-models/quotas-limits) — all comfortably clear:

| Limit | Value | We need |
|---|---:|---|
| Max projects per Foundry resource | 250 | one per attendee |
| Max model deployments per resource | 32 | 2 |
| Foundry resources per region per subscription | 100 | 1 |

### 2c. Sanity-check the client's subscription (2 minutes)

The numbers above are the platform default. Check once against **their** subscription purely to
confirm nothing is capped — a CSP-managed, sponsored, or trial tenant can deviate.

**Portal:** [Azure portal](https://portal.azure.com) → **Quotas** → **Azure AI** → filter by
region `Southeast Asia` and provider **Azure OpenAI**. Find the `gpt-5.6-luna` GlobalStandard row
and read its limit.

**CLI:**

```powershell
foreach ($r in @("southeastasia","australiaeast")) {
  Write-Host "`n=== $r" -ForegroundColor Cyan
  az cognitiveservices usage list --location $r `
    --query "[?contains(name.value,'gpt-5.6-luna') || contains(name.value,'text-embedding-3-small')].{quota:name.value, used:currentValue, limit:limit}" `
    -o table
}
```

- [ ] `gpt-5.6-luna` shows a limit of **1000** → proceed to Step 3 with `$LOC = "southeastasia"`.

**Only if that check fails** does anything need deciding:

| What you see | What it means | Do this |
|---|---|---|
| Limit is 1000 | Normal | Proceed. Nothing to decide. |
| Limit is lower but ≥ 300 | Capped tenant | Proceed; set `--sku-capacity` to the limit in Step 4b. |
| Limit is 0, or the row is missing | Model not enabled in that region for this subscription | Re-run for `australiaeast` and set `$LOC` accordingly. |
| Both regions are 0 | Subscription-level restriction | File a quota increase **now** — Azure portal → Quotas → Azure AI. This is not same-week turnaround. |

> Note there is **no `DataZoneStandard` row for `gpt-5.6-luna`** — that is expected, not a fault.
> See the residency warning below.

> [!WARNING]
> **If the client has a data-residency requirement, GlobalStandard is likely disallowed** —
> processing may occur in any region worldwide — **and `gpt-5.6-luna` cannot satisfy it.** Verified
> in both regions, `gpt-5.6-luna` offers only `GlobalStandard` and `GlobalProvisionedManaged`;
> there is **no Data Zone or Regional Standard SKU**, and `GlobalProvisionedManaged` is reserved
> capacity (PTU) — the wrong cost shape for a workshop.
>
> If residency is a hard requirement, **substitute the chat model**. `gpt-5.4-mini` supports
> `DataZoneStandard` in both regions and is the closest cheap equivalent; `gpt-5.6-sol` is the
> higher-capability option. `text-embedding-3-small` supports `DataZoneStandard` in both regions,
> so it needs no substitution. Then change `--sku-name` to `DataZoneStandard` in Step 4b and re-run
> the 2b probe. Confirm the zone boundary with their compliance team first — and note that swapping
> the chat model means the screenshots in the content will not match exactly.

---

## Step 3 — Create the shared infrastructure

### 3a. Resource group and Foundry account

#### Portal

1. Sign in to [ai.azure.com](https://ai.azure.com). Make sure the **New Foundry** toggle is **on**.
2. Select the project name in the upper-left corner, then **Create new project**.
3. Expand **Advanced options**:
   - **Resource group** — select **Create new**, name it `rg-foundry-workshop`.
   - **Location** — `Southeast Asia`.
   - **Foundry resource** — name it `fdy-workshop-01`.
4. Name this first project after yourself (for example `proj-ws-admin`) — it becomes the
   resource's **default project** and is useful as your own test bed. Attendee projects come in
   Step 5.
5. Select **Create** and wait for provisioning to finish.

> [!NOTE]
> **The portal always creates a Foundry resource alongside the project** — there is no "project
> only" option in this flow. That is fine here because this *is* the initial setup. It matters
> later: in Step 5 you must add attendee projects to **this existing resource**, not repeat this
> wizard, or each attendee ends up on their own isolated resource with no model deployments.

Portal-created resources have project management enabled automatically, so there is no equivalent
of the CLI flag below to worry about.

#### CLI

```powershell
az group create --name $RG --location $LOC

az cognitiveservices account create `
  --name $ACC `
  --resource-group $RG `
  --kind AIServices `
  --sku S0 `
  --location $LOC `
  --custom-domain $ACC `
  --assign-identity `
  --allow-project-management true
```

> [!IMPORTANT]
> **`--allow-project-management true` is mandatory.** Without it you cannot create child projects,
> and the account must be recreated from scratch.

- [ ] Confirm public network access is enabled — private-endpoint-only projects break the Module 12
      publish flow:

  ```powershell
  az cognitiveservices account show -n $ACC -g $RG --query properties.publicNetworkAccess -o tsv
  ```

### 3b. Shared observability — one Application Insights for the whole room

Agent tracing is what makes Module 11 (Observability) work. Without it, attendees open the
**Traces** tab and see nothing.

Create **one** Application Insights resource and point every project at it. How you attach it is
the one place the two paths genuinely differ.

#### Portal

The portal connects Application Insights **per project**. There is no shared option, so this is
repeated for each attendee project after Step 5 creates them.

1. In [ai.azure.com](https://ai.azure.com), open the project.
2. In the left navigation select **Agents**, then the **Traces** tab at the top.
3. Select **Connect**.
4. Choose **Create new** the first time — name it `appi-foundry-workshop`, in
   `rg-foundry-workshop`. For **every subsequent project, select that same existing resource** so
   all traces land in one place.
5. Confirm the success message.

If you don't see the **Connect** button: **Manage** → **Project details** → **Connected resources**
→ **Add connection** → **Application Insights**.

> [!WARNING]
> **Step 4 of this list is where the portal path goes wrong.** Selecting **Create new** for each
> attendee produces one Application Insights per project — 50 resources, 50 bills, and no single
> pane of glass. Always reuse the first one.

> [!TIP]
> Even on the portal path, consider running the CLI block below instead. It is a **single**
> command that covers every project at once, including projects created later, and it eliminates
> the most error-prone repetition in the whole runbook.

#### CLI

Attach it **once** at the account level with the `isSharedToAll` flag. Every project — including
ones created later — picks it up automatically, with no per-project wiring.

```powershell
az monitor app-insights component create `
  --app $APPI --resource-group $RG --location $LOC --kind web

$APPI_ID = az monitor app-insights component show `
  --app $APPI -g $RG --query id -o tsv
$APPI_CS = az monitor app-insights component show `
  --app $APPI -g $RG --query connectionString -o tsv
```

> Needs the `application-insights` CLI extension: `az extension add --name application-insights`.

Now create the account-scoped, shared-to-all connection. There is no `az` command for Foundry
connections yet, so this goes through ARM directly:

```powershell
$ACC_ID = az cognitiveservices account show -n $ACC -g $RG --query id -o tsv

$payload = @{
  properties = @{
    category      = "AppInsights"
    target        = $APPI_ID
    authType      = "ApiKey"
    isSharedToAll = $true                    # <-- the flag that does the sharing
    credentials   = @{ key = $APPI_CS }
    metadata      = @{ ApiType = "Azure"; ResourceId = $APPI_ID }
  }
} | ConvertTo-Json -Depth 10 -Compress

$tmp = New-TemporaryFile
$payload | Out-File $tmp.FullName -Encoding utf8 -NoNewline

az rest --method put `
  --url "https://management.azure.com$ACC_ID/connections/appinsights-shared?api-version=2025-04-01-preview" `
  --body "@$($tmp.FullName)" --headers "Content-Type=application/json"

Remove-Item $tmp.FullName
```

> [!IMPORTANT]
> **`isSharedToAll = $true` is the whole trick, and it is not the default.** This was verified
> empirically: an account-level connection created *without* the flag is invisible to child
> projects — a brand-new project listed **zero** connections even though the account had seven.
> Adding a connection *with* the flag made it appear in that same project immediately, with no
> further action. Omit it and you are back to wiring up every project by hand.

Verify any project sees it (after Step 5 has created some):

```powershell
az rest --method get `
  --url "https://management.azure.com$ACC_ID/projects/<project-name>/connections?api-version=2025-04-01-preview" `
  --query "value[].{name:name, category:properties.category, shared:properties.isSharedToAll}" -o table
```

- [ ] `appinsights-shared` appears, with `shared = True`.

> [!NOTE]
> **Attendees also need read access on the telemetry itself.** The Foundry User role on their
> project does *not* grant it — they will see the Traces tab but hit authorization errors when it
> queries. Step 5d handles this.

---

## Step 4 — Deploy the shared models

**Deploy once, at the account level.** Model deployments are *not* a per-project resource — they
sit on the Foundry resource (account) and every project underneath reuses them automatically.
The ARM path makes this explicit: a deployment is `…/accounts/{account}/deployments/{name}`, a
*sibling* of `…/accounts/{account}/projects/{name}`, which is why
`az cognitiveservices account deployment create` has no `--project-name` parameter.

| Scoped to the **account** (shared) | Scoped to each **project** (isolated) |
|---|---|
| Model deployments | Agents |
| Networking / security settings | Threads & Playground history |
| Account-level connections | Evaluations |
| Quota consumption (the TPM pool) | Files / File Search stores |
| | Tracing & Agent Ops telemetry |

This is what makes one-project-per-attendee inexpensive: you manage and pay for a single set of
deployments while each attendee gets isolated agents, evaluations, and traces. It is also the
reason Step 5c exists — because the deployment lives on the account, each project's managed
identity must reach *up* to the account to perform inference.

### 4a. Confirm current versions

Versions roll — check rather than trusting the literals in this document.

**Portal:** the model card shows the current version when you open it in step 4b below.

**CLI:**

```powershell
az cognitiveservices account list-models -n $ACC -g $RG `
  --query "[?contains(name,'gpt-5.6-luna') || contains(name,'text-embedding-3-small')].{name:name,version:version,format:format}" -o table
```

### 4b. Deploy

#### Portal

Repeat for **both** models — `gpt-5.6-luna` and `text-embedding-3-small`.

1. In [ai.azure.com](https://ai.azure.com), confirm the resource selector (upper left) is on
   **`fdy-workshop-01`**. Deployments land on whichever resource is selected.
2. Select **Discover** in the upper-right navigation, then **Models** in the left pane.
3. Search for the model and open its card.
4. Select **Deploy** → **Custom settings**. *(Do not use **Default settings** — it assigns a small
   default TPM that will throttle the room.)*
5. Set:
   - **Deployment name** — exactly `gpt-5.6-luna` / `text-embedding-3-small`.
   - **Deployment type** — **Global Standard**.
   - **Tokens per Minute Rate Limit** — **1,000,000** for chat, **200,000** for embedding.
6. Select **Deploy**.
7. Confirm both appear under **Models + endpoints** with status **Succeeded**.

> [!NOTE]
> These are Azure OpenAI models sold directly by Azure, so there is **no Azure Marketplace
> subscription prompt**. If you see one, you've selected a partner/community model by mistake.

> [!TIP]
> The portal expresses capacity in **raw tokens per minute**; the CLI uses **units of 1,000 TPM**.
> `--sku-capacity 1000` and a portal value of `1,000,000` are the same thing.

#### CLI

```powershell
az cognitiveservices account deployment create `
  --name $ACC --resource-group $RG `
  --deployment-name gpt-5.6-luna `
  --model-name gpt-5.6-luna `
  --model-version "2026-07-09" `
  --model-format OpenAI `
  --sku-name GlobalStandard `
  --sku-capacity 1000

az cognitiveservices account deployment create `
  --name $ACC --resource-group $RG `
  --deployment-name text-embedding-3-small `
  --model-name text-embedding-3-small `
  --model-version "1" `
  --model-format OpenAI `
  --sku-name GlobalStandard `
  --sku-capacity 200
```

These are the Step 2a figures — the full default chat ceiling, and embedding well under its own.
Lower them only if the Step 2c sanity-check returned smaller limits for the client's subscription.

> [!WARNING]
> **Keep `GlobalStandard`.** On `Standard`/Regional, `text-embedding-3-small` is available in only
> 2 of 5 APAC regions — and **`southeastasia` is not one of them.** Switching SKU type will fail
> the embedding deployment outright.

> [!NOTE]
> **Keep deployment names identical to model names.** Lab instructions and screenshots reference
> them that way.

### 4c. Verify

**Portal:** open **Models + endpoints** — both deployments listed, status **Succeeded**, and the
TPM column showing the values you set.

**CLI:**

```powershell
az cognitiveservices account deployment list -n $ACC -g $RG `
  --query "[].{name:name, sku:sku.name, capacity:sku.capacity, state:properties.provisioningState}" -o table
```

Both must show `Succeeded`. Azure sometimes grants **less** capacity than requested without
erroring — confirm `capacity` matches your target, do not assume.

---

## Step 5 — Create one project per attendee + assign RBAC

### 5a–5c. Projects and role assignments

#### Portal

Repeat all of this **for each attendee**. Budget ~2 minutes each.

**Create the project — on the existing resource:**

1. In [ai.azure.com](https://ai.azure.com), select **Manage** in the upper-right navigation.
2. Select **Resource details** in the left pane.
3. Select **Add project**.
4. Name it `proj-ws-<alias>` and create it.

> [!WARNING]
> **Use this path, not "Create new project" from the project switcher.** That wizard creates a
> whole new Foundry resource, which has no model deployments and no shared observability — the
> attendee would open an empty project and nothing in Lab 1 would work. **Manage → Resource
> details → Add project** is the only correct route.

**Invite the attendee to their project:**

5. With the new project selected, go to **Manage** → **Project details** → **Users** tab.
6. Select **Add user**, enter the attendee's email, and select **Add**.

> [!TIP]
> **That's both role assignments done — no Azure portal trip needed.** The dialog states
> *"'Reader' and 'Foundry User' roles will be assigned to this user"*, and it applies them at the
> correct — and different — scopes. Verified on a real invite:
>
> | Role | Scope actually created |
> |---|---|
> | `Foundry User` | `…/accounts/{acc}/projects/{proj}` |
> | `Reader` | `…/accounts/{acc}` |
>
> That is exactly the pair described in Step 5b/5b-ii below. Only assign roles manually if you are
> deviating from this flow — and if you do, don't drop the account-scoped `Reader`.

**Connect observability:** follow the Step 3b portal steps for this project, reusing the existing
`appi-foundry-workshop` resource.

> [!TIP]
> **Use a Microsoft Entra security group.** The **Add user** picker accepts groups, so you can
> invite everyone to a project in one action. Project membership still has to be repeated per
> project, since each attendee gets a different one.

#### CLI

One loop does projects, both role assignments, and the managed identity:

```powershell
Import-Csv .\attendees.csv | ForEach-Object {
  $proj = "proj-ws-$($_.alias)"
  Write-Host "=== $proj  ($($_.upn))" -ForegroundColor Cyan

  # 5a. Create the project
  az cognitiveservices account project create `
    --name $ACC --resource-group $RG --location $LOC `
    --project-name $proj `
    --display-name "Workshop - $($_.displayName)" `
    --assign-identity | Out-Null

  # 5b. Attendee -> Foundry User, scoped to THEIR project only
  $projId = az cognitiveservices account project show `
    --name $ACC --resource-group $RG --project-name $proj --query id -o tsv

  az role assignment create `
    --role $FOUNDRY_USER `
    --assignee $_.upn `
    --assignee-principal-type User `
    --scope $projId | Out-Null

  # 5b-ii. Attendee -> Reader on the ACCOUNT, so the model picker populates
  $accId = az cognitiveservices account show -n $ACC -g $RG --query id -o tsv

  az role assignment create `
    --role "Reader" `
    --assignee $_.upn `
    --assignee-principal-type User `
    --scope $accId | Out-Null

  # 5c. Project's managed identity -> Foundry User on the ACCOUNT
  $mi = az cognitiveservices account project show `
    --name $ACC --resource-group $RG --project-name $proj `
    --query identity.principalId -o tsv

  az role assignment create `
    --role $FOUNDRY_USER `
    --assignee-object-id $mi `
    --assignee-principal-type ServicePrincipal `
    --scope $accId | Out-Null
}
```

> [!TIP]
> To invite an Entra security group rather than individuals, swap `--assignee <upn>` for
> `--assignee-object-id <group-object-id> --assignee-principal-type Group`.

> [!IMPORTANT]
> **Step 5b-ii is what makes the agent's model picker non-empty — and on the CLI path you must do
> it yourself.** The portal's **Add user** dialog assigns `Reader` at account scope automatically;
> `az role assignment create` does not.
>
> Re-tested with a service principal holding **only** project-scoped `Foundry User`:
>
> | Call | Plane | Result without `Reader` |
> |---|---|---|
> | `GET …/accounts/{acc}/projects/{proj}` | control | ✅ 200 |
> | `GET …/accounts/{acc}` | control | ❌ 403 |
> | `GET …/accounts/{acc}/deployments` | control | ⚠️ **200 with an empty list** |
> | `GET {acc}.services.ai.azure.com/api/projects/{proj}/deployments` | **data** | ✅ all 4 models |
>
> The two planes disagree, so *which one the portal uses* decides the answer. Captured portal
> traffic settles it: the model picker calls `listModelsResolver`, parameterized by
> **subscription + resource group + account name, with no project parameter** — the account-scoped
> control-plane path. Without `Reader` that returns an empty collection, so the **Deployments**
> group in the picker is blank.
>
> **The failure is silent.** ARM returns `200 OK`, not `403` — it filters list results by what the
> caller can see rather than denying the request. Nothing in any log says "permission denied",
> which is why Step 6 verifies this assignment explicitly.
>
> **Useful nuance:** because the *data plane* does work with only the project-scoped grant, an
> attendee could still create and run agents from **code** (Module 08's SDK path) without `Reader`.
> That is why this cannot be caught by an API smoke test — only the portal is affected.
>
> This matches the documented
> [Foundry RBAC persona table](https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry#sample-enterprise-rbac-mappings-for-projects):
>
> | Persona | Role and Scope |
> |---|---|
> | Team members or developers | **Foundry User on Foundry project scope *and* Reader on the Foundry resource scope** |
>
> `Reader` is deliberately the weaker option: it grants control-plane *read* without deploy
> rights. Assigning `Foundry User` at account scope instead would also work, but hands every
> attendee data-plane access across *all* projects — defeating the isolation in Step 5b.

> [!IMPORTANT]
> **Step 5c is the silent failure mode — and it is CLI-only.** Because model deployments live on
> the *account* (see Step 4), each project's managed identity needs `Foundry User` **at the account
> scope** to perform inference through the project endpoint.
>
> - **Portal path:** handled for you. The portal creates this assignment automatically when it
>   creates the project, provided the person clicking has rights to assign roles.
> - **CLI path:** **not** handled. Skip the `5c` block and attendees will see their project but
>   every agent call fails with an authorization error.

### 5d. Grant read access to the shared telemetry

The shared Application Insights from Step 3b collects everyone's traces, but `Foundry User` on a
project grants **no** rights over the Application Insights resource. Without this, Module 11 shows
an authorization error instead of traces.

#### Portal

1. In the [Azure portal](https://portal.azure.com), open the `appi-foundry-workshop` resource.
2. **Access control (IAM)** → **Add** → **Add role assignment**.
3. Role: **Log Analytics Reader**. Members: the attendee — or, far better, the Entra security
   group containing all of them.
4. **Review + assign**.

#### CLI

Assign **Log Analytics Reader** at the Application Insights scope:

```powershell
$APPI_ID = az monitor app-insights component show --app $APPI -g $RG --query id -o tsv

Import-Csv .\attendees.csv | ForEach-Object {
  az role assignment create `
    --role "Log Analytics Reader" `
    --assignee $_.upn `
    --assignee-principal-type User `
    --scope $APPI_ID | Out-Null
}
```

> [!TIP]
> For a large room, put the attendees in a **Microsoft Entra group** and assign
> `Log Analytics Reader` to the group once instead of looping. One assignment scales better and is
> far easier to revoke during teardown.

> [!NOTE]
> **Everyone can see everyone's traces.** Application Insights has no per-project row-level
> filtering here — a shared workspace is a deliberate trade for "configure once." That is fine for
> a workshop on synthetic Contoso data; call it out if the client is sensitive about it. The
> alternative is one App Insights per attendee, which loses the shared-connection benefit entirely.

- [ ] **Only if Module 12 is hands-on:** additionally grant each attendee **Azure Bot Service
      Contributor** (or Contributor) on the resource group, and brief them to publish with the
      **"Just you"** scope — that avoids needing M365 admin approval.

---

## Step 6 — Verify before the session

The dry run at the end of this step is path-agnostic and is the check that actually matters. The
scripted checks are CLI-only; on the portal path, verify by eye in **Manage → Project details →
Users** for a sample of projects, then rely on the dry run.

- [ ] Projects exist and RBAC landed:

  ```powershell
  az cognitiveservices account project list -n $ACC -g $RG --query "[].name" -o table

  $accId = az cognitiveservices account show -n $ACC -g $RG --query id -o tsv

  Import-Csv .\attendees.csv | ForEach-Object {
    $projId = az cognitiveservices account project show `
      --name $ACC -g $RG --project-name "proj-ws-$($_.alias)" --query id -o tsv

    # Foundry User on their project (5b) -- expect 1
    $u = az role assignment list --scope $projId --role $FOUNDRY_USER `
      --query "length([?principalName=='$($_.upn)'])" -o tsv

    # Reader on the account (5b-ii) -- expect 1; 0 means an empty model picker
    $r = az role assignment list --scope $accId --role "Reader" --include-inherited `
      --query "length([?principalName=='$($_.upn)'])" -o tsv

    "{0,-10} FoundryUser/project={1}  Reader/account={2}" -f $_.alias, $u, $r
  }
  ```

  Both columns must read `1`. A `Reader/account=0` is the silent failure from Step 5b-ii — the
  attendee opens their project fine, then finds **no deployments in the agent model picker**. It
  should only ever be `0` on the **CLI** path; the portal's **Add user** flow assigns it for you.
  Note that an API-level smoke test will *not* catch this: the data plane still works without
  `Reader`, so only the portal is affected.

- [ ] Shared observability is visible from a project:

  ```powershell
  $ACC_ID = az cognitiveservices account show -n $ACC -g $RG --query id -o tsv
  $first  = (Import-Csv .\attendees.csv)[0].alias

  az rest --method get `
    --url "https://management.azure.com$ACC_ID/projects/proj-ws-$first/connections?api-version=2025-04-01-preview" `
    --query "value[?properties.category=='AppInsights'].{name:name, shared:properties.isSharedToAll}" -o table
  ```

  Expect `appinsights-shared` with `shared = True`. Empty output means Step 3b's `isSharedToAll`
  flag was missed.

- [ ] **Full dry run as a real non-admin user.** Borrow or create one test account, assign it
      exactly as in Step 5, then walk Modules 01 → 04: open the project, confirm both models appear
      without deploying anything, create an agent named `acl-remedy-advisor`, chat with it, then
      open **Agents → Traces** and confirm the run appears. This is the highest-value check in this
      runbook — it catches 5b-ii, 5c, 5d, the tracing connection, quota shortfalls, and consent
      prompts in one pass.

  While you are in the agent builder, open the **Model** picker and check both halves:

  | Group | Expected for an attendee |
  |---|---|
  | **Deployments** | `gpt-5.6-luna` present and selectable — this is the pass condition |
  | **Models** | Undeployed catalog entries. Selecting one **errors** (needs `deployments/write`) |

  An empty **Deployments** group means the Step 5b-ii `Reader` assignment is missing or hasn't
  propagated yet. Verified live: the picker is populated from *account*-level deployments, so this
  group is the only part attendees should touch — see
  [`model-deployment-scope-verification.md`](./model-deployment-scope-verification.md).

- [ ] **Allow for Entra role propagation** — assignments can take ~15 minutes, sometimes longer.
      Complete Step 5 at least a day ahead; never on the morning of.

- [ ] **Network test from the client's actual corporate network:** `ai.azure.com` and
      `*.services.ai.azure.com` reachable, and SSE/streaming not blocked by the proxy — the agent
      Playground streams responses.

---

## Step 7 — Decide the three externally-dependent modules

The only parts of Lab 1 needing more than the above.

| Module | Requirement | Recommendation |
|---|---|---|
| **06 — MCP tools** | A running MCP server reachable over HTTPS, URL ending `/mcp` | Deploy the sample `retail-remedy-ops` server **once** to Azure Container Apps in `$LOC`; distribute one shared URL. **Without this, Module 06 cannot run.** |
| **07 — Foundry IQ** | Path A: nothing extra. Path B: Azure AI Search with indexed content | **Use Path A (File Search)** — attendees upload `content/store-return-policy.md` themselves. Provision Azure AI Search only if you want the enterprise grounding story. |
| **12 — Publishing** | `Microsoft.BotService` registered (Step 0) + Bot Service RBAC (Step 5) + Teams in same tenant | Confirm attendees can see personal-scope Teams apps. If tenant policy blocks sideloading, **demo** this module instead of running it hands-on. |

---

## Attendee handout

Send each attendee only this:

> - **Portal:** <https://ai.azure.com> → sign in with your work account → turn on the **New Foundry** toggle
> - **Your project:** `proj-ws-<your-alias>` — select it from the project picker (do **not** create a new project)
> - **Models already deployed for you:** `gpt-5.6-luna` (chat) and `text-embedding-3-small` (embedding) — do **not** deploy your own
> - **Choosing the model on an agent:** the picker has two sections. Pick from **Deployments** at
>   the top. Ignore the **Models** section below it — those aren't deployed, and selecting one
>   needs admin rights you don't have (it will error).
> - **Expect two sign-in prompts** on first load — one for the portal shell, one for New Foundry. Normal.
> - **Agent name for the labs:** `acl-remedy-advisor`
> - **MCP server URL (Module 06):** `<shared URL>`
> - **Bring:** a modern browser. Nothing to install.

---

## Teardown

Deleting the resource group removes everything in one action — projects, deployments, the
Application Insights resource, the shared connection, and all resource-scoped role assignments.
Any Bot Service resources from Module 12 are in the RG too.

**Portal:** [Azure portal](https://portal.azure.com) → **Resource groups** → `rg-foundry-workshop`
→ **Delete resource group**.

**CLI:**

```powershell
az group delete --name $RG --yes --no-wait
```

If you used an Entra security group, delete it separately — it lives in Entra ID, not the
subscription, and is not removed by either method above.

---

## Appendix A — Role reference

The Foundry RBAC roles were **recently renamed**. Use GUIDs, not names, while the rename rolls out.

> **These GUIDs are global constants, not placeholders.** Azure built-in role definition IDs are
> identical in every tenant and subscription; only *custom* roles get per-tenant IDs. Paste them
> as-is. They are preferred over display names here precisely because the names changed and the
> GUIDs did not.

| Role (current) | Previously | GUID | Create project | Build in it |
|---|---|---|:--:|:--:|
| **Foundry User** ✅ | Azure AI User | `53ca6127-db72-4b80-b1b0-d745d6d5456d` | ✘ | ✔ |
| Foundry Project Manager | Azure AI Project Manager | `eadc314b-1a2d-4efa-be10-5d325db5065e` | ✘ | ✔ |
| Foundry Account Owner | Azure AI Account Owner | `e47c6f54-e4a2-4754-9501-8e0985b135e1` | ✔ | ✘ |
| Foundry Owner | Azure AI Owner | `c883944f-8b7b-4483-af10-35834be79c4a` | ✔ | ✔ |
| Foundry Agent Consumer | — | `eed3b665-ab3a-47b6-8f48-c9382fb1dad6` | ✘ | ✘ |

**Attendees get Foundry User** — least privilege, and sufficient because projects are pre-created.
They additionally need **Log Analytics Reader** on the shared Application Insights (Step 5d); that
is an Azure Monitor role, not a Foundry one, and is not implied by any Foundry role.

Two counter-intuitive facts worth knowing:

- **Contributor and even Owner do not grant data actions**, so neither can build agents on its own.
- **Foundry Project Manager cannot create projects**, despite the name.

Reference: [Role-based access control for Microsoft Foundry](https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry)

## Appendix B — Region and quota facts (verified)

SKU availability and default quota, confirmed directly against the live catalog via
`az cognitiveservices model list` and `az cognitiveservices usage list`:

| | `southeastasia` | `australiaeast` |
|---|:--:|:--:|
| `gpt-5.6-luna` — GlobalStandard | ✅ | ✅ |
| `gpt-5.6-luna` — **Data Zone Standard** | ❌ | ❌ |
| `gpt-5.6-luna` — GlobalProvisionedManaged (PTU) | ✅ | ✅ |
| `text-embedding-3-small` — GlobalStandard | ✅ | ✅ |
| `text-embedding-3-small` — Data Zone Standard | ✅ | ✅ |
| `text-embedding-3-small` — **Standard/Regional** | ❌ | ✅ |

Default quota (identical in both regions, units of 1,000 TPM):

| Quota bucket | Limit |
|---|---:|
| `OpenAI.GlobalStandard.gpt-5.6-luna` | 1000 |
| `OpenAI.GlobalStandard.text-embedding-3-small` | 3000 |
| `OpenAI.DataZoneStandard.text-embedding-3-small` | 1000 |

**Quota buckets are per-model.** Verified on a subscription already running nine other
deployments (including `gpt-5.6-sol` and `gpt-5.6-terra` at 600/1000 each): `gpt-5.6-luna` still
read 0/1000. Existing tenant workloads cannot consume the workshop's capacity, and vice versa.

Structural limits ([source](https://learn.microsoft.com/azure/foundry/foundry-models/quotas-limits)):

| Limit | Value |
|---|---:|
| Max projects per Foundry resource | 250 |
| Max model deployments per resource | 32 |
| Foundry resources per region per subscription | 100 |

Two rows drive the runbook's decisions:

- **`text-embedding-3-small` has no Standard/Regional SKU in `southeastasia`** — this is why
  `GlobalStandard` is pinned throughout.
- **`gpt-5.6-luna` has no Data Zone SKU anywhere** — which is why a hard residency requirement
  forces a chat-model substitution rather than a SKU change. `gpt-5.4-mini` (cheap) and
  `gpt-5.6-sol` (higher capability) both support `DataZoneStandard` in these regions.

Reference: [Region availability for Foundry Models sold by Azure](https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability)

## Appendix C — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Attendee sees project, agent calls fail with auth error | Step 5c skipped | Assign Foundry User to the project's managed identity on the account |
| Attendee cannot see the project at all | Role propagation lag, or wrong tenant | Wait ~15 min; verify UPN tenant matches subscription |
| Model deployment fails on quota | Subscription capped below default in that region | Re-run the Step 2c check; switch to `australiaeast`; else file a quota increase early |
| Deployment succeeded but capacity lower than requested | Azure granted partial capacity silently | Check `sku.capacity` in Step 4c; re-request or switch region |
| Embedding deployment fails in `southeastasia` | `Standard` used instead of `GlobalStandard` | Redeploy with `--sku-name GlobalStandard` |
| Room-wide throttling during Module 05 | Under-sized TPM | Confirm the deployment carries the full Step 2a capacity; if already at ceiling, file a quota increase |
| Publish flow unavailable (Module 12) | Public network access disabled | Portal publishing requires a public endpoint |
| Traces tab is empty for everyone | No App Insights connection on the project | Confirm Step 3b ran **with** `isSharedToAll = $true`; re-check via the Step 6 connection query |
| Traces tab shows an authorization error | Attendee lacks rights on the App Insights resource | Assign **Log Analytics Reader** at App Insights scope (Step 5d) |
| Traces empty for one attendee only | No agent run yet, or ingestion lag | Run the agent once, wait a few minutes, refresh |
| `az cognitiveservices account project` not recognised | Azure CLI older than 2.80.0 | `az upgrade` — confirmed: 2.79.0 does not have this command group |
| `az monitor app-insights` not recognised | Extension missing | `az extension add --name application-insights` |
| Attendee's project shows **no models** and isn't under `fdy-workshop-01` | Project was created via the portal's project-switcher **"Create new project"** wizard, which silently creates a **brand-new Foundry resource** | Delete it; recreate via **Manage → Resource details → Add project** on the workshop account (Step 5) |
| Fifty Application Insights resources appeared | Each admin/attendee clicked **Create new** in **Agents → Traces → Connect** | Delete the strays; use the Step 3b CLI block once, which is the only way to set `isSharedToAll` |
| Connection exists on the account but projects don't see it | Created through the portal, which cannot set `isSharedToAll` | Recreate it with the Step 3b CLI block (`isSharedToAll = $true`) |
| Deployment TPM looks 1000× too small | Portal takes **raw TPM**; CLI takes **units of 1,000** | Edit the deployment and re-enter the raw value (`1000000` / `200000`) |

---

## Appendix D — Variant: one shared project for the whole room

The main runbook provisions **one project per attendee**. A workshop has no real isolation
requirement, so a **single shared project** is a legitimate alternative that collapses most of
Step 5 and removes the one genuine Portal/CLI capability gap. This appendix records what was
tested and what it costs.

### Verdict

**Feasible, and materially simpler — provided you enforce a naming convention.** Recommended for
any room where attendees don't mind seeing each other's work. Keep the per-project design if the
client is sensitive about attendees reading each other's prompts and conversations, or if the lab
is assessed.

### What was verified empirically

| Question | Result |
|---|---|
| Can many agents coexist in one project? | ✅ Yes — no documented cap on agents per project |
| Are agent names unique? | ❌ **No.** Two agents both named `acl-remedy-advisor` were created successfully in the same project; they differ only by opaque ID (`asst_…`) |
| Does deleting a project remove its agents? | ✅ Yes — the project was deleted, recreated under the same name, and listed **zero** agents |
| Is the project name reusable immediately? | ✅ Yes — no soft-delete/purge step, unlike Foundry **accounts**. Delete returned in ~19 s |
| Will Agent Service limits bind? | ❌ No — 10,000 files per agent/thread, 300 GB total uploads, 100,000 messages per thread, 128 tools per agent |

### What gets simpler

- **Step 3b becomes trivial.** One project means one Application Insights connection, so the
  `isSharedToAll` flag is unnecessary — and with it, the only thing the portal genuinely cannot
  do. **A portal-only delivery becomes fully viable.**
- **Step 5 collapses** from a per-attendee loop to: one project, one `Foundry User` assignment
  (to an Entra group), one `Reader` on the account, one managed-identity assignment. Minutes
  instead of an hour.
- **Module 06 MCP connection is created once** and every attendee sees it. In the per-project
  design you would need one connection per project, or `isSharedToAll` again.
- **Step 6 verification** reduces to checking a single project.

### What it costs

> [!WARNING]
> **Enforce `acl-remedy-advisor-<alias>` as the agent name.** Duplicate names are allowed, and
> Modules 08, 12, and 13 resolve the agent **by name** from code (`AGENT_NAME` in `.env`). With
> several identically-named agents in one project, name-based lookup is ambiguous and an attendee
> can silently drive someone else's agent. This convention is mandatory here, not cosmetic.

- **No isolation.** `Foundry User` on the project grants full create/edit/delete over *every*
  agent in it. Agent-scope RBAC governs only agent *endpoint* invocation, not management, so it
  cannot be used to fence attendees off. Any attendee can delete anyone's agent.
- **Shared blast radius.** One person deleting a shared connection breaks it for the whole room.
- **Clutter.** ~50 agents in one list with no per-user filter, plus everyone's playground threads
  visible to everyone. Fine for synthetic Contoso data; mention it if the client is sensitive.
- **Teardown is not quite as clean as it sounds.** Deleting the project removes agents, threads,
  and uploaded files — but **not** the Foundry account, the model deployments, Application
  Insights, or any Bot Service resources from Module 12. Those are account- or RG-scoped. For a
  genuinely complete cleanup, still delete the resource group (see Teardown).

### Delta against the main runbook

| Step | Change |
|---|---|
| 1 | Still needed — the attendee list drives the Entra group |
| 2, 3a, 4 | Unchanged (deployments are account-scoped either way) |
| 3b | Connect App Insights to the one project; **drop `isSharedToAll`**, portal path is fine |
| 5 | Create **one** project (e.g. `proj-ws-shared`). Assign `Foundry User` on it to the attendee **group**, `Reader` on the account to the group, and `Foundry User` on the account to the project's managed identity — **once each** |
| 5d | Unchanged — assign `Log Analytics Reader` to the group |
| 6 | Verify the single project, then rely on the dry run |
| Handout | Replace "select `proj-ws-<your-alias>`" with the shared project name, and **add the mandatory agent-naming rule** |

---

> [!NOTE]
> Microsoft Foundry ("New Foundry") evolves rapidly. Portal labels, role names, and model versions
> may shift — treat the CLI commands as the source of truth and re-run the discovery commands
> (`list-models`, `usage list`) rather than trusting the literals in this document.
