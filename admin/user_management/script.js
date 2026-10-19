/* =========================================================
   EBRMS — ADMIN: USER MANAGEMENT
   File: admin/user_management/script.js

   Lists users and lets the admin add a user, change a name or
   role, set a new password, and disable or enable an account.

   Accounts live in Supabase Auth, which only the server can change.
   So every action goes through POST /api/admin-users
   (api/admin-users.js), which checks the caller is an admin.
   ========================================================= */

(() => {
  const { config, el, formatDate, dialog } = window.ADMIN;

  const ROLES = ["Student", "Faculty", "Admin"];
  const API = "/api/admin-users";

  const list = document.getElementById("itemList");
  const scroller = list.parentElement;
  const message = document.getElementById("itemEmpty");
  const searchInput = document.getElementById("searchInput");
  const roleFilter = document.getElementById("roleFilter");
  const addButton = document.getElementById("addButton");

  let users = [];
  let myEmail = "";

  function showMessage(text, reason = "") {
    message.textContent = text;

    if (reason && config.showDetails) {
      const detail = el("span", "item-meta", reason);
      detail.style.display = "block";
      message.append(detail);
    }
  }

  /* ---------- Talking to the server function ---------- */

  async function callApi(action, payload = {}) {
    const { client } = window.EBRMS;
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) throw new Error("Please sign in again.");

    const response = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action, ...payload })
    });

    let body = null;

    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }

    if (!response.ok || !body) {
      throw new Error(
        body?.message ||
        body?.error ||
          (response.status === 404
            ? "The user service wasn't found. Check that api/admin-users.js is deployed."
            : `The user service didn't respond properly (${response.status}).`)
      );
    }

    return body;
  }

  /* ---------- Rows ---------- */

  function buildRow(user) {
    const isMe = String(user.email || "").toLowerCase() === myEmail;

    const row = el("li", "item-row is-equipment");
    row.dataset.role = String(user.role || "").toLowerCase();
    row.dataset.search = `${user.full_name || ""} ${user.user_id || ""} ${user.email || ""}`.toLowerCase();

    const avatar = el(
      "span",
      "user-avatar" + (user.disabled ? " is-off" : ""),
      (String(user.full_name || user.user_id || "?").trim().charAt(0) || "?").toUpperCase()
    );
    avatar.setAttribute("aria-hidden", "true");

    const copy = el("div", "item-copy");
    copy.append(el("span", "item-title", user.full_name || "Unnamed user"));
    copy.append(el("span", "item-meta", `${user.user_id} \u00B7 ${user.role || "No role"}`));
    copy.append(el("span", "item-meta", user.email || "No email"));

    if (user.last_sign_in_at) {
      copy.append(el("span", "item-meta", `Last sign-in ${formatDate(user.last_sign_in_at)}`));
    }

    let pill;
    if (!user.has_login) pill = el("span", "status-pill is-warning", "No login account");
    else if (user.disabled) pill = el("span", "status-pill is-neutral", "Disabled");
    else pill = el("span", "status-pill is-success", "Active");
    copy.append(pill);

    const actions = el("div", "action-row");

    const edit = el("button", "edit-button", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openEdit(user));
    actions.append(edit);

    if (user.has_login) {
      const reset = el("button", "edit-button", "Reset password");
      reset.type = "button";
      reset.addEventListener("click", () => openPassword(user));
      actions.append(reset);

      if (!isMe) {
        const toggle = el(
          user.disabled ? "button" : "button",
          user.disabled ? "edit-button" : "reject-button",
          user.disabled ? "Enable" : "Disable"
        );
        toggle.type = "button";
        toggle.addEventListener("click", () => askActive(user));
        actions.append(toggle);
      }
    }

    copy.append(actions);
    row.append(avatar, copy);
    return row;
  }

  function applyFilters() {
    const term = searchInput.value.trim().toLowerCase();
    const role = roleFilter.value;
    let shown = 0;

    list.querySelectorAll(".item-row").forEach((row) => {
      const match =
        (!term || row.dataset.search.includes(term)) &&
        (!role || row.dataset.role === role);

      row.hidden = !match;
      if (match) shown += 1;
    });

    if (shown > 0) {
      message.hidden = true;
    } else {
      showMessage(
        users.length ? "No users match your search." : "No users yet. Use Add user to create the first one."
      );
      message.hidden = false;
    }
  }

  /* ---------- Loading ---------- */

  async function load() {
    const { user: userReady } = window.EBRMS;
    const keepScroll = scroller.scrollTop;

    scroller.setAttribute("aria-busy", "true");
    message.hidden = false;
    showMessage("Loading users\u2026");

    const me = await userReady;
    myEmail = String(me?.email || "").toLowerCase();

    if (!me) {
      scroller.removeAttribute("aria-busy");
      showMessage("Sign in to manage users.");
      return;
    }

    try {
      const result = await callApi("list");
      users = result.users;
    } catch (error) {
      scroller.removeAttribute("aria-busy");
      console.error("Could not load users:", error.message);
      list.replaceChildren();
      showMessage("We couldn't load the users.", error.message);
      return;
    }

    scroller.removeAttribute("aria-busy");
    list.replaceChildren(...users.map(buildRow));
    applyFilters();
    scroller.scrollTop = keepScroll;
  }

  /* ---------- Form helpers ---------- */

  function field(labelText, control, hint) {
    const wrapper = el("label", "form-field");
    wrapper.append(el("span", "form-label", labelText), control);
    if (hint) wrapper.append(el("span", "form-hint", hint));
    return wrapper;
  }

  function textInput(value, { readOnly = false, type = "text", max = 100 } = {}) {
    const input = el("input", "form-control");
    input.type = type;
    input.value = value || "";
    input.readOnly = readOnly;
    input.maxLength = max;
    input.autocomplete = "off";
    input.spellcheck = false;
    return input;
  }

  function roleSelect(current) {
    const select = el("select", "form-control");

    ROLES.forEach((role) => {
      const option = el("option", "", role);
      option.value = role;
      select.append(option);
    });

    const match = ROLES.find((r) => r.toLowerCase() === String(current || "").toLowerCase());
    select.value = match || "Student";
    return select;
  }

  function statusSelect(current) {
    const select = el("select", "form-control");

    ["Active", "Inactive"].forEach((status) => {
      const option = el("option", "", status);
      option.value = status;
      select.append(option);
    });

    select.value = String(current || "").toLowerCase() === "inactive" ? "Inactive" : "Active";
    return select;
  }

  // A readable temporary password, made in the browser.
  function generatePassword() {
    const letters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint32Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (n) => letters[n % letters.length]).join("");
  }

  function passwordField(labelText, hint) {
    const input = textInput("", { max: 72 });
    input.placeholder = "At least 8 characters";

    const generate = el("button", "inline-button", "Generate");
    generate.type = "button";
    generate.addEventListener("click", () => {
      input.value = generatePassword();
    });

    const row = el("div", "password-row");
    row.append(input, generate);

    return { input, wrapper: field(labelText, row, hint) };
  }

  // Builds a form dialog. onSubmit returns a message to show on success.
  function openForm({ title, intro, fields, submitLabel, onSubmit, validate }) {
    const form = el("form", "modal-card form-card");
    form.noValidate = true;

    const heading = el("h2", "", title);
    heading.id = "modalTitle";
    form.append(heading);

    if (intro) {
      const text = el("p", "", intro);
      text.id = "modalMessage";
      form.append(text);
    }

    fields.forEach((item) => form.append(item));

    const error = el("p", "form-error");
    error.hidden = true;
    error.setAttribute("role", "alert");

    const cancel = el("button", "modal-button", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", dialog.close);

    const submit = el("button", "modal-button is-primary", submitLabel);
    submit.type = "submit";

    const row = el("div", "modal-actions");
    row.append(cancel, submit);
    form.append(error, row);

    const fail = (text) => {
      error.textContent = text;
      error.hidden = false;
      dialog.busy(false);
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;

      const problem = validate();
      if (problem) return fail(problem);

      dialog.busy(true);

      try {
        const done = await onSubmit();
        dialog.close();
        window.ADMIN.toast(done);
        load();
      } catch (caught) {
        console.error("User action failed:", caught);
        fail(caught.message);
      }
    });

    dialog.show({ custom: form });
    form.querySelector("input:not([readonly]), select")?.focus();
  }

  /* ---------- Add a user ---------- */

  function openAdd() {
    const userId = textInput("", { max: 40 });
    const fullName = textInput("");
    const email = textInput("", { type: "email", max: 200 });
    email.inputMode = "email";
    const role = roleSelect("Student");
    const status = statusSelect("Active");
    const password = passwordField(
      "Temporary password",
      "Share it with the user securely. They sign in with their User ID."
    );

    openForm({
      title: "Add user",
      fields: [
        field("User ID", userId, "What they type to sign in. Letters, numbers, dots, dashes."),
        field("Full name", fullName),
        field("Email", email),
        field("Role", role),
        field("Account status", status, "An Inactive user can't sign in until you enable them."),
        password.wrapper
      ],
      submitLabel: "Add user",
      validate: () => {
        if (!/^[A-Za-z0-9._-]{3,40}$/.test(userId.value.trim())) {
          return "User ID: 3 to 40 letters, numbers, dots, dashes or underscores.";
        }
        if (fullName.value.trim().length < 2) return "Please enter the full name.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
          return "Please enter a valid email address.";
        }
        if (password.input.value.length < 8) return "The password needs at least 8 characters.";
        return "";
      },
      onSubmit: async () => {
        await callApi("create", {
          user_id: userId.value.trim(),
          full_name: fullName.value.trim(),
          email: email.value.trim(),
          role: role.value,
          status: status.value,
          password: password.input.value
        });
        return "User added";
      }
    });
  }

  /* ---------- Edit a user ---------- */

  function openEdit(user) {
    const isMe = String(user.email || "").toLowerCase() === myEmail;
    const fullName = textInput(user.full_name);
    const role = roleSelect(user.role);
    const status = statusSelect(user.status);
    status.disabled = isMe;

    openForm({
      title: "Edit user",
      fields: [
        field("User ID", textInput(user.user_id, { readOnly: true })),
        field("Email", textInput(user.email, { readOnly: true }), "The email links the login to this profile, so it can't be changed here."),
        field("Full name", fullName),
        field("Role", role),
        field(
          "Account status",
          status,
          isMe ? "You can't disable your own account." : ""
        )
      ],
      submitLabel: "Save",
      validate: () =>
        fullName.value.trim().length < 2 ? "Please enter the full name." : "",
      onSubmit: async () => {
        await callApi("update", {
          user_id: user.user_id,
          full_name: fullName.value.trim(),
          role: role.value,
          ...(isMe ? {} : { status: status.value })
        });
        return "Changes saved";
      }
    });
  }

  /* ---------- Reset a password ---------- */

  function openPassword(user) {
    const password = passwordField(
      "New password",
      "Share it with the user securely."
    );

    openForm({
      title: "Reset password",
      intro: `Set a new password for ${user.full_name || user.user_id}.`,
      fields: [password.wrapper],
      submitLabel: "Set password",
      validate: () =>
        password.input.value.length < 8 ? "The password needs at least 8 characters." : "",
      onSubmit: async () => {
        await callApi("set_password", {
          user_id: user.user_id,
          password: password.input.value
        });
        return "Password changed";
      }
    });
  }

  /* ---------- Disable / enable ---------- */

  function askActive(user) {
    const enabling = user.disabled;
    const name = user.full_name || user.user_id;

    dialog.show({
      icon: enabling ? "question" : "warning",
      tone: enabling ? "is-brand" : "is-danger",
      title: enabling ? "Enable this account?" : "Disable this account?",
      message: enabling
        ? `${name} will be able to sign in again.`
        : `${name} will no longer be able to sign in. Their records are kept.`,
      actions: [
        { label: "Cancel", onClick: dialog.close },
        {
          label: enabling ? "Enable" : "Disable",
          primary: true,
          onClick: async () => {
            dialog.busy(true);

            try {
              await callApi("set_active", { user_id: user.user_id, active: enabling });
              dialog.close();
              window.ADMIN.toast(enabling ? "Account enabled" : "Account disabled");
              load();
            } catch (error) {
              console.error("Could not update the account:", error);
              dialog.problem(
                "Couldn't update the account",
                "Please try again.",
                error.message
              );
            }
          }
        }
      ]
    });
  }

  searchInput.addEventListener("input", applyFilters);
  roleFilter.addEventListener("change", applyFilters);
  addButton.addEventListener("click", openAdd);

  load().catch((error) => {
    console.error("Loading failed:", error);
    scroller.removeAttribute("aria-busy");
    showMessage("Something went wrong while loading.", error.message);
  });
})(); 
