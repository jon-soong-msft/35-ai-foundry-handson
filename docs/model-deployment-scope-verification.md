# Verification — are model deployments account-scoped or project-scoped?

**Question tested:** *"It seems the model deployment has to be done at project level, so that when
building an agent on Foundry it shows up in the dropdown model list."*

**Answer: No.** Model deployments are **account-scoped** (on the Foundry resource). Projects
*consume* them. Azure's own ARM provider refuses to create a deployment under a project.

The intuition is understandable — the portal puts the deployment UI *inside* a project — but it is
wrong, and `docs/admin-prework.md` Step 4 is correct as written.

**Secondary finding (this one *did* change the runbook):** because deployments live on the
account, an attendee granted only `Foundry User` **on their project** sees an **empty** model
dropdown — and gets no error explaining why. Proven empirically in [Test E](#test-e--empirical-rbac-proof-with-a-throwaway-principal).
Fixed by the `Reader`-on-the-account grant now in Step 5b-ii.

## Environment used

| Item | Value |
|---|---|
| Subscription | `<subscription>` (`<subscription-id>`) |
| Tenant | `<tenant-id>` |
| Foundry account | `<foundry-account>` (`rg-foundry-playground`, `southeastasia`) |
| Project | `proj-foundry-playground` |
| Signed in as | `<your-upn>` |
| Azure CLI | **2.79.0** |

> [!NOTE]
> Tests A–D and F are **read-only** — nothing was created, modified, or deleted. Test E is the one
> exception: it creates a throwaway service principal and two role assignments, all of which were
> deleted afterwards (see [Methodology notes](#methodology-notes--limitations)). No existing
> resource, deployment, or permission was touched at any point.

---

# Approach 1 — Azure CLI / ARM

## Prerequisite finding: CLI 2.80.0+ really is required

`admin-prework.md` Step 0 demands Azure CLI 2.80.0+. Confirmed on 2.79.0:

```powershell
az cognitiveservices account project --help
# ERROR: 'project' is misspelled or not recognized by the system.
```

The `account project` command group does not exist before 2.80.0. **Step 0 is not optional
boilerplate** — on 2.79.0 every project command in Step 5 fails.

The tests below therefore use `az rest` against ARM, which works on any CLI version *and* has the
advantage of exposing the resource paths directly — which is the whole point of the question.

```powershell
$ACC = "<foundry-account>"; $RG = "rg-foundry-playground"
$accId = az cognitiveservices account show -n $ACC -g $RG --query id -o tsv
```

## Test A — deployments at the **account** scope

```powershell
az rest --method get `
  --url "https://management.azure.com$accId/deployments?api-version=2025-06-01" `
  --query "value[].{name:name, model:properties.model.name, sku:sku.name, cap:sku.capacity}" -o table
```

```
Name                    Model                   Sku             Cap
----------------------  ----------------------  --------------  -----
gpt-5                   gpt-5                   GlobalStandard  50
text-embedding-3-large  text-embedding-3-large  GlobalStandard  50
gpt-5.6-terra           gpt-5.6-terra           GlobalStandard  500
gpt-5.6-sol             gpt-5.6-sol             GlobalStandard  500
```

✅ Four deployments, all living directly under `…/accounts/{account}/deployments`.

## Test B — projects are a *sibling* collection

```powershell
az rest --method get `
  --url "https://management.azure.com$accId/projects?api-version=2025-06-01" `
  --query "value[].{name:name, type:type}" -o table
```

```
Name
------------------------------------------
<foundry-account>/proj-foundry-playground
```

Type reported as `Microsoft.CognitiveServices/accounts/projects` — a subresource of `accounts`,
*parallel to* `accounts/deployments`, not a parent of it.

## Test C — the decisive one: deployments under a project

```powershell
az rest --method get `
  --url "https://management.azure.com$accId/projects/proj-foundry-playground/deployments?api-version=2025-06-01"
```

```
ERROR: Bad Request({"error":{"code":"UnsupportedAction",
        "message":"The requested action 'deployments' is not supported"}})
```

🔴 **This settles it.** A project-scoped deployment path does not merely go unused — the resource
provider explicitly rejects it. There is no such thing as a per-project model deployment, so
"deploy at project level" is not a configuration choice that exists.

This is also why `az cognitiveservices account deployment create` has **no `--project-name`
parameter**.

## Test D — the project still *sees* all four models (data plane)

This is the mechanism that answers the original question — how the dropdown gets populated.

```powershell
$tok = az account get-access-token --scope "https://ai.azure.com/.default" --query accessToken -o tsv
$h = @{ Authorization = "Bearer $tok" }
$url = "https://$ACC.services.ai.azure.com/api/projects/proj-foundry-playground/deployments?api-version=2025-05-01"
(Invoke-RestMethod -Uri $url -Headers $h).value | Select-Object name, type, modelPublisher | Format-Table
```

```
name                   type            modelPublisher
----                   ----            --------------
gpt-5                  ModelDeployment OpenAI
text-embedding-3-large ModelDeployment OpenAI
gpt-5.6-terra          ModelDeployment OpenAI
gpt-5.6-sol            ModelDeployment OpenAI
```

✅ The **project data-plane endpoint** returns the identical four models from Test A. The project
reads *through* to the account's deployments. Control plane = account; data plane = project.

## Test E — empirical RBAC proof with a throwaway principal

Tests A–D prove *where deployments live*. This test proves *what a project-scoped attendee can
actually see*. Rather than reason about scope inheritance, a disposable service principal was
created, given **exactly** the runbook's original Step 5b grant, and used to call the APIs.

```powershell
# Foundry User at PROJECT scope ONLY -- nothing else
az role assignment create --role "53ca6127-db72-4b80-b1b0-d745d6d5456d" `
  --assignee-object-id $SPID --assignee-principal-type ServicePrincipal `
  --scope "$accId/projects/proj-foundry-playground"
```

Confirmed sole assignment:

```
Role          Scope
------------  ------------------------------------------------------------------
Foundry User  …/accounts/<foundry-account>/projects/proj-foundry-playground
```

A token was obtained by direct OAuth client-credentials (deliberately **not** `az login`, which
would clobber the operator's CLI session). Results:

| # | Call | Plane | Result |
|---|---|---|---|
| E1 | `GET …/accounts/{acc}/projects/{proj}` | control | ✅ ALLOWED — assignment works |
| E2 | `GET …/accounts/{acc}/deployments` | control | ⚠️ **HTTP 200 with `0` deployments** |
| E3 | `GET {acc}.services.ai.azure.com/api/projects/{proj}/deployments` | **data** | ✅ 4 models |

Then `Reader` was added at the **account** scope and E2 re-run:

| # | Call | Before | After `Reader` |
|---|---|---|---|
| E2 | `GET …/accounts/{acc}/deployments` | **0** | **4** ✅ |

### 🔴 The most important operational detail

E2 does **not** return `403 Forbidden`. It returns **`200 OK` with an empty collection.** ARM
filters list results by what the caller can see rather than denying the request.

There is therefore **no error message to diagnose from**. The attendee sees an empty list, the
admin sees a successful API call, and nothing in any log says "permission denied." This is why the
Step 5b-ii `Reader` assignment is worth verifying explicitly in Step 6 rather than trusting it to
surface as an error on the day.

### Why the two planes disagree

`Foundry User` carries `dataActions: Microsoft.CognitiveServices/*`, which is evaluated at the
**project** endpoint the SP *does* hold rights on — so E3 succeeds. Its control-plane
`actions: Microsoft.CognitiveServices/*/read` would cover `accounts/deployments/read`, but an Azure
role assignment only applies at or below its scope:

| Assignment scope | Covers `…/accounts/{acc}/deployments`? |
|---|---|
| `…/accounts/{acc}` | ✅ yes |
| `…/accounts/{acc}/projects/{proj}` | ❌ **no** — deployments are a *sibling*, not a descendant |

This matches the
[documented persona mapping](https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry#sample-enterprise-rbac-mappings-for-projects):
*"Foundry User on Foundry project scope **and Reader on the Foundry resource scope**."*

> [!NOTE]
> The test principal, both of its role assignments, and its client secret were deleted immediately
> afterwards. `az role assignment list --assignee <sp> --all` returns empty and `az ad app show`
> returns `does not exist`.

## Test F — how a real working account is actually wired

```powershell
az role assignment list --scope $accId `
  --query "[].{role:roleDefinitionName, principal:principalName}" -o table
az role assignment list --scope "$accId/projects/proj-foundry-playground" -o table
```

| Scope | Assignments found |
|---|---|
| Account | `Foundry User`, `Azure AI Developer`, `Cognitive Services OpenAI User` ×2 |
| **Project** | **none — empty** |

✅ A live, working Foundry project has **zero** project-scope role assignments. Everything that
makes it function is assigned at the **account**. Strong corroboration that account scope is the
load-bearing one.

---

# Approach 2 — Foundry portal (Playwright MCP)

Driven headlessly against `https://ai.azure.com` with the **New Foundry** experience enabled.

## Getting to the project

Deep-linking straight to the resource avoids the tenant-picker dance (the account lives in a
different tenant from the corp default):

```
https://ai.azure.com/resource/deployments
  ?wsid=/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<acc>
  &tid=<tenant-id>
```

This redirects into the nextgen route, auto-selecting the project:

```
https://ai.azure.com/nextgen/r/<hash>,<rg>,,<account>,<project>/home
```

> [!NOTE]
> Two consecutive auth hops are normal — one for the classic shell
> (`scope=management.core.windows.net`), one for nextgen
> (`redirect_uri=/nextgen/auth/redirect`). Budget for both in a workshop dry run; attendees will
> see two account pickers on first load.

The project home page confirms the endpoint that Test D queried:

```
Project endpoint      https://<foundry-account>.services.ai.azure.com/api/projects/proj-foundry-playground
Azure OpenAI endpoint https://<foundry-account>.openai.azure.com/openai/v1
API key               API key authentication is disabled for this project.
```

## Portal finding 1 — the project-scoped URL shows account-level deployments

**Build → Models → Deployments**, at a URL that is *entirely project-scoped*:

```
/nextgen/r/<hash>,rg-foundry-playground,,<foundry-account>,proj-foundry-playground/build/models/deployments
```

| Name | Model | Version | Status | Type |
|---|---|---|---|---|
| `gpt-5.6-sol` | gpt-5.6-sol | 2026-07-09 | Succeeded | Global Standard |
| `gpt-5.6-terra` | gpt-5.6-terra | 2026-07-09 | Succeeded | Global Standard |
| `text-embedding-3-large` | text-embedding-3-large | 1 | Succeeded | Global Standard |
| `gpt-5` | gpt-5 | 2025-08-07 | Succeeded | Global Standard |

✅ Byte-for-byte the same four deployments as Test A.

🎯 **This is the source of the misconception.** You reach this page *through* a project, the URL
says project, so it reads as a project asset — but the rows are the parent account's, and any
deployment created here is written to `…/accounts/{acc}/deployments`. Every project on the account
sees this identical list.

## Portal finding 2 — the agent model dropdown is split into two groups

On the agent builder (`/build/agents/acl-remedy-advisor/build`), the **Model:** control reads
`gpt-5.6-terra — Global Standard deployment`. Opening it yields:

```
Deployments          <-- group header
  gpt-5
  gpt-5.6-terra
  gpt-5.6-sol
Models               <-- group header
  gpt-6-astra
  gpt-5.6-luna
  gpt-5.4-nano
  gpt-5.4-mini
  gpt-5.4-pro
  model-router
Browse more models
```

Two things to take from this:

1. ✅ The **`Deployments`** group is exactly the account's chat deployments — 3 of the 4, with
   `text-embedding-3-large` correctly filtered out as a non-chat model. **The dropdown is fed
   1:1 from account-level deployments.** No project-level deployment exists, and none is needed.

2. ⚠️ The **`Models`** group lists models that are **not deployed at all** — catalog entries the
   portal will deploy for you on selection. That is a *write* to the account's deployments.

### ⚠️ Workshop consequence of finding 2

An attendee holding only `Foundry User` (project) + `Reader` (account) will **see** the `Models`
group but cannot act on it — selecting an undeployed model needs
`accounts/deployments/write`, which `Reader` does not grant. They get a permission error that
looks like a broken lab.

Two mitigations, both cheap:

- Add to the attendee handout: *"pick your model from the **Deployments** group at the top of the
  list — ignore the **Models** section below it."*
- Add it to the Step 6 dry run: as the non-admin test user, confirm the pre-deployed model is
  selectable **and** note the error from picking an undeployed one, so you can pre-empt the
  question in the room.

## Portal finding 3 — the resolver proves the dropdown is account-scoped

The nextgen portal proxies everything through a single BFF endpoint
(`POST https://ai.azure.com/nextgen/api/query`), so the upstream isn't visible from the URL.
Capturing the **request bodies** while opening the model picker settles it:

```json
{"query":"listModelsResolver","params":{
   "subscriptionId":"<subscription-id>",
   "resourceGroupName":"rg-foundry-playground",
   "openAIResourceName":"<foundry-account>"        ← account; NO project parameter
}}
```

```json
{"query":"listCatalogModelsResolver","params":{"request":{"filters":[
   {"field":"type","operator":"eq","values":["models"]}, … ]}}}
```

🎯 **`listModelsResolver` is parameterized by subscription + resource group + *account name*, with
no project parameter at all.** The `Deployments` group is therefore resolved against the
**account's control plane** — the exact call that Test E2 showed returns an empty collection
without account-scope read.

The `Models` group comes from `listCatalogModelsResolver`, a global catalog query that carries no
account RBAC dependency at all.

### The resulting failure mode, precisely

An attendee with `Foundry User` on their project but **no** `Reader` on the account sees:

| Picker group | Source | What they see |
|---|---|---|
| **Deployments** | `listModelsResolver` (account control plane) | ❌ **empty** |
| **Models** | `listCatalogModelsResolver` (global catalog) | ✅ full list |

This is the worst possible combination: the section they *should* use is silently blank, while the
section they *must not* use looks perfectly healthy — funnelling them straight into selecting an
undeployed model, which then fails for lack of `deployments/write`.

Both halves of that trap are closed by the one `Reader` assignment in Step 5b-ii plus the handout
line.

---

# Conclusion

| Claim | Verdict | Proof |
|---|---|---|
| Deployments must be made per project | ❌ **False** | Test C — `UnsupportedAction` |
| Deployments are account-scoped, shared by all projects | ✅ True | Tests A, B, D; portal finding 1 |
| Projects see account deployments with no extra wiring | ✅ True | Test D; portal finding 2 |
| Agent dropdown is fed by account deployments | ✅ True | Portal findings 2 & 3 (`listModelsResolver`) |
| `admin-prework.md` Step 4 (deploy once at account) | ✅ Correct as written | all of the above |
| Azure CLI 2.80.0+ required for Step 5 | ✅ Confirmed | `account project` absent on 2.79.0 |
| Project-scoped `Foundry User` alone is sufficient | ❌ **False** | Test E — **empirically**: 0 deployments visible |
| Missing `Reader` produces a clear error | ❌ **False** | Test E2 — silent `200 OK` + empty list |

## Control plane vs data plane, side by side

With **only** `Foundry User` at project scope:

| | Control plane (`management.azure.com`) | Data plane (`*.services.ai.azure.com`) |
|---|---|---|
| Read the project | ✅ allowed | ✅ allowed |
| List deployments | ⚠️ `200 OK`, **0 results** | ✅ all 4 models |
| Feeds the portal dropdown | ✅ **yes** (`listModelsResolver`) | ❌ no |
| Feeds SDK/`AIProjectClient` code | ❌ no | ✅ yes |

This split is why the gap is easy to miss: **code written against the project endpoint keeps
working perfectly**, so an SDK-based smoke test passes while the portal experience the attendees
actually use is broken.

**Net effect on the runbook:** Step 4 needed no change. Step 5 did — hence the added
`Reader`-on-the-account assignment (Step 5b-ii) and the matching Step 6 check. Portal findings 2
and 3 add one line to the attendee handout.

---

# Methodology notes & limitations

- **No shared state was disturbed.** The probe authenticated by direct OAuth client-credentials
  (`Invoke-RestMethod` against `/oauth2/v2.0/token`) rather than `az login --service-principal`,
  which would have overwritten the operator's `~/.azure` context.
- **Not directly observed in the UI.** Service principals cannot sign in interactively, so the
  empty `Deployments` group was not seen rendered in a browser. It is inferred from two hard
  measurements: `listModelsResolver` takes account-scoped parameters only (finding 3), and that
  same account-scoped listing returns 0 results without `Reader` (Test E2). The inference chain is
  short and each link is directly evidenced, but it is an inference.
- **Tenant quirk encountered.** A tenant policy blocks client secrets with long lifetimes; the
  probe secret was created with a 1-day expiry as a workaround. Irrelevant to the findings, but
  worth knowing if the test is ever repeated here.
- **Cleanup confirmed.** Both role assignments removed, the application deleted (`az ad app show`
  → *does not exist*), and all local secret files shredded. No residue in the subscription or the
  repo.
