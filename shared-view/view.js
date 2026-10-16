/* =========================================================
   EBRMS — SHARED DASHBOARD VIEW
   File: shared-view/view.js
   - Expanding menu on mobile (three-line button)
   - Back navigation
   - Equipment filter (All / Available / Not available)
   - Highlights the current page in the menu
   - Sends visitors without a session back to /login/
   ========================================================= */

(() => {
  const SUPABASE_URL =
    "https://lrlzlzfulcajbuqeufym.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

  const MOBILE_QUERY = window.matchMedia("(max-width: 899px)");

  const body = document.body;
  const HOME_URL = body.dataset.home || "/";
  const panel = document.getElementById("menuPanel");
  const scrim = document.getElementById("menuScrim");
  const toggle = document.getElementById("menuToggle");
  const menuBack = document.getElementById("menuBack");

  /* ---------- Menu: expand and collapse (mobile) ---------- */

  function isOpen() {
    return panel.classList.contains("is-open");
  }

  function setMenu(open, { restoreFocus = true } = {}) {
    if (open === isOpen()) return;

    panel.classList.toggle("is-open", open);
    scrim.classList.toggle("is-visible", open);
    body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");

    if (open) {
      menuBack.focus();
    } else if (restoreFocus) {
      toggle.focus();
    }
  }

  toggle.addEventListener("click", () => setMenu(!isOpen()));
  menuBack.addEventListener("click", () => setMenu(false));
  scrim.addEventListener("click", () => setMenu(false));

  panel.querySelectorAll(".menu-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (MOBILE_QUERY.matches) setMenu(false, { restoreFocus: false });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen() || !MOBILE_QUERY.matches) return;

    if (event.key === "Escape") {
      setMenu(false);
      return;
    }

    // Keep Tab inside the open menu.
    if (event.key === "Tab") {
      const focusable = [
        toggle,
        ...panel.querySelectorAll("a[href], button")
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // Growing to desktop size shows the menu box normally.
  MOBILE_QUERY.addEventListener("change", (event) => {
    if (!event.matches) setMenu(false, { restoreFocus: false });
  });

  /* ---------- Back navigation ---------- */
  // The page-level Back button appears on every page except the
  // dashboard. It goes to the previous page, or to the dashboard if
  // there is no history to go back to.

  const currentPage = body.dataset.page;

  document.querySelectorAll("[data-back]").forEach((button) => {
    button.hidden = currentPage === "dashboard";

    button.addEventListener("click", () => {
      const cameFromHere =
        document.referrer &&
        new URL(document.referrer).origin === window.location.origin;

      if (cameFromHere && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = HOME_URL;
      }
    });
  });

  /* ---------- Current page in the menu ---------- */

  if (currentPage) {
    panel.querySelectorAll(".menu-link").forEach((link) => {
      if (link.dataset.nav === currentPage) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  /* ---------- Equipment filter ---------- */

  const list = document.getElementById("equipmentList");
  const emptyMessage = document.getElementById("equipmentEmpty");
  const chips = document.querySelectorAll(".chip[data-filter]");

  if (list && chips.length) {
    const rows = Array.from(list.querySelectorAll(".item-row"));

    function updateCounts() {
      const counts = {
        all: rows.length,
        available: rows.filter((r) => r.dataset.status === "available").length,
        unavailable: rows.filter((r) => r.dataset.status === "unavailable").length
      };

      document.querySelectorAll("[data-count]").forEach((element) => {
        element.textContent = counts[element.dataset.count] ?? 0;
      });
    }

    function applyFilter(filter) {
      let shown = 0;

      rows.forEach((row) => {
        const visible = filter === "all" || row.dataset.status === filter;
        row.hidden = !visible;
        if (visible) shown += 1;
      });

      emptyMessage.hidden = shown > 0;

      chips.forEach((chip) => {
        chip.setAttribute("aria-pressed", String(chip.dataset.filter === filter));
      });

      // Start from the top whenever the list changes.
      list.parentElement.scrollTop = 0;
    }

    chips.forEach((chip) => {
      chip.addEventListener("click", () => applyFilter(chip.dataset.filter));
    });

    updateCounts();
    applyFilter("all");
  }

  /* ---------- Session check ---------- */
  // Convenience only: real protection must stay on the server / Supabase RLS.
  // Add data-require-session="false" to <body> to skip this on a page.

  async function requireSession() {
    if (!window.supabase || body.dataset.requireSession === "false") return;

    try {
      const client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        }
      );

      const { data } = await client.auth.getSession();

      if (!data?.session) {
        window.location.replace("/login/");
      }
    } catch (error) {
      console.error("Session check failed:", error);
    }
  }

  requireSession();
})();
