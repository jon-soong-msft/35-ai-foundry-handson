/* =====================================================================
   Foundry Agentic Workshop — client-side behaviour
   Theme, mobile nav, progress persistence, TOC scrollspy, copy buttons,
   and landing-page progress. Pure vanilla JS, no build step.
   ===================================================================== */
(function () {
  "use strict";
  var LS = window.localStorage;
  var K = {
    theme: "fw:theme",
    check: function (slug, i) { return "fw:check:" + slug + ":" + i; },
    progress: function (slug) { return "fw:progress:" + slug; }
  };
  var MODULES = window.WORKSHOP_MODULES || [];
  var LABS = window.WORKSHOP_LABS || [];
  var UPCOMING = window.WORKSHOP_UPCOMING || [];
  var byslug = {};
  MODULES.forEach(function (m) { byslug[m.slug] = m; });

  /* --------------------------------------------- Feature flag: Lab 2 */
  function lab2Enabled() {
    return true;
  }

  // Modules that survive the current flag state.
  function visibleModules() {
    if (lab2Enabled()) return MODULES;
    return MODULES.filter(function (m) { return (m.lab || 1) !== 2; });
  }

  // Hide/show any element tagged data-lab="2" (sidebar headings/items, hero bits).
  function applyLab2Dom() {
    var on = lab2Enabled();
    document.querySelectorAll('[data-lab="2"]').forEach(function (el) {
      el.style.display = on ? "" : "none";
    });
    updateHeroStats();
  }

  // Reflect the flag in the landing hero stats + intro wording.
  function updateHeroStats() {
    var mods = visibleModules();
    var labIds = {};
    mods.forEach(function (m) { labIds[m.lab || 1] = true; });
    var labCount = Object.keys(labIds).length;
    var handson = mods.filter(function (m) { return m.type === "handson"; }).length;
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set("heroLabs", labCount);
    set("heroModules", mods.length);
    set("heroHandson", handson);
    var word = document.getElementById("heroLabsWord");
    if (word) {
      var words = { 1: "one lab", 2: "two labs", 3: "three labs", 4: "four labs", 5: "five labs" };
      word.textContent = words[labCount] || (labCount + " labs");
    }
  }

  // If Lab 2 is off, keep its module pages unreachable by direct URL.
  function guardLab2Page() {
    if (lab2Enabled()) return;
    var slug = document.body.getAttribute("data-slug") || "";
    if (slug.indexOf("lab2-") === 0) {
      window.location.replace("../index.html");
    }
  }

  /* ---------------------------------------------------------- Theme */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
  }
  var savedTheme = LS.getItem(K.theme);
  if (savedTheme) applyTheme(savedTheme);
  else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) applyTheme("dark");

  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    var next = cur === "dark" ? "light" : "dark";
    applyTheme(next); LS.setItem(K.theme, next);
  }

  /* ------------------------------------------------------ Copy button */
  var COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var SOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>';

  function addCopyButtons() {
    document.querySelectorAll(".content pre").forEach(function (pre) {
      if (pre.querySelector(".copy-btn")) return;
      var btn = document.createElement("button");
      btn.className = "copy-btn"; btn.type = "button";
      btn.innerHTML = COPY_ICON + "<span>Copy</span>";
      btn.addEventListener("click", function () {
        var code = pre.querySelector("code");
        var text = code ? code.innerText : pre.innerText;
        navigator.clipboard.writeText(text.replace(/\n$/, "")).then(function () {
          btn.classList.add("copied");
          btn.innerHTML = CHECK_ICON + "<span>Copied</span>";
          setTimeout(function () {
            btn.classList.remove("copied");
            btn.innerHTML = COPY_ICON + "<span>Copy</span>";
          }, 1600);
        });
      });
      pre.appendChild(btn);
    });
  }

  /* --------------------------------------------------------- Toast */
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  /* ----------------------------------------------- Progress (module) */
  function moduleDone(slug) {
    var m = byslug[slug];
    var total = m ? m.taskCount : 0;
    if (!total) return false;
    return parseInt(LS.getItem(K.progress(slug)) || "0", 10) >= total;
  }

  function paintSidebar(currentSlug, currentCount, currentTotal) {
    document.querySelectorAll(".nav-item[data-slug]").forEach(function (a) {
      var slug = a.getAttribute("data-slug");
      var done;
      if (slug === currentSlug && currentTotal != null) done = currentTotal > 0 && currentCount >= currentTotal;
      else done = moduleDone(slug);
      a.classList.toggle("done", !!done);
    });
  }

  function setHeaderProgress(count, total) {
    var bar = document.querySelector(".header-progress .bar > span");
    var lbl = document.querySelector(".header-progress .lbl");
    if (!bar || !total) return;
    var pct = Math.round((count / total) * 100);
    bar.style.width = pct + "%";
    if (lbl) lbl.textContent = count + " / " + total + " steps";
  }

  function initModuleProgress() {
    var slug = document.body.getAttribute("data-slug");
    if (!slug) return;
    var boxes = Array.prototype.slice.call(
      document.querySelectorAll(".content li.task-list-item > input[type=checkbox]")
    );
    var total = boxes.length;
    var headerWrap = document.querySelector(".header-progress");
    if (headerWrap && !total) headerWrap.style.display = "none";

    function recount() {
      var c = 0;
      boxes.forEach(function (b) { if (b.checked) c++; });
      LS.setItem(K.progress(slug), String(c));
      setHeaderProgress(c, total);
      paintSidebar(slug, c, total);
      return c;
    }

    boxes.forEach(function (box, i) {
      box.disabled = false;
      var li = box.closest("li.task-list-item");
      if (LS.getItem(K.check(slug, i)) === "1") { box.checked = true; li.classList.add("checked"); }
      box.addEventListener("change", function () {
        if (box.checked) LS.setItem(K.check(slug, i), "1");
        else LS.removeItem(K.check(slug, i));
        li.classList.toggle("checked", box.checked);
        var c = recount();
        if (total && c === total) toast("Module complete \u2014 nice work! \uD83C\uDF89");
      });
    });
    recount();
  }

  /* ---------------------------------------------------- TOC scrollspy */
  function initToc() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
    if (!links.length) return;
    var map = {};
    var targets = [];
    links.forEach(function (a) {
      var id = decodeURIComponent(a.getAttribute("href").slice(1));
      var el = document.getElementById(id);
      if (el) { map[id] = a; targets.push(el); }
    });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove("active"); });
          var a = map[e.target.id];
          if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-80px 0px -70% 0px", threshold: 0 });
    targets.forEach(function (t) { obs.observe(t); });
  }

  /* --------------------------------------------------- Mobile nav */
  function initNav() {
    var btn = document.querySelector(".menu-btn");
    var scrim = document.querySelector(".scrim");
    if (btn) btn.addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
    if (scrim) scrim.addEventListener("click", function () { document.body.classList.remove("nav-open"); });
    document.querySelectorAll(".sidebar .nav-item").forEach(function (a) {
      a.addEventListener("click", function () { document.body.classList.remove("nav-open"); });
    });
  }

  /* --------------------------------------------- Landing page render */
  function circle(pct, size) {
    size = size || 54;
    var r = (size - 8) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="6"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--accent-handson)" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '<text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-size="' + (size * 0.26) + '" font-weight="700" fill="var(--text)">' + pct + '%</text></svg>';
  }

  function cardHtml(m) {
    var checked = parseInt(LS.getItem(K.progress(m.slug)) || "0", 10);
    var total = m.taskCount || 0;
    var pct = total ? Math.min(100, Math.round((checked / total) * 100)) : 0;
    var isDone = total > 0 && checked >= total;
    var footBits = [];
    footBits.push('<span class="card-badge ' + m.type + '">' + (m.type === "handson" ? "Hands-on" : "Concept") + "</span>");
    footBits.push('<span>' + m.minutes + " min</span>");
    footBits.push('<span class="dot"></span>');
    footBits.push('<span>' + cap(m.difficulty) + "</span>");
    if (total) { footBits.push('<span class="dot"></span>'); footBits.push("<span>" + checked + "/" + total + " steps</span>"); }
    return '<a class="module-card' + (isDone ? " done" : "") + '" href="modules/' + m.slug + '.html">' +
      '<span class="card-progress" style="width:' + pct + '%"></span>' +
      '<span class="mini-check">' + CHECK_ICON + "</span>" +
      '<div class="top"><div class="mnum">' + m.num + "</div></div>" +
      "<h3>" + esc(m.title) + "</h3>" +
      "<p>" + esc(m.summary || "") + "</p>" +
      '<div class="foot">' + footBits.join("") + "</div>" +
      "</a>";
  }

  function renderLanding() {
    var host = document.getElementById("labSections");
    var grid = document.getElementById("moduleGrid");
    if (!host && !grid) return;

    var shownModules = visibleModules();
    var doneCount = 0, handsonTotal = 0, handsonDone = 0;
    shownModules.forEach(function (m) {
      var checked = parseInt(LS.getItem(K.progress(m.slug)) || "0", 10);
      var total = m.taskCount || 0;
      var isDone = total > 0 && checked >= total;
      if (isDone) doneCount++;
      if (m.type === "handson") { handsonTotal++; if (isDone) handsonDone++; }
    });

    if (host) {
      var labs = LABS.length ? LABS : [{ lab: 1, title: "Modules", blurb: "" }];
      var lab2On = lab2Enabled();
      var out = "";
      labs.forEach(function (lab) {
        if (lab.lab === 2 && !lab2On) return;
        var mods = MODULES.filter(function (m) { return (m.lab || 1) === lab.lab; });
        if (!mods.length) return;
        var lDone = 0, lHandsonTotal = 0, lHandsonDone = 0, cards = "";
        mods.forEach(function (m) {
          var checked = parseInt(LS.getItem(K.progress(m.slug)) || "0", 10);
          var total = m.taskCount || 0;
          var isDone = total > 0 && checked >= total;
          if (isDone) lDone++;
          if (m.type === "handson") { lHandsonTotal++; if (isDone) lHandsonDone++; }
          cards += cardHtml(m);
        });
        var lPct = mods.length ? Math.round((lDone / mods.length) * 100) : 0;
        out += '<section class="lab-section" id="lab-' + lab.lab + '">' +
          '<div class="lab-head">' +
            '<div class="lab-ring">' + circle(lPct, 52) + '</div>' +
            '<div class="lab-meta"><h2>' + esc(lab.title) + '</h2>' +
              '<p>' + esc(lab.blurb || "") + '</p>' +
              '<span class="lab-progress">' + lDone + ' of ' + mods.length + ' modules \u00b7 ' + lHandsonDone + '/' + lHandsonTotal + ' hands-on</span>' +
            '</div>' +
          '</div>' +
          '<div class="module-grid">' + cards + '</div>' +
        '</section>';
      });
      host.innerHTML = out;
    } else {
      var frag = "";
      MODULES.forEach(function (m) { frag += cardHtml(m); });
      grid.innerHTML = frag;
    }

    // Agent journey stepper — all five labs, available first then upcoming.
    var journeyHost = document.getElementById("journeyPath");
    if (journeyHost) {
      var visLab = {};
      shownModules.forEach(function (m) { visLab[m.lab || 1] = true; });
      var steps = "";
      LABS.forEach(function (l) {
        if (!visLab[l.lab]) return;
        steps += '<a class="jstep available" href="#lab-' + l.lab + '">' +
          '<span class="jtop"><span class="jnum">' + l.lab + '</span>' +
            '<span class="jpill ok">Ready</span></span>' +
          '<span class="jbody"><b>' + esc(labTitleShort(l)) + '</b>' +
            '<span>' + esc(l.theme || "") + '</span></span></a>';
      });
      UPCOMING.forEach(function (l) {
        steps += '<a class="jstep upcoming" href="#lab-' + l.lab + '">' +
          '<span class="jtop"><span class="jnum">' + l.lab + '</span>' +
            '<span class="jpill soon">Soon</span></span>' +
          '<span class="jbody"><b>' + esc(labTitleShort(l)) + '</b>' +
            '<span>' + esc(l.theme || "") + '</span></span></a>';
      });
      journeyHost.innerHTML =
        '<div class="journey-head"><h2>Your agent journey</h2>' +
        '<p>Five labs take you from a single portal agent to production AgentOps. ' +
        'Labs 1&ndash;3 are ready to run now; Labs 4&ndash;5 are in development.</p></div>' +
        '<div class="journey-track">' + steps + '</div>';
    }

    // Roadmap — upcoming labs rendered as read-only "coming soon" previews.
    var roadHost = document.getElementById("roadmapSections");
    if (roadHost) {
      var road = "";
      UPCOMING.forEach(function (l) {
        var topics = (l.topics || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
        road += '<section class="lab-section upcoming" id="lab-' + l.lab + '">' +
          '<div class="lab-head">' +
            '<div class="lab-ring soon-ring">' + SOON_ICON + '</div>' +
            '<div class="lab-meta"><h2>' + esc(l.title) +
              ' <span class="soon-badge">In development</span></h2>' +
              '<p>' + esc(l.blurb || "") + '</p>' +
              '<span class="lab-progress">Stage ' + esc(String(l.stage || "")) +
                ' \u00b7 ' + esc(l.theme || "") + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="soon-card"><div class="soon-card-h">Planned modules</div>' +
          '<ul class="soon-topics">' + topics + '</ul></div>' +
        '</section>';
      });
      roadHost.innerHTML = road;
    }

    var overallPct = shownModules.length ? Math.round((doneCount / shownModules.length) * 100) : 0;
    var ring = document.getElementById("overallRing");
    if (ring) ring.innerHTML = circle(overallPct, 58);
    var ovBar = document.getElementById("overallBar");
    if (ovBar) ovBar.style.width = overallPct + "%";
    var ovLbl = document.getElementById("overallLbl");
    if (ovLbl) ovLbl.innerHTML = "<b>" + doneCount + " of " + shownModules.length + " modules complete</b> \u00b7 " +
      handsonDone + "/" + handsonTotal + " hands-on labs done";
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  // "Lab 3 · Agent Framework" -> "Agent Framework" (falls back to full title).
  function labTitleShort(l) {
    var s = l.navTitle || l.title || ("Lab " + l.lab);
    var i = s.indexOf("\u00b7");
    return i >= 0 ? s.slice(i + 1).trim() : s;
  }

  function initReset() {
    var btn = document.getElementById("resetProgress");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!window.confirm("Reset all workshop progress on this device?")) return;
      var rm = [];
      for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (k && k.indexOf("fw:check:") === 0 || k && k.indexOf("fw:progress:") === 0) rm.push(k); }
      rm.forEach(function (k) { LS.removeItem(k); });
      renderLanding(); toast("Progress reset");
    });
  }

  /* ----------------------------------------------------------- Boot */
  function boot() {
    guardLab2Page();
    document.querySelectorAll("[data-action=theme]").forEach(function (b) {
      b.addEventListener("click", toggleTheme);
    });
    applyLab2Dom();
    addCopyButtons();
    initNav();
    initModuleProgress();
    initToc();
    renderLanding();
    initReset();
    // keep sidebar done-state fresh on module pages even before interaction
    if (document.body.getAttribute("data-page") === "module") paintSidebar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
