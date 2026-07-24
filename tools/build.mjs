// =====================================================================
// Foundry Agentic Workshop — static site generator (build-time only).
// Reads content/<slug>.md, emits modules/<slug>.html + assets/js/modules-data.js.
// The generated site itself needs no build step to view.
// Run:  npm run build    (from the tools/ directory)
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const OUT = path.join(ROOT, "modules");
const JS = path.join(ROOT, "assets", "js");

const SRC_REPO = "https://github.com/PlagueHO/foundry-agentic-workshop";
const SRC_BASE = SRC_REPO + "/blob/main/labs/introduction-foundry-agent-service";

// ---- Single source of truth for module order + metadata ---------------
const MODULES = [
  { num: "01", slug: "01-setup", type: "handson", minutes: 15, difficulty: "beginner",
    title: "Setup & access verification",
    summary: "Sign in to the Foundry portal, enable New Foundry, select or create a project, and deploy a model in your own subscription." },
  { num: "02", slug: "02-foundry-portal-walkthrough", type: "handson", minutes: 10, difficulty: "beginner",
    title: "Foundry portal walkthrough",
    summary: "Tour the Home, Discover, Build, and Operate tabs so you know where every model, tool, and setting lives." },
  { num: "03", slug: "03-foundry-toolkit-vscode", type: "concept", minutes: 15, difficulty: "beginner",
    title: "Foundry Toolkit for VS Code",
    summary: "How the Foundry Toolkit brings models, agents, and playgrounds into VS Code. Read-only overview." },
  { num: "04", slug: "04-prompt-based-agents", type: "handson", minutes: 20, difficulty: "beginner",
    title: "Create & chat with a Prompt Agent",
    summary: "Build the acl-remedy-advisor prompt agent in Agent Builder and chat with it in the portal." },
  { num: "05", slug: "05-agent-tools-and-evaluations", type: "handson", minutes: 30, difficulty: "intermediate",
    title: "Agent tools & evaluations",
    summary: "Add web search and Code Interpreter tools, then run an evaluation on the agent — all in the portal." },
  { num: "06", slug: "06-mcp-tools", type: "handson", minutes: 30, difficulty: "intermediate",
    title: "Integrate MCP tools",
    summary: "Wire a custom Model Context Protocol (MCP) server into the agent from the Foundry portal." },
  { num: "07", slug: "07-foundry-iq", type: "handson", minutes: 25, difficulty: "intermediate",
    title: "Ground with Foundry IQ knowledge",
    summary: "Ground the agent in your own policy documents with a Foundry IQ knowledge base." },
  { num: "08", slug: "08-agent-framework-python", type: "concept", minutes: 25, difficulty: "intermediate",
    title: "Agent Framework for Python",
    summary: "How to drive the agent programmatically with the Python Agent Framework. Read-only overview." },
  { num: "09", slug: "09-hosted-agents", type: "concept", minutes: 35, difficulty: "advanced",
    title: "Build & run a hosted agent",
    summary: "How hosted agents run as containers and from source in your Foundry project. Read-only overview." },
  { num: "10", slug: "10-foundry-toolboxes", type: "concept", minutes: 30, difficulty: "intermediate",
    title: "Foundry Toolboxes",
    summary: "How to package and consume agent capabilities as a Foundry Toolbox. Read-only overview." },
  { num: "11", slug: "11-agent-ops-and-agent-id", type: "handson", minutes: 30, difficulty: "intermediate",
    title: "Agent operations & Agent ID",
    summary: "Configure agent identity (Agent ID) and monitor operations from the Operate tab." },
  { num: "12", slug: "12-publishing-agents", type: "handson", minutes: 25, difficulty: "intermediate",
    title: "Publish an agent",
    summary: "Publish the agent to Microsoft 365 Copilot and Teams and verify a live conversation." },
  { num: "13", slug: "13-custom-engine-agent", type: "concept", minutes: 60, difficulty: "advanced", optional: true,
    title: "Custom Engine Agent",
    summary: "How to build an M365 Custom Engine Agent proxy in your own tenant. Optional extra credit, read-only overview." }
];

// Everything above is Lab 1; default it, then append the Lab 2 modules.
for (const m of MODULES) if (m.lab == null) m.lab = 1;
MODULES.push(
  { num: "01", slug: "lab2-01-workflow-overview", type: "concept", minutes: 15, difficulty: "intermediate", lab: 2,
    title: "Agent workflow concepts & architecture",
    summary: "Meet the commercial loan-underwriting scenario and see how sequential, group-chat, and human-in-the-loop orchestration combine into one Foundry workflow." },
  { num: "02", slug: "lab2-02-create-agents", type: "handson", minutes: 30, difficulty: "intermediate", lab: 2,
    title: "Create the eight committee agents",
    summary: "Deploy a chat model and create the eight prompt agents — intake, enrichment, the credit committee, briefing, and decision letter — with copy-ready instructions and schemas." },
  { num: "03", slug: "lab2-03-build-workflow", type: "handson", minutes: 25, difficulty: "advanced", lab: 2,
    title: "Assemble the multi-agent workflow",
    summary: "Paste the workflow YAML into the designer, wire the agents, and walk every node from intake through the human sign-off gate." },
  { num: "04", slug: "lab2-04-run-and-trace", type: "handson", minutes: 20, difficulty: "intermediate", lab: 2,
    title: "Run & trace the workflow",
    summary: "Run a clean auto-approval and a borderline human-in-the-loop deal, then confirm end-to-end traces in Application Insights." }
);

// ---- Labs: grouping metadata for the sidebar + landing page -----------
const LABS = [
  { lab: 1, title: "Lab 1 — Prompt Agent with Foundry", navTitle: "Lab 1 · Prompt Agent",
    blurb: "Build, tool, ground, evaluate, and publish a single prompt agent — entirely in the Foundry portal." },
  { lab: 2, title: "Lab 2 — Multi-agent with Agent Workflow", navTitle: "Lab 2 · Agent Workflow",
    blurb: "Compose eight agents into one governed workflow that combines sequential, group-chat, and human-in-the-loop orchestration." }
];
const labModules = (lab) => MODULES.filter((m) => m.lab === lab);
const labOf = (lab) => LABS.find((l) => l.lab === lab) || LABS[0];

// Faithful hands-on modules get a light "adapted for your subscription" banner.
const ADAPT_BANNER_SLUGS = new Set([
  "02-foundry-portal-walkthrough", "04-prompt-based-agents", "05-agent-tools-and-evaluations",
  "06-mcp-tools", "07-foundry-iq", "11-agent-ops-and-agent-id", "12-publishing-agents"
]);

// ---- Icons (inline SVG) ----------------------------------------------
const IC = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  level: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>',
  hands: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6a2 2 0 0 1 4 0v5"/><path d="M13 7a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-4l-1.5-3a1.5 1.5 0 0 1 2.7-1.3L9 15"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 21V12h6v9"/></svg>',
  sun: '<svg class="i-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="i-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.57.67.48A10 10 0 0 0 22 12 10 10 0 0 0 12 2Z"/></svg>',
  arrowL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
};

const CALLOUT_ICON = {
  note: '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  tip: '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/></svg>',
  important: '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7v10l10 5 10-5V7L12 2Z"/><path d="M12 8v4M12 16h.01"/></svg>',
  warning: '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
  caution: '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>'
};

// ---- Markdown-it ------------------------------------------------------
const md = new MarkdownIt({ html: true, linkify: true, typographer: false })
  .use(taskLists, { enabled: true, label: false });

function githubSlug(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")   // drop punctuation/emoji
    .replace(/\s/g, "-");        // spaces -> hyphens (no collapsing, GitHub-style)
}

function escAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ---- Preprocess raw markdown -----------------------------------------
function preprocess(body, mod) {
  // strip leading H1 + "Estimated time" line (faithful source files)
  const lines = body.split(/\r?\n/);
  while (lines.length && lines[0].trim() === "") lines.shift();
  if (lines.length && /^#\s+/.test(lines[0])) {
    lines.shift();
    while (lines.length && lines[0].trim() === "") lines.shift();
    if (lines.length && /^\*\*Estimated time:\*\*/i.test(lines[0])) lines.shift();
  }
  body = lines.join("\n");

  // image path rewrites (source -> local bundled assets)
  body = body
    .replace(/\.\.\/\.\.\/\.\.\/docs\/assets\/screenshots\/introduction-foundry-agent-service\//g, "../assets/img/screenshots/")
    .replace(/\.\.\/\.\.\/\.\.\/docs\/assets\/diagrams\//g, "../assets/img/diagrams/");

  // internal module links: ../NN-slug/README.md[#anchor] -> NN-slug.html[#anchor]
  body = body.replace(/\]\((?:\.\.\/)+(\d{2}-[a-z0-9-]+)\/README\.md(#[^)]*)?\)/g,
    (_m, slug, hash) => `](${slug}.html${hash || ""})`);
  // self / index links to the lab README
  body = body.replace(/\]\((?:\.\.\/)+README\.md(#[^)]*)?\)/g, "](../index.html)");
  // remaining docs/*.md links -> source repo
  body = body.replace(/\]\((?:\.\.\/)+docs\/([a-z0-9/-]+)\.md(#[^)]*)?\)/g,
    (_m, p, hash) => `](${SRC_REPO}/blob/main/docs/${p}.md${hash || ""})`);

  // light own-subscription substitutions (faithful modules only)
  if (mod.type === "handson" && mod.slug !== "01-setup") {
    body = body
      .replace(/sign in with your workshop account/gi, "sign in with your Azure account")
      .replace(/\byour assigned project\b/gi, "your project")
      .replace(/\byour organizer\b/gi, "your Azure administrator")
      .replace(/\byour proctor\b/gi, "your Azure administrator")
      .replace(/ask your proctor/gi, "check with your Azure administrator");
  }

  // GitHub alerts: > [!TYPE] ... consecutive blockquote lines -> callout div
  const out = [];
  const src = body.split(/\r?\n/);
  for (let i = 0; i < src.length; i++) {
    const m = src[i].match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i);
    if (m) {
      const type = m[1].toLowerCase();
      const inner = [];
      i++;
      while (i < src.length && /^>/.test(src[i])) {
        inner.push(src[i].replace(/^>\s?/, ""));
        i++;
      }
      i--; // step back; for-loop will ++ 
      const title = type.charAt(0).toUpperCase() + type.slice(1);
      out.push("");
      out.push(`<div class="callout ${type}">`);
      out.push(`<div class="callout-title">${CALLOUT_ICON[type]}${title}</div>`);
      out.push("");
      out.push(inner.join("\n").trim());
      out.push("");
      out.push("</div>");
      out.push("");
    } else {
      out.push(src[i]);
    }
  }
  body = out.join("\n");

  // inject adaptation banner near the top for faithful hands-on modules
  if (ADAPT_BANNER_SLUGS.has(mod.slug)) {
    const banner = [
      "",
      '<div class="callout note">',
      `<div class="callout-title">${CALLOUT_ICON.note}Adapted for your own subscription</div>`,
      "",
      "This module is delivered in the **Foundry portal**. Where the original steps mention a pre-provisioned shared environment, a `.env` file, an organizer, or a proctor, use **your own Foundry project** and the model you deployed in [Module 01](01-setup.html).",
      "",
      "</div>",
      ""
    ].join("\n");
    body = banner + "\n" + body;
  }
  return body;
}

// ---- Render body + collect TOC ---------------------------------------
function renderBody(body) {
  const tokens = md.parse(body, {});
  const toc = [];
  const seen = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "heading_open" && (t.tag === "h2" || t.tag === "h3")) {
      const inline = tokens[i + 1];
      const text = inline && inline.content ? inline.content.replace(/`/g, "") : "";
      let id = githubSlug(text);
      if (seen[id] != null) { seen[id]++; id = id + "-" + seen[id]; } else { seen[id] = 0; }
      t.attrSet("id", id);
      // trailing anchor link
      if (inline) {
        inline.children = inline.children || [];
        const a = new inline.constructor("link_open", "a", 1);
        a.attrSet("href", "#" + id); a.attrSet("class", "anchor"); a.attrSet("aria-hidden", "true");
        const txt = new inline.constructor("text", "", 0); txt.content = " #";
        const ac = new inline.constructor("link_close", "a", -1);
        inline.children.push(a, txt, ac);
      }
      toc.push({ level: t.tag, id, text });
    }
  }
  const html = md.renderer.render(tokens, md.options, {});
  return { html, toc };
}

// ---- Page chrome ------------------------------------------------------
function sidebarHtml(active) {
  let s = '<aside class="sidebar" id="sidebar">';
  s += '<h4>Workshop</h4>';
  s += `<a class="nav-item" href="../index.html"><span class="num">${IC.home}</span><span class="txt">Overview &amp; progress</span></a>`;
  for (const lab of LABS) {
    s += `<h4 data-lab="${lab.lab}">${escHtml(lab.navTitle)}</h4>`;
    for (const m of labModules(lab.lab)) {
      const act = m.slug === active ? " active" : "";
      s += `<a class="nav-item${act}" data-lab="${m.lab}" data-slug="${m.slug}" href="${m.slug}.html">` +
        `<span class="num">${m.num}</span>` +
        `<span class="txt">${escHtml(m.title)}</span>` +
        `<span class="type-dot ${m.type}" title="${m.type === "handson" ? "Hands-on lab" : "Concept overview"}"></span>` +
        `<span class="nav-check">${IC.check}</span>` +
        `</a>`;
    }
  }
  s += '</aside><div class="scrim"></div>';
  return s;
}

function headerHtml(mod) {
  const showProg = mod.type === "handson";
  const prog = showProg
    ? '<div class="header-progress"><span class="lbl">0 / 0 steps</span><div class="bar"><span></span></div></div>'
    : "";
  const srcUrl = `${SRC_BASE}/${mod.slug}/README.md`;
  const srcLink = mod.lab === 2 ? "" :
    `<a class="icon-btn" href="${srcUrl}" target="_blank" rel="noopener" title="View source module on GitHub">${IC.github}</a>`;
  return '<header class="site-header">' +
    `<button class="icon-btn menu-btn" aria-label="Toggle navigation">${IC.menu}</button>` +
    `<a class="brand" href="../index.html"><span class="brand-mark">F</span>` +
    `<span class="brand-text"><small>Portal-first workshop</small><strong>Foundry Agent Service</strong></span></a>` +
    prog +
    '<div class="header-actions">' +
    `<button class="icon-btn" data-action="theme" aria-label="Toggle dark mode">${IC.sun}${IC.moon}</button>` +
    srcLink +
    '</div></header>';
}

function tocHtml(toc) {
  if (!toc.length) return '<nav class="toc"></nav>';
  let s = '<nav class="toc"><div class="toc-title">On this page</div>';
  for (const h of toc) s += `<a class="${h.level === "h3" ? "h3" : "h2"}" href="#${h.id}">${escHtml(h.text)}</a>`;
  s += "</nav>";
  return s;
}

function metaRow(mod) {
  const typeLabel = mod.type === "handson"
    ? `<span class="chip">${IC.hands}Hands-on lab</span>`
    : `<span class="chip">${IC.book}Concept overview</span>`;
  const count = labModules(mod.lab).length;
  return '<div class="meta-row">' +
    `<span class="chip lab-chip">Lab ${mod.lab}</span>` +
    typeLabel +
    `<span class="chip">${IC.clock}${mod.minutes} min</span>` +
    `<span class="chip">${IC.level}${mod.difficulty.charAt(0).toUpperCase() + mod.difficulty.slice(1)}</span>` +
    `<span class="chip">${IC.stack}Module ${parseInt(mod.num, 10)} of ${count}</span>` +
    "</div>";
}

function pagerHtml(mod) {
  const sibs = labModules(mod.lab);
  const i = sibs.findIndex((m) => m.slug === mod.slug);
  const prev = i > 0 ? sibs[i - 1] : null;
  const next = i < sibs.length - 1 ? sibs[i + 1] : null;
  let s = '<div class="pager">';
  if (prev) s += `<a class="prev" href="${prev.slug}.html"><span class="dir">${IC.arrowL} Previous</span><span class="ttl">${escHtml(prev.num + ". " + prev.title)}</span></a>`;
  else s += '<span class="spacer"></span>';
  if (next) s += `<a class="next" href="${next.slug}.html"><span class="dir">Next ${IC.arrowR}</span><span class="ttl">${escHtml(next.num + ". " + next.title)}</span></a>`;
  else s += '<span class="spacer"></span>';
  s += "</div>";
  return s;
}

function badgeHtml(mod) {
  const b = mod.type === "handson"
    ? `<span class="mod-badge handson">${IC.hands} Hands-on lab</span>`
    : `<span class="mod-badge concept">${IC.book} Concept overview</span>`;
  const opt = mod.optional ? '<span class="mod-badge optional">Optional · extra credit</span>' : "";
  return `<div class="module-eyebrow">${b}${opt}</div>`;
}

function pageHtml(mod, idx, bodyHtml, toc) {
  const srcUrl = `${SRC_BASE}/${mod.slug}/README.md`;
  const lab = labOf(mod.lab);
  const footer = mod.lab === 2
    ? `Original content authored for this workshop. Screenshot frames are placeholders &mdash; capture your own from your Foundry portal as you go.`
    : `Adapted for portal-first delivery from the open-source
<a href="${srcUrl}" target="_blank" rel="noopener">Microsoft Foundry Agentic Workshop</a>
(MIT-licensed). Screenshots reflect the shared-environment New Foundry UI and may differ from your tenant.`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(mod.num + ". " + mod.title)} · Foundry Agent Service Workshop</title>
<meta name="description" content="${escAttr(mod.summary)}">
<link rel="preconnect" href="https://ai.azure.com">
<link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-page="module" data-slug="${mod.slug}">
${headerHtml(mod)}
<div class="layout">
${sidebarHtml(mod.slug)}
<main class="main"><div class="content-wrap">
<article class="content">
<div class="breadcrumb"><a href="../index.html">Workshop</a> &nbsp;/&nbsp; ${escHtml(lab.navTitle)} &nbsp;/&nbsp; Module ${parseInt(mod.num, 10)}</div>
${badgeHtml(mod)}
<h1>${escHtml(mod.title)}</h1>
${metaRow(mod)}
${bodyHtml}
${pagerHtml(mod)}
<div class="page-footer">
${footer}
</div>
</article>
${tocHtml(toc)}
</div></main>
</div>
<script src="../assets/js/flags.js"></script>
<script src="../assets/js/modules-data.js"></script>
<script src="../assets/js/app.js"></script>
</body>
</html>`;
}

// ---- Build ------------------------------------------------------------
function countTasks(body) {
  const m = body.match(/^\s*[-*]\s+\[[ xX]\]/gm);
  return m ? m.length : 0;
}

function build() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const dataOut = [];
  let built = 0;
  for (let idx = 0; idx < MODULES.length; idx++) {
    const mod = MODULES[idx];
    const file = path.join(CONTENT, mod.slug + ".md");
    if (!fs.existsSync(file)) { console.warn("  ! missing content:", mod.slug + ".md — skipped"); 
      dataOut.push({ num: mod.num, slug: mod.slug, title: mod.title, type: mod.type, minutes: mod.minutes, difficulty: mod.difficulty, taskCount: 0, summary: mod.summary, optional: !!mod.optional, lab: mod.lab });
      continue; }
    const raw = fs.readFileSync(file, "utf8");
    const parsed = matter(raw);
    const pre = preprocess(parsed.content, mod);
    const taskCount = mod.type === "handson" ? countTasks(pre) : 0;
    const { html, toc } = renderBody(pre);
    fs.writeFileSync(path.join(OUT, mod.slug + ".html"), pageHtml(mod, idx, html, toc), "utf8");
    dataOut.push({ num: mod.num, slug: mod.slug, title: mod.title, type: mod.type, minutes: mod.minutes, difficulty: mod.difficulty, taskCount, summary: mod.summary, optional: !!mod.optional, lab: mod.lab });
    built++;
    console.log(`  \u2713 ${mod.slug}.html  (${taskCount} steps)`);
  }
  if (!fs.existsSync(JS)) fs.mkdirSync(JS, { recursive: true });
  fs.writeFileSync(path.join(JS, "modules-data.js"),
    "window.WORKSHOP_MODULES = " + JSON.stringify(dataOut, null, 2) + ";\n" +
    "window.WORKSHOP_LABS = " + JSON.stringify(LABS, null, 2) + ";\n", "utf8");
  console.log(`\nBuilt ${built}/${MODULES.length} module pages + modules-data.js`);
}

build();
