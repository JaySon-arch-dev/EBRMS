/* =========================================================
   EBRMS — ADMIN: RETURN REQUESTS
   File: admin/return/script.js

   Lists the return requests and lets the admin confirm that an
   item came back, with its condition. Confirming also puts the
   item back into the available stock (unless it came back damaged).

   Needs the SQL function public.confirm_return (see the setup
   notes) and Supabase RLS that lets admins SELECT borrowing_transactions.
   ========================================================= */

(() => {
  const { config, el, formatDate, photoUrl, dialog } = window.ADMIN;

  const CONDITIONS = ["Good", "Fair", "Poor", "Damaged"];

  // borrowing_status -> filter key and look on this page.
  const LOOK = {
    "return requested": { key: "requested", label: "Return requested", tone: "is-warning" },
    returned: { key: "returned", label: "Returned", tone: "is-success" }
  };

  const ICON = window.ADMIN.icons.box;

  const list = document.getElementById("itemList");
  const scroller = list.parentElement;
  const message = document.getElementById("itemEmpty");

  function showMessage(text, reason = "") {
    message.textContent = text;

    if (reason && config.showDetails) {
      const detail = el("span", "item-meta", reason);
      detail.style.display = "block";
      message.append(detail);
    }
  }

  /* ---------- Rows ---------- */

  // Rows are built with textContent so database text is never run as HTML.
  function buildRow(record, borrower, equipment) {
    const look =
      LOOK[String(record.borrowing_status || "").trim().toLowerCase()] ||
      { key: "other", label: record.borrowing_status || "Unknown", tone: "is-neutral" };

    const equipmentName = equipment?.eq_name || record.eq_id || "Equipment";
    const borrowerName = borrower?.full_name || "Unknown user";

    const row = el("li", "item-row is-equipment");
    row.dataset.status = look.key;

    const photo = el("span", "item-photo");
    photo.setAttribute("aria-hidden", "true");

    const url = photoUrl(equipment?.photo_path);
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
    copy.append(el("span", "item-title", equipmentName));
    copy.append(el("span", "item-meta", `${borrowerName} \u00B7 ${record.borrower_id}`));
    copy.append(el("span", "item-meta", `Request ${record.borrowing_id || ""}`));

    if (record.return_request_date) {
      copy.append(
        el("span", "item-meta", `Return requested ${formatDate(record.return_request_date)}`)
      );
    }

    if (look.key === "returned") {
      const returned = formatDate(record.return_date);
      copy.append(
        el(
          "span",
          "item-meta",
          `Returned${returned ? " " + returned : ""}` +
            (record.return_condition ? ` \u00B7 ${record.return_condition}` : "")
        )
      );

      if (record.remarks) {
        copy.append(el("span", "item-meta", `Remarks: ${record.remarks}`));
      }
    }

    copy.append(el("span", "status-pill " + look.tone, look.label));

    if (look.key === "requested") {
      const actions = el("div", "action-row");
      const confirm = el("button", "borrow-button", "Confirm return");
      confirm.type = "button";
      confirm.addEventListener("click", () =>
        openConfirm(record, borrowerName, equipmentName)
      );
      actions.append(confirm);
      copy.append(actions);
    }

    row.append(photo, copy);
    return row;
  }

  /* ---------- Loading ---------- */

  async function load() {
    const { client, user: userReady, refreshList } = window.EBRMS;
    const keepScroll = scroller.scrollTop;

    scroller.setAttribute("aria-busy", "true");
    showMessage("Loading return requests\u2026");

    const user = await userReady;

    if (!client || !user) {
      scroller.removeAttribute("aria-busy");
      showMessage("Sign in to see the return requests.");
      return;
    }

    const { data, error } = await client
      .from("borrowing_transactions")
      .select("*")
      .in("borrowing_status", ["Return Requested", "Returned"])
      .order("id", { ascending: false });

    if (error) {
      scroller.removeAttribute("aria-busy");
      console.error("Could not load return requests:", error.message);
      list.replaceChildren();
      showMessage("We couldn't load the return requests. Please try again.", error.message);
      refreshList();
      return;
    }

    const unique = (values) => [...new Set(values.filter(Boolean))];
    const borrowers = {};
    const equipment = {};

    const borrowerIds = unique(data.map((record) => record.borrower_id));
    const equipmentIds = unique(data.map((record) => record.eq_id));

    if (borrowerIds.length) {
      const result = await client
        .from("users")
        .select("user_id, full_name")
        .in("user_id", borrowerIds);

      if (!result.error) {
        result.data.forEach((person) => (borrowers[person.user_id] = person));
      } else {
        console.error("Could not load borrower names:", result.error.message);
      }
    }

    if (equipmentIds.length) {
      const result = await client
        .from("equipment")
        .select("eq_id, eq_name, photo_path")
        .in("eq_id", equipmentIds);

      if (!result.error) {
        result.data.forEach((item) => (equipment[item.eq_id] = item));
      } else {
        console.error("Could not load equipment:", result.error.message);
      }
    }

    scroller.removeAttribute("aria-busy");

    list.replaceChildren(
      ...data.map((record) =>
        buildRow(record, borrowers[record.borrower_id], equipment[record.eq_id])
      )
    );

    showMessage("No return requests yet.");
    refreshList();
    scroller.scrollTop = keepScroll;
  }

  /* ---------- Confirm a return ---------- */

  function openConfirm(record, borrowerName, equipmentName) {
    const { client } = window.EBRMS;

    const form = el("form", "modal-card form-card");
    form.noValidate = true;

    const title = el("h2", "", "Confirm return");
    title.id = "modalTitle";

    const text = el(
      "p",
      "",
      `${borrowerName} is returning \u201C${equipmentName}\u201D. Check the item, then record its condition.`
    );
    text.id = "modalMessage";

    const condition = el("select", "form-control");
    CONDITIONS.forEach((value) => {
      const option = el("option", "", value);
      option.value = value;
      condition.append(option);
    });

    const conditionField = el("label", "form-field");
    conditionField.append(el("span", "form-label", "Condition on return"), condition);
    conditionField.append(
      el("span", "form-hint", "A damaged item is not added back to the available stock.")
    );

    const remarks = document.createElement("textarea");
    remarks.className = "form-control";
    remarks.rows = 3;
    remarks.maxLength = 200;
    remarks.placeholder = "Optional notes";
    remarks.style.padding = "10px 14px";

    const remarksField = el("label", "form-field");
    remarksField.append(el("span", "form-label", "Remarks (optional)"), remarks);

    const error = el("p", "form-error");
    error.hidden = true;
    error.setAttribute("role", "alert");

    const cancel = el("button", "modal-button", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", dialog.close);

    const save = el("button", "modal-button is-primary", "Confirm");
    save.type = "submit";

    const actions = el("div", "modal-actions");
    actions.append(cancel, save);

    form.append(title, text, conditionField, remarksField, error, actions);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;
      dialog.busy(true);

      try {
        const { error: rpcError } = await client.rpc("confirm_return", {
          p_borrowing_id: record.borrowing_id,
          p_condition: condition.value,
          p_remarks: remarks.value.trim()
        });

        if (rpcError) throw rpcError;

        dialog.close();
        window.ADMIN.toast("Return confirmed");
        load();
      } catch (caught) {
        console.error("Confirm return failed:", caught);
        error.textContent = config.showDetails
          ? `We couldn't confirm this return. (${caught.message})`
          : "We couldn't confirm this return. Please try again.";
        error.hidden = false;
        dialog.busy(false);
      }
    });

    dialog.show({ custom: form });
    condition.focus();
  }

  load().catch((error) => {
    console.error("Loading failed:", error);
    scroller.removeAttribute("aria-busy");
    showMessage("Something went wrong while loading.", error.message);
  });
})(); 
