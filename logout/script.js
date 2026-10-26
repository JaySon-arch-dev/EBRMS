/* =========================================================
   SAVE AS: /logout/script.js
   Replaces the existing /logout/script.js in your project.
   ========================================================= */

const SUPABASE_URL =
  "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

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

const logoutCard = document.getElementById("logoutCard");
const logoutTitle = document.getElementById("logoutTitle");
const logoutMessage = document.getElementById("logoutMessage");
const retryButton = document.getElementById("retryButton");
const loginLink = document.getElementById("loginLink");

let isSigningOut = false;

// The card's data-state ("loading", "success" or "error")
// controls which status icon the CSS shows.
function setState(state, title, message) {
  logoutCard.dataset.state = state;
  logoutTitle.textContent = title;
  logoutMessage.textContent = message;
}

async function signOutUser() {
  if (isSigningOut) return;

  isSigningOut = true;
  retryButton.hidden = true;
  loginLink.hidden = true;
  retryButton.disabled = true;

  setState(
    "loading",
    "Signing you out...",
    "Please wait while we end your session."
  );

  try {
    /* ===== SESSION HANDLER (added): tell the other open tabs ===== */
    try {
      localStorage.setItem(
        "ebrms:logout",
        JSON.stringify({ t: Date.now(), reason: "signedout" })
      );
      localStorage.removeItem("ebrms:last-activity");
    } catch (storageError) {
      /* storage unavailable */
    }
    /* ===== END SESSION HANDLER ===== */

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    setState(
      "success",
      "Signed out successfully",
      "Your session has ended. Returning to login..."
    );

    // Replace this page so the Back button doesn't return
    // to the logout screen as an active dashboard.
    window.location.replace("/login/?reason=signedout");
  } catch (error) {
    console.error("Sign-out failed:", error);

    setState(
      "error",
      "Unable to sign out",
      "We couldn't confirm that your session ended. Please try again."
    );

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
