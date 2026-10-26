/* =========================================================
   SAVE AS: /login/script.js
   Replaces the existing /login/script.js in your project.
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

const roleRoutes = {
    Student: "/student/",
    Faculty: "/faculty/",
    Admin: "/admin/"
};

/* ---------- DOM references ---------- */

const loginForm = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginButton = document.getElementById("loginButton");
const buttonText = loginButton.querySelector(".button-text");
const message = document.getElementById("message");

// True once login succeeded and the page is leaving.
let navigating = false;

/* ---------- Icons for the password toggle ---------- */

const EYE_ICON = `
    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
          stroke="currentColor" stroke-width="1.7"
          stroke-linejoin="round"/>
    <circle cx="12" cy="12" r="3"
            stroke="currentColor" stroke-width="1.7"/>
`;

const EYE_OFF_ICON = `
    <path d="M3 3l18 18"
          stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round"/>
    <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-3.2 4.1M6.6 6.6A15.7 15.7 0 0 0 2.5 12s3.5 7 9.5 7a9.3 9.3 0 0 0 4-.9"
          stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"/>
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
          stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round"/>
`;

const eyeIcon = togglePassword.querySelector(".eye-icon");

/* ---------- Helpers ---------- */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function shakeForm() {
    loginForm.classList.remove("is-shake");
    void loginForm.offsetWidth; // restart the animation
    loginForm.classList.add("is-shake");
}

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;

    if (type !== "success") shakeForm();
}

// Button turns green with a check, then the page fades away.
async function playSuccess() {
    if (prefersReducedMotion()) return;

    loginButton.classList.remove("is-loading");
    loginButton.classList.add("is-success");
    setButtonLabel("Welcome");

    await wait(650);
    document.body.classList.add("is-leaving");
    await wait(380);
}

function setButtonLabel(text) {
    // Only change the label; keep the arrow icon inside the button intact.
    buttonText.textContent = text;
}

/* =========================================================
   SESSION HANDLER (added): messages and auto-redirect
   ========================================================= */

const REASONS = {
    idle: "You were signed out because of inactivity.",
    expired: "Your session has expired. Please log in again.",
    signedout: "You have been signed out.",
    denied: "Your account no longer has access. Please contact the administrator.",
    error: "We could not verify your session. Please log in again."
};

// Shows why the user landed here (set by /shared-view/session.js).
function showReasonFromUrl() {
    const reason = new URLSearchParams(window.location.search).get("reason");

    if (!reason) return false;

    if (REASONS[reason]) {
        message.textContent = REASONS[reason];
        message.className =
            `message ${reason === "signedout" ? "success" : "warning"}`;
    }

    // Keep the address bar clean.
    window.history.replaceState(null, "", window.location.pathname);
    return true;
}

// Already signed in? Skip the form and open the dashboard.
async function redirectIfSignedIn() {
    try {
        const { data } = await supabaseClient.auth.getSession();
        const token = data && data.session && data.session.access_token;

        if (!token) return;

        const response = await fetch("/api/auth-check", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store"
        });

        if (!response.ok) return;

        const result = await response.json();
        const destination = roleRoutes[result.user && result.user.role];

        if (destination) window.location.replace(destination);
    } catch (error) {
        /* stay on the login page */
    }
}

if (!showReasonFromUrl()) redirectIfSignedIn();

/* ===== END SESSION HANDLER ===== */

/* ---------- Password visibility ---------- */

togglePassword.addEventListener("click", () => {
    const showing = passwordInput.type === "password";

    passwordInput.type = showing ? "text" : "password";

    // Swap the icon instead of replacing the button's content with text.
    eyeIcon.innerHTML = showing ? EYE_OFF_ICON : EYE_ICON;
    togglePassword.classList.toggle("is-visible", showing);

    togglePassword.setAttribute("aria-pressed", String(showing));
    togglePassword.setAttribute(
        "aria-label",
        showing ? "Hide password" : "Show password"
    );
});

/* ---------- Login ---------- */

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    message.textContent = "";
    message.className = "message";

    if (!userId || !password) {
        showMessage(
            "Please enter your User ID and password.",
            "warning"
        );
        return;
    }

    loginButton.disabled = true;
    loginButton.classList.add("is-loading");
    setButtonLabel("Checking...");

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ userId, password }),
            cache: "no-store"
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Login failed.");
            return;
        }

        if (
            !result.session?.access_token ||
            !result.session?.refresh_token ||
            !result.user?.user_id ||
            !result.user?.role
        ) {
            showMessage(
                "Unable to complete login. Please try again."
            );
            return;
        }

        const destination = roleRoutes[result.user.role];

        if (!destination) {
            showMessage("Your account has an invalid role.");
            return;
        }

        const { error: sessionError } =
            await supabaseClient.auth.setSession({
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token
            });

        if (sessionError) {
            console.error(
                "Session setup failed:",
                sessionError.message
            );

            showMessage(
                "Login succeeded, but the session could not be saved."
            );
            return;
        }

        // Open the dashboard for the user's role.
        /* ===== SESSION HANDLER (added): start the inactivity clock ===== */
        try {
            localStorage.setItem("ebrms:last-activity", String(Date.now()));
            localStorage.removeItem("ebrms:logout");
        } catch (error) {
            /* storage unavailable */
        }

        navigating = true;
        await playSuccess();
        window.location.replace(destination);

    } catch (error) {
        console.error("Login request failed:", error.message);

        showMessage(
            "Unable to connect to the login service. Please try again."
        );
    } finally {
        // After a successful login the page is leaving; keep the
        // success state instead of flashing back to "Login".
        if (!navigating) {
            loginButton.disabled = false;
            loginButton.classList.remove("is-loading");
            setButtonLabel("Login");
        }
    }
});

// Coming back with the Back button should not show the success state.
window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;

    navigating = false;
    document.body.classList.remove("is-leaving");
    loginButton.classList.remove("is-loading", "is-success");
    loginButton.disabled = false;
    setButtonLabel("Login");
});
