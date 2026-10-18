/* =========================================================
   EBRMS — MY RETURN REQUEST (shared by Student and Faculty)
   File: return_request/script.js

   Shows the signed-in user's own borrowed items and lets them
   ask to return one. The admin confirms it afterwards.

   Needs the SQL function public.request_return (see the setup
   notes) and Supabase RLS that lets users SELECT their own rows.
   ========================================================= */

(() => {
  // While setting up, show the database's own error text.
  // Set to false once everything works.
  const SHOW_DETAILS = true;

  const SOURCE = {
    table: "borrowing_transactions",
    equipmentTable: "equipment",
    requestFunction: "request_return",
    // The statuses this page lists.
    statuses: ["Approved", "Return Requested", "Returned"]
  };

  // borrowing_status -> the filter key and look used on this page.
  const LOOK = {
    approved: { key: "approved", label: "Approved", tone: "is-success" },
    "return requested": { key: "requested", label: "Return requested", tone: "is-warning" },
    returned: { key: "returned", label: "Returned", tone: "is-neutral" }
  };

  const ICON =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M9 14 4 9l5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const ICONS = {
    question:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/></svg>',
    success:
      '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10.3 4.6 3.4 17a2 2 0 0 0 1.7 3h13.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
  };

  const list = document.getElementById("itemList");
  const scroller = list.parentElement;
  const message = document.getElementById("itemEmpty");

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
  }

  function showMessage(text, reason = "") {
    message.textContent = text;

    if (reason && SHOW_DETAILS) {
      const detail = el("span", "item-meta", reason);
      detail.style.display = "block";
      message.append(detail);
    }
  }

  /* ---------- Dialog ---------- */

  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.setAttribute("aria-labelledby", "modalTitle");
  dialog.setAttribute("aria-describedby", "modalMessage");
  document.body.append(dialog);

  let busy = false;

  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && !busy) dialog.close();
  });

  function render({ icon, tone, title, text, detail, actions }) {
    const card = el("div", "modal-card");

    const badge = el("span", "modal-icon " + tone);
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = ICONS[icon];

    const titleEl = el("h2", "", title);
    titleEl.id = "modalTitle";

    const textEl = el("p", "", text);
    textEl.id = "modalMessage";

    card.append(badge, titleEl, textEl);

    if (detail && SHOW_DETAILS) card.append(el("p", "modal-detail", detail));

    const row = el("div", "modal-actions");

    actions.forEach((action) => {
      const control = el(
        action.href ? "a" : "button",
        "modal-button" + (action.primary ? " is-primary" : ""),
        action.label
      );

      if (action.href) {
        control.href = action.href;
      } else {
        control.type = "button";
        control.addEventListener("click", action.onClick);
      }

      row.append(control);
    });

    card.append(row);
    dialog.replaceChildren(card);

    (row.querySelector(".is-primary") || row.firstElementChild)?.focus();
    if (!dialog.open) dialog.showModal();
  }

  /* ---------- Request a return ---------- */

  function confirmStep(record, name) {
    render({
      icon: "question",
      tone: "is-brand",
      title: "Return this item?",
      text: `Would you like to return \u201C${name}\u201D?`,
      actions: [
        { label: "Cancel", onClick: () => dialog.close() },
        { label: "Okay", primary: true, onClick: () => submit(record, name) }
      ]
    });
  }

  async function submit(record, name) {
    const { client } = window.EBRMS;

    busy = true;
    dialog.querySelectorAll("button").forEach((b) => (b.disabled = true));

    try {
      const { error } = await client.rpc(SOURCE.requestFunction, {
        p_borrowing_id: record.borrowing_id
      });

      if (error) throw error;

      busy = false;
      render({
        icon: "success",
        tone: "is-success",
        title: "Return request sent",
        text: "Thank you for using EBRMS. Please hand the item to the admin and wait for their confirmation.",
        actions: [{ label: "Close", primary: true, onClick: () => dialog.close() }]
      });

      load();
    } catch (error) {
      busy = false;
      console.error("Return request failed:", error);
      render({
        icon: "warning",
        tone: "is-danger",
        title: "Request not sent",
        text: "We couldn't send your return request. Please try again.",
        detail: error.message,
        actions: [
          { label: "Close", onClick: () => dialog.close() },
          { label: "Try again", primary: true, onClick: () => submit(record, name) }
        ]
      });
    }
  }

  /* ---------- Rows ---------- */

  // Rows are built with textContent so database text is never run as HTML.
  function buildRow(record, name) {
    const look =
      LOOK[String(record.borrowing_status || "").trim().toLowerCase()] ||
      { key: "other", label: record.borrowing_status || "Unknown", tone: "is-neutral" };

    const row = el("li", "item-row is-equipment");
    row.dataset.status = look.key;

    const photo = el("span", "item-photo");
    photo.setAttribute("aria-hidden", "true");
    photo.innerHTML = ICON;

    const copy = el("div", "item-copy");
    copy.append(el("span", "item-title", name || record.eq_id || "Equipment"));

    const approved = formatDate(record.approval_date);
    copy.append(
      el(
        "span",
        "item-meta",
        `Request ${record.borrowing_id || ""}` + (approved ? ` \u00B7 Approved ${approved}` : "")
      )
    );

    if (look.key === "requested" && record.return_request_date) {
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
    }

    copy.append(el("span", "status-pill " + look.tone, look.label));

    if (look.key === "approved") {
      const button = el("button", "borrow-button", "Request return");
      button.type = "button";
      button.addEventListener("click", () => confirmStep(record, name || "this item"));
      copy.append(button);
    }

    row.append(photo, copy);
    return row;
  }

  /* ---------- Loading ---------- */

  async function load() {
    const { client, user: userReady, getProfile, refreshList } = window.EBRMS;
    const keepScroll = scroller.scrollTop;

    scroller.setAttribute("aria-busy", "true");

    const user = await userReady;
    const profile = await getProfile();

    scroller.removeAttribute("aria-busy");

    if (!client || !user) {
      showMessage("Sign in to see your items.");
      return;
    }

    if (!profile?.user_id) {
      showMessage(
        "We couldn't find your account details.",
        "No user_id was found for this account in the users table."
      );
      return;
    }

    // The filter is a convenience. Supabase RLS must be the rule that
    // really limits each user to their own rows.
    const { data, error } = await client
      .from(SOURCE.table)
      .select("*")
      .eq("borrower_id", profile.user_id)
      .in("borrowing_status", SOURCE.statuses)
      .order("id", { ascending: false });

    if (error) {
      console.error("Could not load items:", error.message);
      list.replaceChildren();
      showMessage("We couldn't load your items. Please try again.", error.message);
      refreshList();
      return;
    }

    const names = {};
    const ids = [...new Set(data.map((record) => record.eq_id).filter(Boolean))];

    if (ids.length) {
      const result = await client
        .from(SOURCE.equipmentTable)
        .select("eq_id, eq_name")
        .in("eq_id", ids);

      if (result.error) {
        console.error("Could not load equipment names:", result.error.message);
      } else {
        result.data.forEach((item) => (names[item.eq_id] = item.eq_name));
      }
    }

    list.replaceChildren(
      ...data.map((record) => buildRow(record, names[record.eq_id]))
    );

    showMessage("Nothing to return yet. Items you borrow will appear here once approved.");
    refreshList();
    scroller.scrollTop = keepScroll;
  }

  load().catch((error) => {
    console.error("Loading failed:", error);
    scroller.removeAttribute("aria-busy");
    showMessage("Something went wrong while loading.", error.message);
  });
})();
