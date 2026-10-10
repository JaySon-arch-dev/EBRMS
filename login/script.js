
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

const loginForm = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginButton = document.getElementById("loginButton");
const message = document.getElementById("message");

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
}

togglePassword.addEventListener("click", () => {
    const showing = passwordInput.type === "password";

    passwordInput.type = showing ? "text" : "password";
    togglePassword.textContent = showing ? "Hide" : "Show";
    togglePassword.setAttribute("aria-pressed", String(showing));
    togglePassword.setAttribute(
        "aria-label",
        showing ? "Hide password" : "Show password"
    );
});

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
    loginButton.textContent = "Checking...";

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

        // Navigate to the dashboard for the user's role.
        window.location.replace(destination);

    } catch (error) {
        console.error("Login request failed:", error.message);

        showMessage(
            "Unable to connect to the login service. Please try again."
        );
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});
