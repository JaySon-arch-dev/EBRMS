/* =========================================================
   EBRMS — ADMIN: PROFILE
   File: admin/profile/script.js

   Shows only the signed-in admin's own details, read from
   the users table (full_name, user_id, ...) and their account.
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
