/* =====================================================================
   Foundry Agentic Workshop — local feature flags.
   Loaded before modules-data.js + app.js on every page.

   lab2:  controls whether Lab 2 is visible in the workshop.
          Default is ON now that Labs 1–3 have all shipped. Flip it locally
          without editing this file via either:
            - Keyboard shortcut  Ctrl+Alt+2   (toggles + persists)
            - URL override       ?lab2=1  /  ?lab2=0
          The resolved value persists in localStorage ("fw:flag:lab2")
          and takes precedence over this default.
   ===================================================================== */
window.WORKSHOP_FLAGS = { lab2: true };
