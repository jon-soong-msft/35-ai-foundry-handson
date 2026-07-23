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
  var byslug = {};
  MODULES.forEach(function (m) { byslug[m.slug] = m; });

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

  function renderLanding() {
    var grid = document.getElementById("moduleGrid");
    if (!grid) return;
    var doneCount = 0, handsonTotal = 0, handsonDone = 0;
    var frag = "";
    MODULES.forEach(function (m) {
      var checked = parseInt(LS.getItem(K.progress(m.slug)) || "0", 10);
      var total = m.taskCount || 0;
      var pct = total ? Math.min(100, Math.round((checked / total) * 100)) : 0;
      var isDone = total > 0 && checked >= total;
      if (isDone) doneCount++;
      if (m.type === "handson") { handsonTotal++; if (isDone) handsonDone++; }
      var footBits = [];
      footBits.push('<span class="card-badge ' + m.type + '">' + (m.type === "handson" ? "Hands-on" : "Concept") + "</span>");
      footBits.push('<span>' + m.minutes + " min</span>");
      footBits.push('<span class="dot"></span>');
      footBits.push('<span>' + cap(m.difficulty) + "</span>");
      if (total) { footBits.push('<span class="dot"></span>'); footBits.push("<span>" + checked + "/" + total + " steps</span>"); }
      frag += '<a class="module-card' + (isDone ? " done" : "") + '" href="modules/' + m.slug + '.html">' +
        '<span class="card-progress" style="width:' + pct + '%"></span>' +
        '<span class="mini-check">' + CHECK_ICON + "</span>" +
        '<div class="top"><div class="mnum">' + m.num + "</div></div>" +
        "<h3>" + esc(m.title) + "</h3>" +
        "<p>" + esc(m.summary || "") + "</p>" +
        '<div class="foot">' + footBits.join("") + "</div>" +
        "</a>";
    });
    grid.innerHTML = frag;

    var overallPct = MODULES.length ? Math.round((doneCount / MODULES.length) * 100) : 0;
    var ring = document.getElementById("overallRing");
    if (ring) ring.innerHTML = circle(overallPct, 58);
    var ovBar = document.getElementById("overallBar");
    if (ovBar) ovBar.style.width = overallPct + "%";
    var ovLbl = document.getElementById("overallLbl");
    if (ovLbl) ovLbl.innerHTML = "<b>" + doneCount + " of " + MODULES.length + " modules complete</b> \u00b7 " +
      handsonDone + "/" + handsonTotal + " hands-on labs done";
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

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
    document.querySelectorAll("[data-action=theme]").forEach(function (b) {
      b.addEventListener("click", toggleTheme);
    });
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
