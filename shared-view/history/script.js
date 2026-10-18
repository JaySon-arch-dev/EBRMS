/* =========================================================
   EBRMS — HISTORY (shared by every role)
   File: shared-view/history/script.js

   History is not a separate table. It shows the signed-in user's
   own FINISHED transactions from public.borrowing_transactions:
     - Returned  (borrowed and brought back)
     - Rejected  (the admin said no)
   Requests that are still open stay in My Borrowing Transaction
   and My Return Request until they finish.
   ========================================================= */

(() => {
  // While setting up, show the database's own error text on the page.
  // Set to false once everything works.
  const SHOW_DETAILS = true;

  const SOURCE = {
    table: "borrowing_transactions",
    equipmentTable: "equipment",
    finished: ["Returned", "Rejected"]
  };

  const LOOK = {
    returned: { key: "returned", label: "Returned", tone: "is-success" },
    rejected: { key: "rejected", label: "Rejected", tone: "is-danger" }
  };

  const ICON =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4Z M4 8v8l8 4 8-4V8" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

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

  function show(text, reason = "") {
    message.textContent = text;

    if (reason && SHOW_DETAILS) {
      const detail = line(reason);
      detail.style.display = "block";
      message.append(detail);
    }
  }

  // Rows are built with textContent so database text is never run as HTML.
  function buildRow(record, equipmentName) {
    const look =
      LOOK[String(record.borrowing_status || "").trim().toLowerCase()] ||
      { key: "other", label: record.borrowing_status || "Unknown", tone: "is-neutral" };

    const row = document.createElement("li");
    row.className = "item-row";
    row.dataset.status = look.key;

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
      `Request ${record.borrowing_id || ""}` + (requested ? ` \u00B7 ${requested}` : "")
    ));

    if (look.key === "returned") {
      const borrowed = formatDate(record.approval_date);
      const returned = formatDate(record.return_date);

      copy.append(line(
        `${borrowed ? "Borrowed " + borrowed : "Borrowed"}` +
        `${returned ? " \u00B7 Returned " + returned : ""}`
      ));

      if (record.return_condition) {
        copy.append(line(`Condition on return: ${record.return_condition}`));
      }
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

  async function load() {
    const { client, user: userReady, getProfile, refreshList } = window.EBRMS;

    scroller.setAttribute("aria-busy", "true");

    const user = await userReady;
    const profile = await getProfile();

    scroller.removeAttribute("aria-busy");

    if (!client || !user) {
      show("Sign in to see your history.");
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
    // really limits each user to their own rows.
    const { data, error } = await client
      .from(SOURCE.table)
      .select("*")
      .eq("borrower_id", profile.user_id)
      .in("borrowing_status", SOURCE.finished)
      .order("id", { ascending: false });

    if (error) {
      console.error("Could not load history:", error.message);
      list.replaceChildren();
      show("We couldn't load your history. Please try again.", error.message);
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

    show("No history yet. Finished requests will appear here.");
    refreshList();
  }

  load().catch((error) => {
    console.error("Loading failed:", error);
    scroller.removeAttribute("aria-busy");
    show("Something went wrong while loading.", error.message);
  });
})();
