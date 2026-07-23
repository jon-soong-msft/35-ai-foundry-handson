# Microsoft Foundry Agent Service — Portal-First Workshop

A self-contained static web app that teaches your audience to build a real AI agent —
the **`acl-remedy-advisor`** — from start to finish, doing every hands-on step
**inside the Microsoft Foundry portal** at [ai.azure.com](https://ai.azure.com).

It is adapted from the open-source
[Microsoft Foundry Agentic Workshop](https://github.com/PlagueHO/foundry-agentic-workshop)
by Daniel Scott-Raynsford (MIT-licensed) and re-shaped for a **portal-first** delivery:
no local dev environment, no CLI, no `.env` — the audience only needs a browser and
existing access to an Azure subscription with Microsoft Foundry.

---

## Who this is for

- Clients / attendees who **already have** an Azure subscription and Microsoft Foundry access.
- Delivery that must happen **in the Foundry portal UI**, not in VS Code or from code.

The very first step assumed is simply: *they can sign in to ai.azure.com and open a project.*

---

## Open it

It is a plain static site — **no build step is required to view it**.

- **Quickest:** open `index.html` in a browser.
- **Recommended (so images and localStorage work cleanly):** serve the folder over HTTP:

  ```bash
  # from the repository root
  python -m http.server 8842
  # then browse to http://localhost:8842/index.html
  ```

## Host it

Copy the whole folder to any static host — for example:

- **Azure Static Web Apps** (drag-and-drop or CI).
- **Azure Blob Storage** static website (`$web` container).
- **GitHub Pages** (serve from the repo root).

No server-side code is needed. Progress tracking uses the browser's `localStorage`.

---

## What's in the box

```
35-ai-foundry-handson/
  index.html                     Landing page: hero, scenario, module grid, progress
  modules/                       One generated .html page per module (13)
  assets/
    css/styles.css               Theme (light/dark), layout, components, print
    js/app.js                    Nav, TOC, progress (localStorage), copy buttons
    js/modules-data.js           Generated module metadata (drives the landing grid)
    img/screenshots/lab-XX/      Bundled screenshots from the source workshop
    img/diagrams/                Bundled architecture diagrams
  content/                       Adapted Markdown — one .md per module (the source of truth)
    _source/                     The original, unmodified module READMEs (reference)
  tools/                         Markdown -> HTML generator (authoring convenience only)
  README.md
```

## How the modules were adapted

| Modules | Treatment |
|---|---|
| **01** | **Rewritten** as a portal-only flow: sign in, enable New Foundry, select/create a project, deploy a model. Assumes you own the subscription. |
| **02, 11, 12** | Portal-based in the source; kept close to the original. |
| **04, 05, 06, 07** | **Portal-first primary path.** The original workshop drives these through the VS Code *Agent Builder* extension and Python; here the hands-on is re-written for the portal Agents UI. The original VS Code / code path is preserved as a linked reference, and the source screenshots are kept as illustrations. |
| **03, 08, 09, 10, 13** | Condensed into short **read-only concept overviews** (they are VS Code / CLI / SDK / M365-heavy). Each links to the full source module for the code. |

Every page carries a note that the New Foundry UI evolves quickly, so exact labels and
layouts in your tenant may differ from the bundled screenshots.

---

## Edit or regenerate the content

The HTML in `modules/` is **generated** from the Markdown in `content/`. Edit the Markdown,
then rebuild:

```bash
cd tools
npm install      # first time only
npm run build    # regenerates modules/*.html and assets/js/modules-data.js
```

- Module order, titles, badges, time, and difficulty live in the `MODULES` array in
  `tools/build.mjs` — the single source of truth for metadata.
- Each `content/<slug>.md` is the body of one module. The generator strips the leading
  `# heading`, rewrites image links, converts `> [!NOTE]`-style callouts, turns
  `- [ ]` items into interactive progress steps, and builds the on-page table of contents.

## Swap in your own tenant's screenshots

The bundled screenshots come from the source workshop's shared environment. To use your own:

1. Drop your PNGs into `assets/img/screenshots/lab-XX/`, keeping the same file names to
   replace an existing image — **or** use new names and update the `![alt](path)` reference
   in the matching `content/<slug>.md`.
2. Placeholders that read *"Add your own screenshot"* mark steps that were newly authored
   for the portal and have no source image yet — replace those `div.shot-placeholder`
   blocks with a real `![alt](../assets/img/screenshots/lab-XX/your-file.png)`.
3. Run `cd tools && npm run build` to regenerate.

---

## Attribution & license

- Content adapted from the **[Microsoft Foundry Agentic Workshop](https://github.com/PlagueHO/foundry-agentic-workshop)**
  by Daniel Scott-Raynsford, used under the **MIT License**. The original scenario,
  narrative, screenshots, and diagrams are the author's work.
- This adaptation re-frames the labs for portal-first delivery and adds the surrounding
  web app (theme, navigation, progress tracking, landing page, and generator).

> **Disclaimer:** Microsoft Foundry ("New Foundry") is evolving rapidly. Menu names,
> button labels, and screens may change. Treat the steps and screenshots as a close guide
> rather than a pixel-perfect match, and follow the live portal where they differ.
