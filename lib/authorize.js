
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const authClient = createClient(
  supabaseUrl,
  publishableKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

const adminClient = createClient(
  supabaseUrl,
  secretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export async function authorize(req, allowedRoles = []) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required."
    };
  }

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token);

  if (authError || !authData.user?.email) {
    return {
      ok: false,
      status: 401,
      message: "Invalid or expired session."
    };
  }

  const { data: profile, error: profileError } =
    await adminClient
      .from("users")
      .select("user_id, full_name, email, role, status")
      .eq("email", authData.user.email)
      .maybeSingle();

  if (profileError) {
    console.error("Profile authorization lookup failed:",
      profileError.message);

    return {
      ok: false,
      status: 500,
      message: "Unable to verify account permissions."
    };
  }

  if (!profile) {
    return {
      ok: false,
      status: 403,
      message: "No EBRMS profile is associated with this account."
    };
  }

  if (profile.status !== "Active") {
    return {
      ok: false,
      status: 403,
      message: "Your account is inactive."
    };
  }

  if (
    !["Student", "Faculty", "Admin"].includes(profile.role)
  ) {
    return {
      ok: false,
      status: 403,
      message: "Invalid account role."
    };
  }

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(profile.role)
  ) {
    return {
      ok: false,
      status: 403,
      message: "You are not authorized to perform this action."
    };
  }

  return {
    ok: true,
    user: {
      user_id: profile.user_id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role
    }
  };
}
