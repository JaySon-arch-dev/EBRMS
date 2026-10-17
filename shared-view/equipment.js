/* =========================================================
   EBRMS — EQUIPMENT LIST (shared by Student and Faculty)
   File: shared-view/equipment.js

   Loads public.equipment from Supabase and fills the dashboard list.
   Each row shows: photo, equipment name, quantity, available quantity,
   condition and an Available / Not available badge.

   Equipment is the same for everyone, so there is no per-user filter.
   Supabase RLS must allow signed-in users to SELECT from the table.
   ========================================================= */

(() => {
  // While setting up, show the database's own message on the page when
  // loading fails or returns no rows. Set to false once everything works.
  const SHOW_DETAILS = true;

  const EQUIPMENT_SOURCE = {
    table: "equipment",

    // Optional column with a link to the equipment photo (add it to the
    // table when photos are ready). Without it a placeholder icon is shown.
    photoColumn: "photo_url",

    // status values that always mean "not available", whatever the quantity.
    unavailableStatuses: [
      "unavailable", "not available", "maintenance",
      "under maintenance", "damaged", "disabled", "lost"
    ],

    // Turns one database record into one row on the page.
    toRow(record) {
      const status = String(record.status || "").trim().toLowerCase();
      const availableQty = Number(record.available_quantity);
      const available =
        availableQty > 0 && !this.unavailableStatuses.includes(status);

      return {
        title: record.eq_name,
        quantity: record.quantity,
        availableQuantity: record.available_quantity,
        condition: record.eq_condition,
        photo: record[this.photoColumn],
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

  // Small line under the message that shows the technical reason.
  const detail = document.createElement("p");
  detail.className = "item-meta";
  detail.hidden = true;
  message.after(detail);

  // Only normal web links or site paths are used as photo sources.
  function safePhotoUrl(value) {
    if (typeof value !== "string") return null;
    const url = value.trim();
    return /^(https:\/\/|\/(?!\/))/.test(url) ? url : null;
  }

  function show(value) {
    return value === undefined || value === null || value === ""
      ? "\u2014"
      : String(value);
  }

  // Rows are built with textContent so database text is never run as HTML.
  function buildRow(item) {
    const badge = BADGES[item.status] || BADGES.unavailable;

    const row = document.createElement("li");
    row.className = "item-row";
    row.dataset.status = BADGES[item.status] ? item.status : "unavailable";

    const photo = document.createElement("span");
    photo.className = "item-photo";
    photo.setAttribute("aria-hidden", "true");

    const url = safePhotoUrl(item.photo);
    const placeholder = () => {
      photo.replaceChildren();
      photo.classList.remove("has-image");
      photo.innerHTML = ICON;
    };

    if (url) {
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", placeholder);
      photo.classList.add("has-image");
      photo.append(image);
    } else {
      placeholder();
    }

    const copy = document.createElement("div");
    copy.className = "item-copy";

    const titleEl = document.createElement("span");
    titleEl.className = "item-title";
    titleEl.textContent = item.title || "Unnamed equipment";

    const stockEl = document.createElement("span");
    stockEl.className = "item-meta";
    stockEl.textContent =
      `Quantity: ${show(item.quantity)} \u00B7 Available: ${show(item.availableQuantity)}`;

    const conditionEl = document.createElement("span");
    conditionEl.className = "item-meta";
    conditionEl.textContent = `Condition: ${show(item.condition)}`;

    const badgeEl = document.createElement("span");
    badgeEl.className = "badge " + badge.tone;
    badgeEl.textContent = badge.label;

    copy.append(titleEl, stockEl, conditionEl);
    row.append(photo, copy, badgeEl);
    return row;
  }

  function showMessage(text, { retry = false, reason = "" } = {}) {
    message.textContent = text;
    retryButton.hidden = !retry;
    detail.textContent = reason;
    detail.hidden = !reason;
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
      .select("*");

    scroller.removeAttribute("aria-busy");

    if (error) {
      console.error("Could not load equipment:", error.message);
      showMessage(
        "We couldn't load the equipment. Please try again.",
        { retry: true, reason: SHOW_DETAILS ? error.message : "" }
      );
      refreshList();
      return;
    }

    // Sorted by name here in the page.
    const rows = data
      .map((record) => EQUIPMENT_SOURCE.toRow(record))
      .sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""))
      );

    list.replaceChildren(...rows.map(buildRow));

    showMessage(
      "No equipment to show.",
      {
        reason: SHOW_DETAILS && data.length === 0
          ? "The database returned 0 rows. If the table has equipment, add a SELECT policy for signed-in users."
          : ""
      }
    );
    refreshList();
  }

  retryButton.addEventListener("click", loadEquipment);

  loadEquipment();
})();
