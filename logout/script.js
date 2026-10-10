
const SUPABASE_URL =
  "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_zVdMyZmwz8nOo4YHqY9pg_JSoMivtn";

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

const logoutTitle = document.getElementById("logoutTitle");
const logoutMessage = document.getElementById("logoutMessage");
const retryButton = document.getElementById("retryButton");
const loginLink = document.getElementById("loginLink");

let isSigningOut = false;

async function signOutUser() {
  if (isSigningOut) return;

  isSigningOut = true;
  retryButton.hidden = true;
  loginLink.hidden = true;
  retryButton.disabled = true;

  logoutTitle.textContent = "Signing you out...";
  logoutMessage.textContent =
    "Please wait while we end your session.";

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    logoutTitle.textContent = "Signed out successfully";
    logoutMessage.textContent =
      "Your session has ended. Returning to login...";

    // Replace this page so the Back button doesn't return
    // to the logout screen as an active dashboard.
    window.location.replace("/login/");
  } catch (error) {
    console.error("Sign-out failed:", error);

    logoutTitle.textContent = "Unable to sign out";
    logoutMessage.textContent =
      "We couldn't confirm that your session ended. Please try again.";

    retryButton.hidden = false;
    loginLink.hidden = false;
  } finally {
    isSigningOut = false;
    retryButton.disabled = false;
  }
}

retryButton.addEventListener("click", signOutUser);

// Visiting /logout/ explicitly initiates sign-out.
document.addEventListener("DOMContentLoaded", signOutUser);
