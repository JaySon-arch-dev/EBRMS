
const SUPABASE_URL =
  "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

// Set this separately in each dashboard.
const EXPECTED_ROLE = "Admin";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

async function checkDashboardAccess() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error || !data.session?.access_token) {
      window.location.replace("/login/");
      return false;
    }

    const response = await fetch("/api/auth-check", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`
      },
      cache: "no-store"
    });

    const result = await response.json();

    if (
      !response.ok ||
      result.user?.role !== EXPECTED_ROLE
    ) {
      window.location.replace("/login/");
      return false;
    }

    // The session and expected role passed the check.
    document.body.classList.add("authorized");
    return true;

  } catch (error) {
    console.error("Dashboard access check failed:", error);
    window.location.replace("/login/");
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.remove("authorized");

  const allowed = await checkDashboardAccess();

  if (!allowed) return;

  // Initialize dashboard features here, after access is checked.
  console.log(`${EXPECTED_ROLE} dashboard authorized.`);
});
