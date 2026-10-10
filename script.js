
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

const loginForm = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginButton = document.getElementById("loginButton");
const message = document.getElementById("message");
const userInfo = document.getElementById("userInfo");
const displayName = document.getElementById("displayName");
const displayRole = document.getElementById("displayRole");

// Show / hide password
togglePassword.addEventListener("click", function () {
    const showing = passwordInput.type === "password";

    passwordInput.type = showing ? "text" : "password";
    togglePassword.textContent = showing ? "Hide" : "Show";
});

// Login through the server API
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    message.textContent = "";
    message.className = "message";
    userInfo.classList.add("hidden");

    if (!userId || !password) {
        message.textContent =
            "Please enter your User ID and Password.";
        message.className = "message warning";
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
            body: JSON.stringify({
                userId,
                password
            }),
            cache: "no-store"
        });

        const result = await response.json();

        if (!response.ok) {
            message.textContent =
                result.message || "Login failed.";
            message.className = "message error";
            return;
        }

        if (
            !result.session?.access_token ||
            !result.session?.refresh_token ||
            !result.user
        ) {
            console.error("Invalid login API response.");

            message.textContent =
                "Unable to complete login. Please try again.";
            message.className = "message error";
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

            message.textContent =
                "Login succeeded, but the session could not be saved.";
            message.className = "message error";
            return;
        }

        displayName.textContent = result.user.full_name;
        displayRole.textContent = result.user.role;

        userInfo.classList.remove("hidden");

        message.textContent = "Login successful!";
        message.className = "message success";

    } catch (error) {
        console.error("Login request failed:", error.message);

        message.textContent =
            "Unable to connect to the login service.";
        message.className = "message error";

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});
