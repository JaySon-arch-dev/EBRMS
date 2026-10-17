/* =========================================================
   EBRMS — PROFILE (shared by every role)
   File: shared-view/profile/script.js

   Shows only the signed-in user's own details.
   Each value comes from, in this order:
     1. the user's row in PROFILE_SOURCE.table (full_name, user_id, ...)
     2. the user's Supabase metadata
     3. their Supabase account (email, created_at)
     4. the role detected by view.js (for "role")
   Anything missing stays as a dash.
   ========================================================= */

(() => {
  // The table that holds full_name and user_id. Change "users" to your
  // real table name if it is different.
  // matchColumns: the columns tried, in order, to find the signed-in
  // user's own row ("id" = the Supabase auth user id).
  const PROFILE_SOURCE = {
    table: "users",
    matchColumns: ["id", "email"]
  };

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
    const { client, user: userReady } = window.EBRMS;
    const user = await userReady;

    if (!user) return;

    let row = null;

    if (PROFILE_SOURCE.table && client) {
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

        if (data) {
          row = data;
          break;
        }
      }
    }

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
