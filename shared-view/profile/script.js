/* =========================================================
   EBRMS — PROFILE (shared by every role)
   File: shared-view/profile/script.js

   Shows only the signed-in user's own details.
   Each value comes from, in this order:
     1. the user's row in the users table (full_name, user_id, ...);
      the table name is set in view.js (PROFILE_SOURCE)
     2. the user's Supabase metadata
     3. their Supabase account (email, created_at)
     4. the role detected by view.js (for "role")
   Anything missing stays as a dash.
   ========================================================= */

(() => {
  const DASH = "\u2014";

  function formatValue(field, value) {
    if (value === undefined || value === null || value === "") return DASH;

    if (field === "created_at") {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? DASH
        : date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
    }

    return String(value);
  }

  async function loadProfile() {
    const { user: userReady, getProfile } = window.EBRMS;
    const user = await userReady;

    if (!user) return;

    // The user's own row (full_name, user_id, ...) from view.js.
    const row = await getProfile();

    const values = {
      ...user.app_metadata,
      ...user.user_metadata,
      email: user.email,
      created_at: user.created_at,
      role: document.body.dataset.role,
      ...(row || {})
    };

    document.querySelectorAll("[data-field]").forEach((element) => {
      const field = element.dataset.field;
      element.textContent = formatValue(field, values[field]);
    });

    const name = values.full_name || values.name || values.user_id;

    if (name) {
      document.getElementById("profileName").textContent = String(name);
      document.getElementById("profileInitial").textContent =
        String(name).trim().charAt(0).toUpperCase() || "?";
    }
  }

  loadProfile();
})();
