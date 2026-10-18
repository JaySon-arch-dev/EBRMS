/* =========================================================
   EBRMS — ADMIN: BORROWING REQUESTS
   File: admin/requests.js

   Lists every borrowing request, and lets the admin approve
   or reject the pending ones.

   Needs Supabase RLS that lets admins SELECT and UPDATE
   borrowing_transactions, SELECT users, and UPDATE equipment.
   ========================================================= */

(() => {
  const { config, el, formatDate, photoUrl, approverName, dialog } = window.ADMIN;

  const PENDING = "Pending";

  // How each borrowing_status looks. Anything else shows in grey.
  const STATUS_LOOK = {
    pending: { label: "Pending", tone: "is-warning" },
    approved: { label: "Approved", tone: "is-success" },
    borrowed: { label: "Borrowed", tone: "is-info" },
    "return requested": { label: "Return requested", tone: "is-warning" },
    returned: { label: "Returned", tone: "is-neutral" },
    rejected: { label: "Rejected", tone: "is-danger" },
    overdue: { label: "Overdue", tone: "is-danger" }
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
    const key = String(record.borrowing_status || "").trim().toLowerCase();
    const look = STATUS_LOOK[key] || {
      label: record.borrowing_status || "Unknown",
      tone: "is-neutral"
    };

    const equipmentName = equipment?.eq_name || record.eq_id || "Equipment";
    const borrowerName = borrower?.full_name || "Unknown user";

    const row = el("li", "item-row is-equipment");
    row.dataset.status = key || "unknown";

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

    const requested = formatDate(record.request_date || record.created_at);
    copy.append(
      el(
        "span",
        "item-meta",
        `Request ${record.borrowing_id || ""}` + (requested ? ` \u00B7 ${requested}` : "")
      )
    );

    copy.append(el("span", "status-pill " + look.tone, look.label));

    if (key === "pending") {
      const actions = el("div", "action-row");

      const approve = el("button", "borrow-button", "Approve");
      approve.type = "button";
      approve.addEventListener("click", () =>
        askApprove(record, borrowerName, equipmentName)
      );

      const reject = el("button", "reject-button", "Reject");
      reject.type = "button";
      reject.addEventListener("click", () =>
        askReject(record, borrowerName, equipmentName)
      );

      actions.append(approve, reject);
      copy.append(actions);
    } else {
      if (record.approved_by) {
        const when = formatDate(record.approval_date);
        copy.append(
          el(
            "span",
            "item-meta",
            `Approved by ${record.approved_by}` + (when ? ` \u00B7 ${when}` : "")
          )
        );
      }

      if (record.remarks) {
        copy.append(el("span", "item-meta", `Remarks: ${record.remarks}`));
      }
    }

    row.append(photo, copy);
    return row;
  }

  /* ---------- Loading ---------- */

  async function load() {
    const { client, user: userReady, refreshList } = window.EBRMS;
    const keepScroll = scroller.scrollTop;

    scroller.setAttribute("aria-busy", "true");
    showMessage("Loading requests\u2026");

    const user = await userReady;

    if (!client || !user) {
      scroller.removeAttribute("aria-busy");
      showMessage("Sign in to see the requests.");
      return;
    }

    const { data, error } = await client
      .from("borrowing_transactions")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      scroller.removeAttribute("aria-busy");
      console.error("Could not load requests:", error.message);
      list.replaceChildren();
      showMessage("We couldn't load the requests. Please try again.", error.message);
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

      if (result.error) {
        console.error("Could not load borrower names:", result.error.message);
      } else {
        result.data.forEach((person) => (borrowers[person.user_id] = person));
      }
    }

    if (equipmentIds.length) {
      const result = await client
        .from("equipment")
        .select("eq_id, eq_name, photo_path")
        .in("eq_id", equipmentIds);

      if (result.error) {
        console.error("Could not load equipment:", result.error.message);
      } else {
        result.data.forEach((item) => (equipment[item.eq_id] = item));
      }
    }

    scroller.removeAttribute("aria-busy");

    list.replaceChildren(
      ...data.map((record) =>
        buildRow(record, borrowers[record.borrower_id], equipment[record.eq_id])
      )
    );

    showMessage("No borrowing requests yet.");
    refreshList();
    scroller.scrollTop = keepScroll;
  }

  /* ---------- Approve ---------- */

  function askApprove(record, borrowerName, equipmentName) {
    dialog.show({
      icon: "question",
      tone: "is-brand",
      title: "Approve this request?",
      message: `${borrowerName} will be allowed to borrow \u201C${equipmentName}\u201D.`,
      actions: [
        { label: "Cancel", onClick: dialog.close },
        { label: "Approve", primary: true, onClick: () => approve(record, equipmentName) }
      ]
    });
  }

  async function approve(record, equipmentName) {
    const { client } = window.EBRMS;
    dialog.busy(true);

    let originalStock = null;

    try {
      if (config.adjustStock) {
        const stockResult = await client
          .from("equipment")
          .select("eq_id, available_quantity")
          .eq("eq_id", record.eq_id)
          .maybeSingle();

        if (stockResult.error || !stockResult.data) {
          throw new Error(stockResult.error?.message || "That equipment was not found.");
        }

        const stock = Number(stockResult.data.available_quantity);

        if (!(stock > 0)) {
          dialog.problem(
            "No stock left",
            `There are no available units of \u201C${equipmentName}\u201D, so this request can't be approved yet.`
          );
          return;
        }

        // Only succeeds if nobody changed the stock in the meantime.
        const taken = await client
          .from("equipment")
          .update({ available_quantity: stock - 1 })
          .eq("eq_id", record.eq_id)
          .eq("available_quantity", stock)
          .select("eq_id");

        if (taken.error) throw taken.error;

        if (!taken.data || taken.data.length === 0) {
          dialog.problem(
            "Stock changed",
            "The stock changed while you were approving. Please try again."
          );
          return;
        }

        originalStock = stock;
      }

      const approver = await approverName();

      const done = await client
        .from("borrowing_transactions")
        .update({
          borrowing_status: "Approved",
          approved_by: approver,
          approval_date: new Date().toISOString()
        })
        .eq("id", record.id)
        .eq("borrowing_status", PENDING)
        .select("id");

      if (done.error || !done.data || done.data.length === 0) {
        // Put the stock back so nothing is lost.
        if (originalStock !== null) {
          await client
            .from("equipment")
            .update({ available_quantity: originalStock })
            .eq("eq_id", record.eq_id);
        }

        throw new Error(
          done.error?.message ||
            "This request was already handled, or you don't have permission."
        );
      }

      dialog.close();
      window.ADMIN.toast("Request approved");
      load();
    } catch (error) {
      console.error("Approve failed:", error);
      dialog.problem(
        "Couldn't approve",
        "We couldn't approve this request. Please try again.",
        error.message
      );
    }
  }

  /* ---------- Reject ---------- */

  function askReject(record, borrowerName, equipmentName) {
    dialog.show({
      icon: "warning",
      tone: "is-danger",
      title: "Reject this request?",
      message: `${borrowerName}\u2019s request for \u201C${equipmentName}\u201D will be rejected.`,
      input: {
        label: "Reason (optional)",
        placeholder: "The borrower will see this",
        maxLength: 200
      },
      actions: [
        { label: "Cancel", onClick: dialog.close },
        { label: "Reject", primary: true, onClick: () => reject(record) }
      ]
    });
  }

  async function reject(record) {
    const { client } = window.EBRMS;
    const reason = dialog.inputValue();

    dialog.busy(true);

    try {
      const done = await client
        .from("borrowing_transactions")
        .update({
          borrowing_status: "Rejected",
          remarks: reason || null
        })
        .eq("id", record.id)
        .eq("borrowing_status", PENDING)
        .select("id");

      if (done.error || !done.data || done.data.length === 0) {
        throw new Error(
          done.error?.message ||
            "This request was already handled, or you don't have permission."
        );
      }

      dialog.close();
      window.ADMIN.toast("Request rejected");
      load();
    } catch (error) {
      console.error("Reject failed:", error);
      dialog.problem(
        "Couldn't reject",
        "We couldn't reject this request. Please try again.",
        error.message
      );
    }
  }

  load().catch((error) => {
    console.error("Loading failed:", error);
    scroller.removeAttribute("aria-busy");
    showMessage("Something went wrong while loading.", error.message);
  });
})();
