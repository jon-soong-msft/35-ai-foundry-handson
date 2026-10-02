# Workshop setup — portal quickstart

One shared project for the whole room. ~20 minutes, browser only, no CLI.
Full rationale: [admin-prework.md](admin-prework.md).

---

### 1. Create the resource group

[portal.azure.com](https://portal.azure.com) → **Resource groups** → **Create**

- Name `rg-foundry-workshop`, region **Southeast Asia** (fallback: **Australia East**).

### 2. Create the Foundry resource

**Create a resource** → search **Azure AI Foundry** → **Create**

- Name `fdy-workshop-01`, in the group and region above.
- Leave networking public — Module 12 publishing requires it.

### 3. Create the project

[ai.azure.com](https://ai.azure.com) → **Manage** (upper right) → **Resource details** → **Add project**

- Name it `proj-ws-shared`.

> ⚠️ Use this route. The **"Create new project"** button in the project switcher silently creates a
> *second* Foundry resource with no models in it — attendees would open an empty project.

### 4. Deploy the models

**Discover** → **Models** → open the model card → **Deploy** → **Custom settings**

| Model | Deployment type | Tokens per minute |
|---|---|---|
| `gpt-5.6-terra` | Global Standard | **1,000,000** |
| `text-embedding-3-small` | Global Standard | **200,000** |

> The portal box takes **raw TPM**, so type the full figures above. Both are Global Standard only
> in Southeast Asia — Data Zone and Standard aren't options for this pair.

Confirm both show **Succeeded** under **Models + endpoints**.

### 5. Invite the attendees

**Manage** → **Project details** → **Users** → **Add user** → enter their email → **Add user**.

That single action is enough — the portal assigns **both** roles at the right scopes:

| Role | Scope | Why |
|---|---|---|
| `Foundry User` | the **project** | build and run agents |
| `Reader` | the **Foundry resource** | populates the agent's model picker |

### 6. Turn on tracing (needed for Module 11)

**Agents** → **Traces** → **Connect** → **Create new** → `appi-foundry-workshop`.

Then give the attendees (or the group) **Log Analytics Reader** on that resource.

### 7. Teardown

Delete **`rg-foundry-workshop`** in the Azure portal. That removes everything above.

---

## Tell the attendees

> - Go to <https://ai.azure.com>, sign in, turn on the **New Foundry** toggle.
> - Select the project **`proj-ws-shared`** — do not create your own.
> - **Name your agent `acl-remedy-advisor-<your-alias>`.** This is required, not optional.
> - `gpt-5.6-terra` and `text-embedding-3-small` are already deployed. Pick from the
>   **Deployments** section of the model picker, not **Models**.
> - Expect two sign-in prompts on first load. Normal.

> ⚠️ **Why the name suffix matters:** everyone shares one project, duplicate agent names are
> not allowed, and later modules look the agent up *by name* from code. Without a unique suffix an
> attendee can end up driving someone else's agent.
