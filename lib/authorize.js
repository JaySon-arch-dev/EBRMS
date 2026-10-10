
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

// Used to verify the user's access token.
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

// Used only on the server to retrieve EBRMS profiles.
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
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required."
    };
  }

  // Verify the token with Supabase Auth.
  const { data: authData, error: authError } =
    await authClient.auth.getUser(token);

  if (authError || !authData.user?.email) {
    return {
      ok: false,
      status: 401,
      message: "Invalid or expired session."
    };
  }

  // Retrieve the current EBRMS profile.
  const { data: profile, error: profileError } =
    await adminClient
      .from("users")
      .select("user_id, full_name, email, role, status")
      .eq("email", authData.user.email)
      .maybeSingle();

  if (profileError) {
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
    user: profile
  };
      }
