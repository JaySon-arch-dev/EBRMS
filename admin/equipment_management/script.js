/* =========================================================
   EBRMS — ADMIN: EQUIPMENT MANAGEMENT
   File: admin/equipment_management/script.js

   Lists all equipment and lets the admin add equipment or edit
   the name, photo, status, condition and quantities.

   Needs Supabase RLS that lets admins SELECT, INSERT and UPDATE
   public.equipment, and upload to the photo bucket in Storage.
   ========================================================= */

(() => {
  const { config, el, photoUrl, dialog } = window.ADMIN;

  const STATUS_OPTIONS = ["Available", "Maintenance", "Damaged"];
  const CONDITION_OPTIONS = ["Good", "Fair", "Poor"];
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

  const ICON = window.ADMIN.icons.box;

  const list = document.getElementById("itemList");
  const scroller = list.parentElement;
  const message = document.getElementById("itemEmpty");
  const searchInput = document.getElementById("searchInput");
  const addButton = document.getElementById("addButton");

  let records = [];

  function showMessage(text, reason = "") {
    message.textContent = text;

    if (reason && config.showDetails) {
      const detail = el("span", "item-meta", reason);
      detail.style.display = "block";
      message.append(detail);
    }
  }

  /* ---------- Status shown for an item (same rule as the dashboards) ---------- */

  function statusOf(record) {
    const text = `${record.status || ""} ${record.eq_condition || ""}`.toLowerCase();
    const available = Number(record.available_quantity);

    if (/damag|broken/.test(text)) return { label: "Damaged", tone: "is-danger" };
    if (/maint|repair/.test(text)) return { label: "Maintenance", tone: "is-neutral" };
    if (available > 0) return { label: "Available", tone: "is-success" };
    return { label: "Fully borrowed", tone: "is-neutral" };
  }

  /* ---------- Rows ---------- */

  function dash(value) {
    return value === undefined || value === null || value === "" ? "\u2014" : String(value);
  }

  function buildRow(record) {
    const look = statusOf(record);

    const row = el("li", "item-row is-equipment");
    row.dataset.search = `${record.eq_name || ""} ${record.eq_id || ""}`.toLowerCase();

    const photo = el("span", "item-photo");
    photo.setAttribute("aria-hidden", "true");

    const url = photoUrl(record.photo_path);
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

    const copy = el("div", "item-copy");
    copy.append(el("span", "item-title", record.eq_name || "Unnamed equipment"));
    copy.append(el("span", "item-meta", `ID: ${dash(record.eq_id)}`));

    const stock = el("span", "item-meta");
    stock.append(`Total: ${dash(record.quantity)} \u00B7 Available: `);
    stock.append(el("strong", "", dash(record.available_quantity)));
    copy.append(stock);

    copy.append(el("span", "item-meta", `Condition: ${dash(record.eq_condition)}`));
    copy.append(el("span", "status-pill " + look.tone, look.label));

    const edit = el("button", "edit-button", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openForm(record));

    const remove = el("button", "reject-button", "Delete");
    remove.type = "button";
    remove.addEventListener("click", () => askDelete(record));

    const actions = el("div", "action-row");
    actions.append(edit, remove);
    copy.append(actions);

    row.append(photo, copy);
    return row;
  }

  function applySearch() {
    const term = searchInput.value.trim().toLowerCase();
    let shown = 0;

    list.querySelectorAll(".item-row").forEach((row) => {
      const match = !term || row.dataset.search.includes(term);
      row.hidden = !match;
      if (match) shown += 1;
    });

    if (shown > 0) {
      message.hidden = true;
    } else {
      showMessage(
        records.length ? "No equipment matches your search." : "No equipment yet. Use Add to create the first one."
      );
      message.hidden = false;
    }
  }

  /* ---------- Loading ---------- */

  async function load() {
    const { client, user: userReady } = window.EBRMS;
    const keepScroll = scroller.scrollTop;

    scroller.setAttribute("aria-busy", "true");
    message.hidden = false;
    showMessage("Loading equipment\u2026");

    const user = await userReady;

    if (!client || !user) {
      scroller.removeAttribute("aria-busy");
      showMessage("Sign in to manage equipment.");
      return;
    }

    const { data, error } = await client.from("equipment").select("*");

    scroller.removeAttribute("aria-busy");

    if (error) {
      console.error("Could not load equipment:", error.message);
      list.replaceChildren();
      showMessage("We couldn't load the equipment. Please try again.", error.message);
      return;
    }

    records = data
      .slice()
      .sort((a, b) => String(a.eq_name || "").localeCompare(String(b.eq_name || "")));

    list.replaceChildren(...records.map(buildRow));
    applySearch();
    scroller.scrollTop = keepScroll;
  }

  /* ---------- Add / edit form ---------- */

  function field(labelText, control, hint) {
    const wrapper = el("label", "form-field");
    wrapper.append(el("span", "form-label", labelText), control);
    if (hint) wrapper.append(el("span", "form-hint", hint));
    return wrapper;
  }

  function selectFrom(options, current) {
    const select = el("select", "form-control");
    const values = options.slice();

    if (current && !values.some((v) => v.toLowerCase() === String(current).toLowerCase())) {
      values.unshift(String(current));
    }

    values.forEach((value) => {
      const option = el("option", "", value);
      option.value = value;
      select.append(option);
    });

    const match = values.find((v) => v.toLowerCase() === String(current || "").toLowerCase());
    if (match) select.value = match;

    return select;
  }

  function numberInput(value) {
    const input = el("input", "form-control");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.inputMode = "numeric";
    input.value = value === undefined || value === null ? "" : String(value);
    return input;
  }

  function newEquipmentId() {
    return "EQ-" + String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  }

  function fileExtension(file) {
    const fromName = (file.name.split(".").pop() || "").toLowerCase();
    if (/^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
    return file.type === "image/png" ? "png" : "jpg";
  }

  function openForm(record) {
    const { client } = window.EBRMS;
    const isNew = !record;

    const form = el("form", "modal-card form-card");
    form.noValidate = true;

    const title = el("h2", "", isNew ? "Add equipment" : "Edit equipment");
    title.id = "modalTitle";

    // Fields
    const name = el("input", "form-control");
    name.type = "text";
    name.maxLength = 120;
    name.value = record?.eq_name || "";
    name.autocomplete = "off";

    const id = el("input", "form-control");
    id.type = "text";
    id.maxLength = 40;
    id.value = record?.eq_id || newEquipmentId();
    id.readOnly = !isNew;
    id.autocomplete = "off";

    // Photo
    const preview = el("span", "photo-preview");
    const setPreview = (url) => {
      preview.replaceChildren();

      if (url) {
        const image = document.createElement("img");
        image.src = url;
        image.alt = "";
        preview.append(image);
      } else {
        preview.innerHTML = ICON;
      }
    };
    setPreview(photoUrl(record?.photo_path));

    const file = el("input", "photo-input");
    file.type = "file";
    file.accept = "image/*";

    let objectUrl = null;
    file.addEventListener("change", () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = file.files[0] ? URL.createObjectURL(file.files[0]) : null;
      setPreview(objectUrl || photoUrl(record?.photo_path));
    });

    const photoRow = el("div", "photo-field");
    photoRow.append(preview, file);

    const status = selectFrom(STATUS_OPTIONS, record?.status || "Available");
    const condition = selectFrom(CONDITION_OPTIONS, record?.eq_condition || "Good");
    const quantity = numberInput(record?.quantity ?? 1);
    const available = numberInput(record?.available_quantity ?? record?.quantity ?? 1);

    const error = el("p", "form-error");
    error.hidden = true;
    error.setAttribute("role", "alert");

    const grid = el("div", "form-grid");
    grid.append(
      field("Status", status),
      field("Condition", condition),
      field("Total quantity", quantity),
      field("Available quantity", available)
    );

    const cancel = el("button", "modal-button", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      dialog.close();
    });

    const save = el("button", "modal-button is-primary", isNew ? "Add" : "Save");
    save.type = "submit";

    const actions = el("div", "modal-actions");
    actions.append(cancel, save);

    form.append(
      title,
      field("Equipment name", name),
      field(
        "Equipment ID",
        id,
        isNew ? "Used to identify the item. It can't be changed later." : ""
      ),
      field("Photo", photoRow, "Optional. JPG or PNG, up to 5 MB."),
      grid,
      error,
      actions
    );

    function fail(text, detail = "") {
      error.textContent = detail && config.showDetails ? `${text} (${detail})` : text;
      error.hidden = false;
      dialog.busy(false);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;

      const eqName = name.value.trim();
      const eqId = id.value.trim();
      const total = Number(quantity.value);
      const free = Number(available.value);
      const picked = file.files[0];

      if (!eqName) return fail("Please enter the equipment name.");
      if (!/^[A-Za-z0-9._-]{1,40}$/.test(eqId)) {
        return fail("The ID can only use letters, numbers, dots, dashes and underscores.");
      }
      if (!Number.isInteger(total) || total < 0) return fail("Total quantity must be 0 or more.");
      if (!Number.isInteger(free) || free < 0) return fail("Available quantity must be 0 or more.");
      if (free > total) return fail("Available quantity can't be more than the total.");

      if (picked) {
        if (!picked.type.startsWith("image/")) return fail("Please choose an image file.");
        if (picked.size > MAX_PHOTO_BYTES) return fail("That photo is larger than 5 MB.");
      }

      dialog.busy(true);

      try {
        const values = {
          eq_name: eqName,
          status: status.value,
          eq_condition: condition.value,
          quantity: total,
          available_quantity: free
        };

        if (picked) {
          const path = `${eqId.toLowerCase()}-${Date.now()}.${fileExtension(picked)}`;

          const upload = await client.storage
            .from(config.photoBucket)
            .upload(path, picked, { contentType: picked.type, upsert: false });

          if (upload.error) {
            return fail("The photo couldn't be uploaded.", upload.error.message);
          }

          values.photo_path = path;
        }

        if (isNew) {
          const { error: insertError } = await client
            .from("equipment")
            .insert({ eq_id: eqId, ...values });

          if (insertError) {
            return fail(
              insertError.code === "23505"
                ? "That Equipment ID already exists."
                : "The equipment couldn't be added.",
              insertError.message
            );
          }
        } else {
          const result = await client
            .from("equipment")
            .update(values)
            .eq("eq_id", record.eq_id)
            .select("eq_id");

          if (result.error || !result.data || result.data.length === 0) {
            return fail(
              "The changes couldn't be saved.",
              result.error?.message || "No rows were updated. Check the admin permissions."
            );
          }
        }

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        dialog.close();
        window.ADMIN.toast(isNew ? "Equipment added" : "Changes saved");
        load();
      } catch (caught) {
        console.error("Saving equipment failed:", caught);
        fail("Something went wrong. Please try again.", caught.message);
      }
    });

    dialog.show({ custom: form });
    name.focus();
  }

  /* ---------- Delete ---------- */

  function askDelete(record) {
    const name = record.eq_name || record.eq_id;

    dialog.show({
      icon: "warning",
      tone: "is-danger",
      title: "Delete this equipment?",
      message: `\u201C${name}\u201D will be removed from the list. This can't be undone.`,
      actions: [
        { label: "Cancel", onClick: dialog.close },
        {
          label: "Delete",
          primary: true,
          danger: true,
          onClick: () => remove(record, name)
        }
      ]
    });
  }

  async function remove(record, name) {
    const { client } = window.EBRMS;
    dialog.busy(true);

    try {
      // Items that appear in borrowing records are kept, so the history
      // of who borrowed what stays complete.
      const used = await client
        .from("borrowing_transactions")
        .select("id")
        .eq("eq_id", record.eq_id)
        .limit(1);

      if (used.error) throw used.error;

      if (used.data && used.data.length > 0) {
        dialog.problem(
          "Can't delete this item",
          `\u201C${name}\u201D has borrowing records, so it has to stay. Set its status to Maintenance or Damaged instead.`
        );
        return;
      }

      const result = await client
        .from("equipment")
        .delete()
        .eq("eq_id", record.eq_id)
        .select("eq_id");

      if (result.error) {
        const blocked = result.error.code === "23503";

        dialog.problem(
          blocked ? "Can't delete this item" : "Couldn't delete",
          blocked
            ? `\u201C${name}\u201D is still used by other records, so it can't be deleted.`
            : "We couldn't delete this equipment. Please try again.",
          result.error.message
        );
        return;
      }

      if (!result.data || result.data.length === 0) {
        dialog.problem(
          "Couldn't delete",
          "Nothing was deleted. Check that admins are allowed to delete equipment.",
          "No rows were removed."
        );
        return;
      }

      // Tidy up the photo file too (not important if this fails).
      const photo = record.photo_path;

      if (photo && !/^https:\/\//.test(photo)) {
        client.storage
          .from(config.photoBucket)
          .remove([photo])
          .catch((error) => console.warn("Photo not removed:", error));
      }

      dialog.close();
      window.ADMIN.toast("Equipment deleted");
      load();
    } catch (error) {
      console.error("Delete failed:", error);
      dialog.problem(
        "Couldn't delete",
        "We couldn't delete this equipment. Please try again.",
        error.message
      );
    }
  }

  searchInput.addEventListener("input", applySearch);
  addButton.addEventListener("click", () => openForm(null));

  load().catch((error) => {
    console.error("Loading failed:", error);
    scroller.removeAttribute("aria-busy");
    showMessage("Something went wrong while loading.", error.message);
  });
})();
