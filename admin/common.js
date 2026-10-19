/* =========================================================
   EBRMS — ADMIN COMMON
   File: admin/common.js

   Small helpers used only by the admin pages: a dialog,
   a short "saved" message, dates and photo links.
   (The look of the dialog comes from shared-view/style.css.)
   ========================================================= */

(() => {
  const CONFIG = {
    // While setting up, show the database's own error text in dialogs.
    // Set to false once everything works.
    showDetails: true,

    // The Storage bucket that holds equipment photos. Use the same
    // name as photoBucket in shared-view/equipment.js.
    photoBucket: "Photos",

    // What is saved in borrowing_transactions.approved_by:
    // "full_name" or "user_id".
    approverField: "full_name",

    // Approving a request takes 1 away from the equipment's
    // available_quantity. Set to false to leave stock alone.
    adjustStock: true
  };

  const ICONS = {
    question:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/></svg>',
    success:
      '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10.3 4.6 3.4 17a2 2 0 0 0 1.7 3h13.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    box:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4Z M4 8v8l8 4 8-4V8" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
  };

  /* ---------- Small helpers ---------- */

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

  // Turns a stored photo value into a link. Only https:// links are used.
  function photoUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;

    let url = value.trim();

    if (!/^https:\/\//.test(url)) {
      const { client } = window.EBRMS;
      if (!client || !CONFIG.photoBucket) return null;

      url = client.storage
        .from(CONFIG.photoBucket)
        .getPublicUrl(url.replace(/^\/+/, "")).data.publicUrl;
    }

    return /^https:\/\//.test(url) ? url : null;
  }

  // The admin's name as saved in approved_by.
  async function approverName() {
    const profile = await window.EBRMS.getProfile();
    return profile?.[CONFIG.approverField] || profile?.user_id || "Admin";
  }

  /* ---------- Dialog ---------- */

  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.setAttribute("aria-labelledby", "modalTitle");
  dialog.setAttribute("aria-describedby", "modalMessage");
  document.body.append(dialog);

  let busy = false;

  // Esc or a tap outside is ignored while something is being saved.
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && !busy) dialog.close();
  });

  function setBusy(flag) {
    busy = flag;
    dialog
      .querySelectorAll("button, input, select, textarea")
      .forEach((control) => {
        control.disabled = flag;
      });
  }

  // Shows a message dialog, or your own element (custom) such as a form.
  function show({ icon, tone, title, message, detail, input, actions, custom }) {
    dialog.classList.toggle("is-form", Boolean(custom));
    busy = false;

    if (custom) {
      dialog.replaceChildren(custom);
    } else {
      const card = el("div", "modal-card");

      const badge = el("span", "modal-icon " + tone);
      badge.setAttribute("aria-hidden", "true");
      badge.innerHTML = ICONS[icon];

      const titleEl = el("h2", "", title);
      titleEl.id = "modalTitle";

      const messageEl = el("p", "", message);
      messageEl.id = "modalMessage";

      card.append(badge, titleEl, messageEl);

      if (input) {
        const label = el("label", "dialog-input");
        label.append(el("span", "", input.label));

        const area = document.createElement("textarea");
        area.id = "modalInput";
        area.rows = 3;
        area.maxLength = input.maxLength || 200;
        area.placeholder = input.placeholder || "";
        label.append(area);
        card.append(label);
      }

      if (detail && CONFIG.showDetails) {
        card.append(el("p", "modal-detail", detail));
      }

      const row = el("div", "modal-actions");

      actions.forEach((action) => {
        const button = el(
          "button",
          "modal-button" +
            (action.primary ? " is-primary" : "") +
            (action.danger ? " is-danger" : ""),
          action.label
        );
        button.type = "button";
        button.addEventListener("click", action.onClick);
        row.append(button);
      });

      card.append(row);
      dialog.replaceChildren(card);

      const first = row.querySelector(".is-primary") || row.firstElementChild;
      const field = card.querySelector("textarea");
      (field || first)?.focus();
    }

    if (!dialog.open) dialog.showModal();
  }

  function close() {
    busy = false;
    if (dialog.open) dialog.close();
  }

  function inputValue() {
    return (dialog.querySelector("#modalInput")?.value || "").trim();
  }

  // A simple "something went wrong" dialog with a Close button.
  function problem(title, message, detail = "") {
    show({
      icon: "warning",
      tone: "is-danger",
      title,
      message,
      detail,
      actions: [{ label: "Close", primary: true, onClick: close }]
    });
  }

  /* ---------- Short message ("Saved") ---------- */

  let toastTimer = null;

  function toast(text) {
    let box = document.getElementById("adminToast");

    if (!box) {
      box = el("div", "toast");
      box.id = "adminToast";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      document.body.append(box);
    }

    box.textContent = text;
    box.classList.add("is-visible");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("is-visible"), 2800);
  }

  window.ADMIN = {
    config: CONFIG,
    icons: ICONS,
    el,
    formatDate,
    photoUrl,
    approverName,
    toast,
    dialog: { show, close, busy: setBusy, inputValue, problem }
  };
})();
