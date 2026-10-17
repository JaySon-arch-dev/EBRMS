/* =========================================================
   EBRMS — EQUIPMENT LIST (shared by Student and Faculty)
   File: shared-view/equipment.js

   Loads the equipment from Supabase and fills the dashboard list.
   Equipment is the same for everyone, so there is no per-user
   filter. Supabase RLS must allow signed-in users to read it.
   ========================================================= */

(() => {
  // Change these to match your equipment table.
  const EQUIPMENT_SOURCE = {
    table: "equipment",
    orderColumn: "name",

    // Turns one database record into one row on the page.
    // status must be "available" or "unavailable".
    toRow(record) {
      const available =
        typeof record.is_available === "boolean"
          ? record.is_available
          : String(record.status || "").toLowerCase() === "available";

      return {
        title: record.name,
        meta: record.category,
        status: available ? "available" : "unavailable"
      };
    }
  };

  const BADGES = {
    available: { label: "Available", tone: "is-success" },
    unavailable: { label: "Not available", tone: "is-danger" }
  };

  const ICON =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4Z M4 8v8l8 4 8-4V8" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

  const list = document.getElementById("equipmentList");
  const scroller = list.parentElement;
  const message = document.getElementById("equipmentEmptyText");
  const retryButton = document.getElementById("equipmentRetry");

  // Rows are built with textContent so database text is never run as HTML.
  function buildRow({ title, meta, status }) {
    const badge = BADGES[status] || BADGES.unavailable;

    const row = document.createElement("li");
    row.className = "item-row";
    row.dataset.status = BADGES[status] ? status : "unavailable";

    const icon = document.createElement("span");
    icon.className = "item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ICON;

    const copy = document.createElement("div");
    copy.className = "item-copy";

    const titleEl = document.createElement("span");
    titleEl.className = "item-title";
    titleEl.textContent = title || "Unnamed equipment";

    const metaEl = document.createElement("span");
    metaEl.className = "item-meta";
    metaEl.textContent = meta || "";

    const badgeEl = document.createElement("span");
    badgeEl.className = "badge " + badge.tone;
    badgeEl.textContent = badge.label;

    copy.append(titleEl, metaEl);
    row.append(icon, copy, badgeEl);
    return row;
  }

  function showMessage(text, { retry = false } = {}) {
    message.textContent = text;
    retryButton.hidden = !retry;
  }

  async function loadEquipment() {
    const { client, user: userReady, refreshList } = window.EBRMS;

    scroller.setAttribute("aria-busy", "true");
    list.replaceChildren();
    showMessage("Loading equipment\u2026");
    refreshList();

    const user = await userReady;

    if (!client || !user) {
      scroller.removeAttribute("aria-busy");
      showMessage("Sign in to see the equipment.");
      return;
    }

    const { data, error } = await client
      .from(EQUIPMENT_SOURCE.table)
      .select("*")
      .order(EQUIPMENT_SOURCE.orderColumn, { ascending: true });

    scroller.removeAttribute("aria-busy");

    if (error) {
      console.error("Could not load equipment:", error.message);
      showMessage(
        "We couldn't load the equipment. Please try again.",
        { retry: true }
      );
      refreshList();
      return;
    }

    list.replaceChildren(
      ...data.map((record) => buildRow(EQUIPMENT_SOURCE.toRow(record)))
    );

    showMessage("No equipment to show.");
    refreshList();
  }

  retryButton.addEventListener("click", loadEquipment);

  loadEquipment();
})();
