/* =========================================================
   EBRMS — ADMIN USER MANAGEMENT (server side)
   File: api/admin-users.js          URL: POST /api/admin-users

   Creating logins, resetting passwords and disabling users needs
   the secret key, so it happens here and never in the browser.
   Uses the same environment variables and the same role guard
   (lib/authorize.js) as the rest of the API:
     SUPABASE_URL, SUPABASE_SECRET_KEY

   Only a signed-in, Active user whose role is Admin is served.
   ========================================================= */

import { createClient } from "@supabase/supabase-js";
import { authorize } from "../lib/authorize.js";

const ROLES = ["Student", "Faculty", "Admin"];
const ACTIVE = "Active";
const INACTIVE = "Inactive";
const BAN_FOR = "876000h"; // about 100 years = blocked

// Also block the login account in Supabase Auth when a user is disabled,
// so an already signed-in device can't keep refreshing its session.
const BAN_DISABLED_USERS = true;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let admin = null;

function db() {
  if (!admin) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      throw new HttpError(500, "Server configuration error.");
    }

    admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  return admin;
}

/* ---------- Login accounts (Supabase Auth) ---------- */

async function listAuthUsers() {
  const all = [];

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage: 200 });

    if (error) throw new HttpError(502, "Could not read the login accounts.");

    const batch = data?.users || [];
    all.push(...batch);

    if (batch.length < 200) break;
  }

  return all;
}

async function findAuthUser(email) {
  const wanted = String(email || "").toLowerCase();
  const users = await listAuthUsers();
  return users.find((user) => String(user.email || "").toLowerCase() === wanted) || null;
}

/* ---------- Input checks ---------- */

const clean = (value) => (typeof value === "string" ? value.trim() : "");

function checkUserId(value) {
  const userId = clean(value);

  if (!/^[A-Za-z0-9._-]{3,40}$/.test(userId)) {
    throw new HttpError(400, "User ID: 3-40 letters, numbers, dots, dashes or underscores.");
  }

  return userId;
}

function checkName(value) {
  const name = clean(value);

  if (name.length < 2 || name.length > 100) {
    throw new HttpError(400, "Full name must be 2 to 100 characters.");
  }

  return name;
}

function checkEmail(value) {
  const email = clean(value).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    throw new HttpError(400, "Please enter a valid email address.");
  }

  return email;
}

function checkRole(value) {
  const role = ROLES.find((item) => item.toLowerCase() === clean(value).toLowerCase());

  if (!role) throw new HttpError(400, "Role must be Student, Faculty or Admin.");
  return role;
}

function checkPassword(value) {
  const password = typeof value === "string" ? value : "";

  if (password.length < 8 || password.length > 72) {
    throw new HttpError(400, "The password must be 8 to 72 characters.");
  }

  return password;
}

function checkStatus(value) {
  if (value === undefined || value === null || value === "") return ACTIVE;

  const status = clean(value).toLowerCase();
  if (status === "active") return ACTIVE;
  if (status === "inactive") return INACTIVE;

  throw new HttpError(400, "Status must be Active or Inactive.");
}

// Supabase can refuse a password that breaks the project's password rules.
// Its message only explains the rule, so it is safe to pass on.
function passwordError(error, fallback) {
  const rule =
    error?.code === "weak_password" ||
    (error?.status === 422 && /password/i.test(error?.message || ""));

  return rule
    ? new HttpError(400, `That password was refused: ${error.message}`)
    : new HttpError(502, fallback);
}

async function profileRow(userId) {
  const { data, error } = await db()
    .from("users")
    .select("user_id, full_name, email, role, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(502, "Could not read the users table.");
  if (!data) throw new HttpError(404, "That user was not found.");

  return data;
}

// Switches a user between Active and Inactive. The status column is what
// login.js and authorize.js check; the login account is blocked as well.
async function applyStatus(row, account, active, caller) {
  if (!active && String(row.email).toLowerCase() === caller.email) {
    throw new HttpError(400, "You can't disable your own account.");
  }

  // Enabling: lift the block first, so nobody is left locked out.
  if (active && account && BAN_DISABLED_USERS) {
    const lifted = await db().auth.admin.updateUserById(account.id, {
      ban_duration: "none"
    });

    if (lifted.error) throw new HttpError(502, "The account could not be re-enabled.");
  }

  const saved = await db()
    .from("users")
    .update({ status: active ? ACTIVE : INACTIVE })
    .eq("user_id", row.user_id);

  if (saved.error) throw new HttpError(502, "The account could not be updated.");

  if (!active && account && BAN_DISABLED_USERS) {
    const blocked = await db().auth.admin.updateUserById(account.id, {
      ban_duration: BAN_FOR
    });

    if (blocked.error) console.error("Could not block the login:", blocked.error.message);
  }
}

/* ---------- Actions ---------- */

const actions = {
  async list() {
    const { data, error } = await db()
      .from("users")
      .select("user_id, full_name, email, role, status")
      .order("full_name", { ascending: true })
      .limit(2000);

    if (error) throw new HttpError(502, "Could not read the users table.");

    const accounts = new Map();
    (await listAuthUsers()).forEach((account) =>
      accounts.set(String(account.email || "").toLowerCase(), account)
    );

    // Only these fields ever leave the server.
    const users = data.map((row) => {
      const account = accounts.get(String(row.email || "").toLowerCase());

      return {
        user_id: row.user_id,
        full_name: row.full_name,
        email: row.email,
        role: row.role,
        status: row.status,
        disabled: row.status !== ACTIVE,
        has_login: Boolean(account),
        last_sign_in_at: account?.last_sign_in_at || null
      };
    });

    return { users };
  },

  async create(input) {
    const userId = checkUserId(input.user_id);
    const fullName = checkName(input.full_name);
    const email = checkEmail(input.email);
    const role = checkRole(input.role);
    const password = checkPassword(input.password);
    const status = checkStatus(input.status);

    const taken = await db()
      .from("users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (taken.data) throw new HttpError(409, "That User ID is already in use.");

    const created = await db().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: fullName, user_id: userId }
    });

    if (created.error || !created.data?.user) {
      if (created.error?.code === "weak_password") {
        throw passwordError(created.error, "The login account could not be created.");
      }

      const code = created.error?.code || "";
      const exists =
        code === "email_exists" ||
        created.error?.status === 422 ||
        created.error?.status === 409;

      throw new HttpError(
        exists ? 409 : 502,
        exists
          ? "A login account with that email already exists."
          : "The login account could not be created."
      );
    }

    const saved = await db().from("users").insert({
      user_id: userId,
      full_name: fullName,
      email,
      role,
      status
    });

    if (saved.error) {
      console.error("Profile insert failed:", saved.error.message);

      // Don't leave a login account without a profile behind.
      await db().auth.admin.deleteUser(created.data.user.id);
      throw new HttpError(502, "The profile could not be saved, so nothing was created.");
    }

    // Created as Inactive: also block the login account.
    if (status === INACTIVE && BAN_DISABLED_USERS) {
      const blocked = await db().auth.admin.updateUserById(created.data.user.id, {
        ban_duration: BAN_FOR
      });

      if (blocked.error) console.error("Could not block the login:", blocked.error.message);
    }

    return { ok: true };
  },

  async update(input, caller) {
    const userId = checkUserId(input.user_id);
    const fullName = checkName(input.full_name);
    const role = checkRole(input.role);
    const status = input.status === undefined ? null : checkStatus(input.status);

    const row = await profileRow(userId);

    if (String(row.email).toLowerCase() === caller.email && role !== "Admin") {
      throw new HttpError(400, "You can't remove your own admin role.");
    }

    const saved = await db()
      .from("users")
      .update({ full_name: fullName, role })
      .eq("user_id", userId);

    if (saved.error) throw new HttpError(502, "The changes could not be saved.");

    // Keep the login account's details in step (best effort).
    const account = await findAuthUser(row.email);

    if (account) {
      const synced = await db().auth.admin.updateUserById(account.id, {
        app_metadata: { ...(account.app_metadata || {}), role },
        user_metadata: { ...(account.user_metadata || {}), full_name: fullName }
      });

      if (synced.error) console.error("Metadata sync failed:", synced.error.message);
    }

    if (status && (status === ACTIVE) !== (row.status === ACTIVE)) {
      await applyStatus(row, account, status === ACTIVE, caller);
    }

    return { ok: true };
  },

  async set_password(input) {
    const userId = checkUserId(input.user_id);
    const password = checkPassword(input.password);

    const row = await profileRow(userId);
    const account = await findAuthUser(row.email);

    if (!account) throw new HttpError(404, "This user has no login account.");

    const result = await db().auth.admin.updateUserById(account.id, { password });

    if (result.error) throw passwordError(result.error, "The password could not be changed.");
    return { ok: true };
  },

  async set_active(input, caller) {
    const userId = checkUserId(input.user_id);
    const active = input.active === true;

    const row = await profileRow(userId);
    const account = BAN_DISABLED_USERS ? await findAuthUser(row.email) : null;

    await applyStatus(row, account, active, caller);
    return { ok: true };
  }
};

/* ---------- Entry point ---------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ message: "Method not allowed." });
    }

    // Same guard as the rest of the API: signed in, Active, role Admin.
    const result = await authorize(req, ["Admin"]);

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    const caller = { email: String(result.user.email || "").toLowerCase() };

    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const action = Object.prototype.hasOwnProperty.call(actions, body.action)
      ? actions[body.action]
      : null;

    if (!action) return res.status(400).json({ message: "Unknown action." });

    return res.status(200).json(await action(body, caller));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error("admin-users failed:", error);
    return res.status(500).json({ message: "Something went wrong on the server." });
  }
     } 
