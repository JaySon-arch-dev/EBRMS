/* =========================================================
   EBRMS — MY BORROWING TRANSACTION (shared by Student and Faculty)
   File: borrowing_transaction/script.js

   Lists the signed-in user's own requests from
   public.borrowing_transactions, newest first.
   Supabase RLS must let each user SELECT only their own rows.
   ========================================================= */

(() => {
  // While setting up, show the database's own error text on the page.
  // Set to false once everything works.
  const SHOW_DETAILS = true;

  const SOURCE = {
    table: "borrowing_transactions",
    equipmentTable: "equipment"
  };

  // How each borrowing_status value looks. Anything else shows in grey.
  const STATUS_LOOK = {
    pending: { label: "Pending", tone: "is-warning" },
    approved: { label: "Approved", tone: "is-success" },
    borrowed: { label: "Borrowed", tone: "is-info" },
    "return requested": { label: "Return requested", tone: "is-warning" },
    returned: { label: "Returned", tone: "is-neutral" },
    rejected: { label: "Rejected", tone: "is-danger" },
    declined: { label: "Declined", tone: "is-danger" },
    cancelled: { label: "Cancelled", tone: "is-neutral" },
    overdue: { label: "Overdue", tone: "is-danger" }
  };

  const ICON =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M8 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="8" y="3" width="8" height="5" rx="1.5" stroke="currentColor" stroke-width="1.7"/><path d="m8 14 2.5 2.5L16 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const list = document.getElementById("itemList");
  const scroller = list.parentElement;
  const message = document.getElementById("itemEmpty");

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

  function line(text) {
    const element = document.createElement("span");
    element.className = "item-meta";
    element.textContent = text;
    return element;
  }

  // Rows are built with textContent so database text is never run as HTML.
  function buildRow(record, equipmentName) {
    const key = String(record.borrowing_status || "").trim().toLowerCase();
    const look = STATUS_LOOK[key] || {
      label: record.borrowing_status || "Unknown",
      tone: "is-neutral"
    };

    const row = document.createElement("li");
    row.className = "item-row";
    row.dataset.status = key || "unknown";

    const icon = document.createElement("span");
    icon.className = "item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ICON;

    const copy = document.createElement("div");
    copy.className = "item-copy";

    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = equipmentName || record.eq_id || "Equipment";
    copy.append(title);

    const requested = formatDate(record.request_date || record.created_at);
    copy.append(line(
      `Request ${record.borrowing_id || ""}` +
      (requested ? ` \u00B7 ${requested}` : "")
    ));

    if (record.approved_by) {
      const when = formatDate(record.approval_date);
      copy.append(line(
        `Approved by ${record.approved_by}` + (when ? ` \u00B7 ${when}` : "")
      ));
    }

    if (record.return_date) {
      copy.append(line(`Return date: ${formatDate(record.return_date)}`));
    }

    if (record.remarks) {
      copy.append(line(`Remarks: ${record.remarks}`));
    }

    const badge = document.createElement("span");
    badge.className = "badge " + look.tone;
    badge.textContent = look.label;

    row.append(icon, copy, badge);
    return row;
  }

  function show(text, reason = "") {
    message.textContent = text;

    if (reason && SHOW_DETAILS) {
      const detail = document.createElement("span");
      detail.className = "item-meta";
      detail.style.display = "block";
      detail.textContent = reason;
      message.append(detail);
    }
  }

  async function load() {
    const { client, user: userReady, getProfile, refreshList } = window.EBRMS;

    scroller.setAttribute("aria-busy", "true");
    list.replaceChildren();
    refreshList();

    const user = await userReady;
    const profile = await getProfile();

    scroller.removeAttribute("aria-busy");

    if (!client || !user) {
      show("Sign in to see your requests.");
      return;
    }

    if (!profile?.user_id) {
      show(
        "We couldn't find your account details.",
        "No user_id was found for this account in the users table."
      );
      return;
    }

    // The filter is a convenience. Supabase RLS must be the rule that
    // really limits each user to their own requests.
    const { data, error } = await client
      .from(SOURCE.table)
      .select("*")
      .eq("borrower_id", profile.user_id)
      .order("id", { ascending: false });

    if (error) {
      console.error("Could not load requests:", error.message);
      show("We couldn't load your requests. Please try again.", error.message);
      refreshList();
      return;
    }

    // Equipment names for the ids in these requests.
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
        result.data.forEach((item) => {
          names[item.eq_id] = item.eq_name;
        });
      }
    }

    list.replaceChildren(
      ...data.map((record) => buildRow(record, names[record.eq_id]))
    );

    show("No borrowing requests yet. Items you borrow will appear here.");
    refreshList();
  }

  load();
})();
