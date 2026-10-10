
const SUPABASE_URL =
  "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_zVdMyZmwz8nOo4YHqY9pg_JSoMivtn";

const EXPECTED_ROLE = "Student";

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
      return;
    }

    const response = await fetch("/api/auth-check", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      window.location.replace("/login/");
      return;
    }

    const result = await response.json();

    if (!result.user || result.user.role !== EXPECTED_ROLE) {
      window.location.replace("/login/");
      return;
    }

    // Reveal the dashboard only after authorization succeeds.
    document.body.style.visibility = "visible";

    console.log("Student dashboard authorized.");
  } catch (error) {
    console.error("Dashboard authorization failed:", error);
    window.location.replace("/login/");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  checkDashboardAccess();
});
