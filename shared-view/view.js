/* =========================================================
   EBRMS — SHARED DASHBOARD VIEW
   File: shared-view/view.js
   - Mobile slide-in menu (open, close, focus handling)
   - Highlights the current page in the menu
   - Shows today's date
   - Sends visitors without a session back to /login/
   ========================================================= */

(() => {
  const SUPABASE_URL =
    "https://lrlzlzfulcajbuqeufym.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

  const MOBILE_QUERY = window.matchMedia("(max-width: 899px)");

  const body = document.body;
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuToggle = document.getElementById("menuToggle");
  const sidebarClose = document.getElementById("sidebarClose");

  /* ---------- Menu: open and close ---------- */

  function isOpen() {
    return sidebar.classList.contains("is-open");
  }

  function setMenu(open, { restoreFocus = true } = {}) {
    const wasOpen = isOpen();
    if (open === wasOpen) return;

    sidebar.classList.toggle("is-open", open);
    overlay.classList.toggle("is-visible", open);
    body.classList.toggle("nav-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));

    if (open) {
      sidebarClose.focus();
    } else if (restoreFocus) {
      menuToggle.focus();
    }
  }

  menuToggle.addEventListener("click", () => setMenu(!isOpen()));
  sidebarClose.addEventListener("click", () => setMenu(false));
  overlay.addEventListener("click", () => setMenu(false));

  // Close after choosing a menu item (mobile only).
  sidebar.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (MOBILE_QUERY.matches) setMenu(false, { restoreFocus: false });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;

    if (event.key === "Escape") {
      setMenu(false);
      return;
    }

    // Keep Tab inside the menu while it covers the page.
    if (event.key === "Tab") {
      const focusable = sidebar.querySelectorAll("a[href], button");
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

  // Leaving mobile size resets the menu so desktop is never stuck "open".
  MOBILE_QUERY.addEventListener("change", (event) => {
    if (!event.matches) setMenu(false, { restoreFocus: false });
  });

  /* ---------- Current page in the menu ---------- */

  const currentPage = body.dataset.page;

  if (currentPage) {
    sidebar.querySelectorAll(".nav-link").forEach((link) => {
      if (link.dataset.nav === currentPage) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  /* ---------- Today's date ---------- */

  document.querySelectorAll("[data-today]").forEach((element) => {
    element.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  });

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
