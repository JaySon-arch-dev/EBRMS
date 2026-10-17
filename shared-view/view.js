/* =========================================================
   EBRMS — SHARED DASHBOARD VIEW
   File: shared-view/view.js
   - Expanding menu on mobile (three-line button)
   - Back navigation
   - List filters (equipment, history)
   - Highlights the current page in the menu
   - One shared Supabase client + the signed-in user
     (window.EBRMS.client, .user, .getProfile())
   - Fills in the role name and Home link on shared pages
   ========================================================= */

(() => {
  const SUPABASE_URL =
    "https://lrlzlzfulcajbuqeufym.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

  const ROLES = {
    student: { label: "Student", home: "/student/" },
    faculty: { label: "Faculty", home: "/faculty/" },
    admin: { label: "Admin", home: "/admin/" }
  };

  // The table that holds the signed-in user's own details (full_name,
  // user_id, ...). matchColumns are tried in order to find their row:
  // "email" = the account's email, "id" = the Supabase auth user id
  // (only use "id" if users.id is the same uuid as the login account).
  const PROFILE_SOURCE = {
    table: "users",
    matchColumns: ["email"]
  };

  const STORE_KEY = "ebrms:view";
  const MOBILE_QUERY = window.matchMedia("(max-width: 899px)");

  const body = document.body;
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
  // Goes to the previous page, or to the user's own dashboard
  // (data-home on <body>) when there is no history to go back to.

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
        window.location.href = body.dataset.home || "/";
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

  /* ---------- List filter (equipment, history) ---------- */

  const list = document.getElementById("equipmentList") ||
    document.getElementById("itemList");
  const emptyMessage = document.getElementById("equipmentEmpty") ||
    document.getElementById("itemEmpty");
  const chips = document.querySelectorAll(".chip[data-filter]");

  let currentFilter = "all";

  function refreshList() {
    if (!list || !chips.length) return;

    const rows = Array.from(list.querySelectorAll(".item-row"));
    let shown = 0;

    rows.forEach((row) => {
      const visible =
        currentFilter === "all" || row.dataset.status === currentFilter;
      row.hidden = !visible;
      if (visible) shown += 1;
    });

    document.querySelectorAll("[data-count]").forEach((element) => {
      const key = element.dataset.count;
      element.textContent =
        key === "all"
          ? rows.length
          : rows.filter((row) => row.dataset.status === key).length;
    });

    chips.forEach((chip) => {
      chip.setAttribute(
        "aria-pressed",
        String(chip.dataset.filter === currentFilter)
      );
    });

    if (emptyMessage) emptyMessage.hidden = shown > 0;
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      currentFilter = chip.dataset.filter;
      refreshList();

      // Start from the top whenever the list changes.
      list.parentElement.scrollTop = 0;
    });
  });

  refreshList();

  /* ---------- Supabase client and the signed-in user ---------- */

  const client = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      })
    : null;

  // Role name, Home link and initial for the shared pages.
  // Uses the role on <body> when the page declares one (dashboards),
  // else the role stored in the user's Supabase metadata, else the one
  // remembered from this user's last dashboard visit.
  function applyIdentity(user) {
    const declared = (body.dataset.role || "").toLowerCase();
    let key = ROLES[declared] ? declared : null;

    if (!key && user) {
      const fromMeta = String(
        user.app_metadata?.role || user.user_metadata?.role || ""
      ).toLowerCase();

      if (ROLES[fromMeta]) {
        key = fromMeta;
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem(STORE_KEY));
          if (saved && saved.uid === user.id && ROLES[saved.role]) {
            key = saved.role;
          }
        } catch (error) {
          /* storage unavailable: leave the generic labels */
        }
      }
    }

    if (!key) return;

    // A dashboard remembers the role for the shared pages.
    if (user && ROLES[declared]) {
      try {
        localStorage.setItem(
          STORE_KEY,
          JSON.stringify({ uid: user.id, role: declared })
        );
      } catch (error) {
        /* storage unavailable: shared pages fall back to metadata */
      }
    }

    const role = ROLES[key];
    body.dataset.role = role.label;
    body.dataset.home = body.dataset.home || role.home;

    document.querySelectorAll("[data-role-label]").forEach((element) => {
      element.textContent = role.label;
    });

    document.querySelectorAll("[data-role-initial]").forEach((element) => {
      element.textContent = role.label.charAt(0);
    });

    document.querySelectorAll("[data-home-link]").forEach((element) => {
      element.setAttribute("href", role.home);
    });
  }

  // Resolves with the signed-in user (or null). Visitors without a session
  // are sent to /login/. This is a convenience only: real protection stays
  // on the server and in Supabase RLS. Add data-require-session="false"
  // to <body> to skip the redirect on a page.
  const userReady = (async () => {
    if (!client) return null;

    try {
      const { data } = await client.auth.getSession();
      const session = data?.session;

      if (!session) {
        if (body.dataset.requireSession !== "false") {
          window.location.replace("/login/");
        }
        return null;
      }

      applyIdentity(session.user);
      return session.user;
    } catch (error) {
      console.error("Session check failed:", error);
      return null;
    }
  })();

  // The signed-in user's own row from PROFILE_SOURCE.table, or null.
  // Looked up once and shared by every script on the page.
  let profileLookup = null;

  function getProfile() {
    if (!profileLookup) {
      profileLookup = (async () => {
        const user = await userReady;
        if (!user || !client || !PROFILE_SOURCE.table) return null;

        // These filters are a convenience. Supabase RLS must be the rule
        // that really limits each user to their own row.
        for (const column of PROFILE_SOURCE.matchColumns) {
          const match = column === "email" ? user.email : user.id;
          if (!match) continue;

          const { data, error } = await client
            .from(PROFILE_SOURCE.table)
            .select("*")
            .eq(column, match)
            .maybeSingle();

          if (error) {
            console.error(
              `Profile lookup by "${column}" failed:`,
              error.message
            );
            continue;
          }

          if (data) return data;
        }

        return null;
      })();
    }

    return profileLookup;
  }

  window.EBRMS = { client, user: userReady, refreshList, getProfile };
})();
