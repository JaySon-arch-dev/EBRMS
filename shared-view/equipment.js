/* =========================================================
   EBRMS — EQUIPMENT LIST (shared by Student and Faculty)
   File: shared-view/equipment.js

   Loads public.equipment from Supabase and fills the dashboard list.
   Each row shows: photo on the left, then the equipment name, total
   quantity, available quantity, a status (Available = green,
   Damaged = red, Maintenance = grey) and a Borrow button below.

   Equipment is the same for everyone, so there is no per-user filter.
   Supabase RLS must allow signed-in users to SELECT from the table.
   ========================================================= */

(() => {
  // While setting up, show the database's own message on the page when
  // loading fails or returns no rows. Set to false once everything works.
  const SHOW_DETAILS = true;

  const EQUIPMENT_SOURCE = {
    table: "equipment",

    // Photos live in Supabase Storage. The table column holds the file
    // name inside the bucket (for example "images (3).jpeg"). A full
    // https:// link also works. Without a value, a placeholder icon shows.
    photoColumn: "photo_path",
    photoBucket: "equipment",     // <-- the exact name of your Storage bucket

    // Words (in the status or condition column) that decide the status shown.
    damagedWords: ["damag", "broken"],
    maintenanceWords: ["maint", "repair"],
    unavailableStatuses: ["unavailable", "not available", "disabled", "lost"],

    // Turns one database record into one row on the page.
    toRow(record) {
      const text =
        `${record.status || ""} ${record.eq_condition || ""}`.toLowerCase();
      const status = String(record.status || "").trim().toLowerCase();
      const availableQty = Number(record.available_quantity);
      const has = (words) => words.some((word) => text.includes(word));

      let label;
      let tone;
      let available = false;

      if (has(this.damagedWords)) {
        label = "Damaged";
        tone = "is-danger";
      } else if (has(this.maintenanceWords)) {
        label = "Maintenance";
        tone = "is-neutral";
      } else if (this.unavailableStatuses.includes(status)) {
        label = "Not available";
        tone = "is-neutral";
      } else if (availableQty > 0) {
        label = "Available";
        tone = "is-success";
        available = true;
      } else {
        label = "Fully borrowed";
        tone = "is-neutral";
      }

      return {
        id: record.eq_id,
        title: record.eq_name,
        total: record.quantity,
        availableQuantity: record.available_quantity,
        photo: record[this.photoColumn],
        label,
        tone,
        status: available ? "available" : "unavailable"
      };
    }
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

  // Turns the stored value into a photo link. Only https:// links are used.
  function safePhotoUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;

    let url = value.trim();

    if (!/^https:\/\//.test(url)) {
      const { client } = window.EBRMS;
      if (!client || !EQUIPMENT_SOURCE.photoBucket) return null;

      // The bucket must be public for this link to work.
      url = client.storage
        .from(EQUIPMENT_SOURCE.photoBucket)
        .getPublicUrl(url.replace(/^\/+/, "")).data.publicUrl;
    }

    return /^https:\/\//.test(url) ? url : null;
  }

  function show(value) {
    return value === undefined || value === null || value === ""
      ? "\u2014"
      : String(value);
  }

  // Rows are built with textContent so database text is never run as HTML.
  function buildRow(item) {
    const row = document.createElement("li");
    row.className = "item-row is-equipment";
    row.dataset.status = item.status;

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
    stockEl.append(`Total: ${show(item.total)} \u00B7 Available: `);

    const availableEl = document.createElement("strong");
    availableEl.textContent = show(item.availableQuantity);
    stockEl.append(availableEl);

    const statusEl = document.createElement("span");
    statusEl.className = "status-pill " + item.tone;
    statusEl.textContent = item.label;

    const borrowButton = document.createElement("button");
    borrowButton.type = "button";
    borrowButton.className = "borrow-button";
    borrowButton.textContent = "Borrow";
    borrowButton.disabled = item.status !== "available";

    // Borrowing is connected later. Listen for this event to start it.
    borrowButton.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("ebrms:borrow", {
          detail: { id: item.id, name: item.title }
        })
      );
    });

    copy.append(titleEl, stockEl, statusEl, borrowButton);
    row.append(photo, copy);
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
