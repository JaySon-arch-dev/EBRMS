/* =========================================================
   EBRMS — BORROW REQUEST (shared by Student and Faculty)
   File: shared-view/borrow.js

   When a Borrow button is clicked (equipment.js sends the
   "ebrms:borrow" event), this:
     1. asks "Would you like to borrow this item?"
     2. on OK, saves a Pending request in public.borrowing_transactions
     3. says "Thank you for using EBRMS, please wait for admin's
        confirmation about your request."
   The request then shows up in My Borrowing Transaction.

   Supabase RLS must let a signed-in user INSERT a request for
   themselves and SELECT their own requests.
   ========================================================= */

(() => {
  // While setting up, show the database's own error text in the dialog.
  // Set to false once everything works.
  const SHOW_DETAILS = true;

  const BORROW = {
    table: "borrowing_transactions",
    pendingStatus: "Pending",
    transactionsUrl: "/borrowing_transaction/"
  };

  const ICONS = {
    question:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/></svg>',
    success:
      '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10.3 4.6 3.4 17a2 2 0 0 0 1.7 3h13.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
  };

  /* ---------- Dialog ---------- */

  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.setAttribute("aria-labelledby", "modalTitle");
  dialog.setAttribute("aria-describedby", "modalMessage");
  document.body.append(dialog);

  let busy = false;

  // Closing with Esc or a tap outside is blocked while a request is sending.
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && !busy) dialog.close();
  });

  function render({ icon, tone, title, message, detail, actions }) {
    const card = document.createElement("div");
    card.className = "modal-card";

    const badge = document.createElement("span");
    badge.className = "modal-icon " + tone;
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = ICONS[icon];

    const titleEl = document.createElement("h2");
    titleEl.id = "modalTitle";
    titleEl.textContent = title;

    const messageEl = document.createElement("p");
    messageEl.id = "modalMessage";
    messageEl.textContent = message;

    card.append(badge, titleEl, messageEl);

    if (detail) {
      const detailEl = document.createElement("p");
      detailEl.className = "modal-detail";
      detailEl.textContent = detail;
      card.append(detailEl);
    }

    const row = document.createElement("div");
    row.className = "modal-actions";

    actions.forEach((action) => {
      const control = document.createElement(action.href ? "a" : "button");
      control.className = "modal-button " + (action.primary ? "is-primary" : "");
      control.textContent = action.label;

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

    const first = row.querySelector(".is-primary") || row.firstElementChild;
    if (first) first.focus();
  }

  function open() {
    if (!dialog.open) dialog.showModal();
  }

  /* ---------- Request id ---------- */

  // Example: BRW-20261018-K7Q2M. The table's unique constraint catches the
  // rare repeat, and submit() then tries again with a new one.
  function newBorrowingId() {
    const now = new Date();
    const day =
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");

    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `BRW-${day}-${random.padEnd(5, "0")}`;
  }

  /* ---------- Steps ---------- */

  function confirmStep(item) {
    render({
      icon: "question",
      tone: "is-brand",
      title: "Borrow this item?",
      message: `Would you like to borrow \u201C${item.name || "this item"}\u201D?`,
      actions: [
        { label: "Cancel", onClick: () => dialog.close() },
        { label: "Okay", primary: true, onClick: () => submit(item) }
      ]
    });
    open();
  }

  function problemStep(item, message, detail, { retry = true } = {}) {
    render({
      icon: "warning",
      tone: "is-danger",
      title: "Request not sent",
      message,
      detail: SHOW_DETAILS ? detail : "",
      actions: [
        { label: "Close", onClick: () => dialog.close() },
        ...(retry
          ? [{ label: "Try again", primary: true, onClick: () => submit(item) }]
          : [])
      ]
    });
  }

  function successStep() {
    render({
      icon: "success",
      tone: "is-success",
      title: "Request sent",
      message:
        "Thank you for using EBRMS, please wait for admin\u2019s confirmation about your request.",
      actions: [
        { label: "Close", onClick: () => dialog.close() },
        { label: "View my requests", primary: true, href: BORROW.transactionsUrl }
      ]
    });
  }

  async function submit(item) {
    const { client, user: userReady, getProfile } = window.EBRMS;

    busy = true;
    dialog.querySelectorAll("button").forEach((b) => (b.disabled = true));

    try {
      const user = await userReady;
      const profile = await getProfile();

      if (!client || !user) {
        problemStep(item, "Please sign in again, then try once more.", "", {
          retry: false
        });
        return;
      }

      const borrowerId = profile?.user_id;

      if (!borrowerId) {
        problemStep(
          item,
          "We couldn't find your account details.",
          "No user_id was found for this account in the users table.",
          { retry: false }
        );
        return;
      }

      // Don't send the same request twice while one is still waiting.
      const existing = await client
        .from(BORROW.table)
        .select("id")
        .eq("borrower_id", borrowerId)
        .eq("eq_id", item.id)
        .eq("borrowing_status", BORROW.pendingStatus)
        .limit(1);

      if (existing.error) {
        console.error("Could not check existing requests:", existing.error.message);
      } else if (existing.data && existing.data.length > 0) {
        problemStep(
          item,
          "You already have a pending request for this item.",
          "",
          { retry: false }
        );
        return;
      }

      let lastError = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = await client.from(BORROW.table).insert({
          borrowing_id: newBorrowingId(),
          borrower_id: borrowerId,
          eq_id: item.id,
          request_date: new Date().toISOString(),
          borrowing_status: BORROW.pendingStatus
        });

        if (!error) {
          successStep();
          return;
        }

        lastError = error;

        // 23505 = that borrowing_id already exists: try a new one.
        if (error.code !== "23505") break;
      }

      console.error("Could not save the request:", lastError.message);
      problemStep(
        item,
        "We couldn't send your request. Please try again.",
        lastError.message
      );
    } catch (error) {
      console.error("Borrow request failed:", error);
      problemStep(
        item,
        "We couldn't send your request. Please try again.",
        error.message
      );
    } finally {
      busy = false;
    }
  }

  document.addEventListener("ebrms:borrow", (event) => {
    if (busy) return;
    confirmStep(event.detail || {});
  });
})();
