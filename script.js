
(() => {
    "use strict";

    const SUPABASE_URL =
        "https://lrlzlzfulcajbuqeufym.supabase.co";

    // Public publishable key only. Never expose the secret key here.
    const SUPABASE_KEY =
        "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

    // Dashboard routes based on the role returned by the login API.
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

    function showMessage(text, type = "") {
        message.textContent = text;
        message.className = type
            ? `message ${type}`
            : "message";
    }

    function setLoading(loading) {
        loginButton.disabled = loading;
        loginButton.textContent = loading
            ? "Checking..."
            : "Login";
    }

    // Verify that the expected login form elements exist.
    if (
        !loginForm ||
        !userIdInput ||
        !passwordInput ||
        !togglePassword ||
        !loginButton ||
        !message
    ) {
        console.error(
            "Login initialization failed: required HTML elements are missing."
        );
        return;
    }

    // Initialize Supabase.
    if (!window.supabase?.createClient) {
        showMessage(
            "Authentication library failed to load. Please refresh the page.",
            "error"
        );
        return;
    }

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    // Toggle password visibility.
    togglePassword.addEventListener("click", () => {
        const isHidden = passwordInput.type === "password";

        passwordInput.type = isHidden ? "text" : "password";
        togglePassword.textContent = isHidden ? "Hide" : "Show";
    });

    // Handle login form submission.
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (loginButton.disabled) return;

        const userId = userIdInput.value.trim();
        const password = passwordInput.value;

        showMessage("");

        if (!userId || !password) {
            showMessage(
                "Please enter your User ID and password.",
                "warning"
            );
            return;
        }

        setLoading(true);
        showMessage("Verifying credentials...", "warning");

        try {
            // 1. Authenticate through the server-side login API.
            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    userId,
                    password
                })
            });

            const result = await response.json().catch(() => null);

            if (!response.ok) {
                showMessage(
                    result?.message ||
                        `Login failed (HTTP ${response.status}).`,
                    "error"
                );
                return;
            }

            // 2. Validate the returned session and user profile.
            if (
                !result?.session?.access_token ||
                !result?.session?.refresh_token ||
                !result?.user?.user_id ||
                !result?.user?.role
            ) {
                throw new Error(
                    "The login API returned an incomplete response."
                );
            }

            // 3. Establish the Supabase session in the browser.
            const { error: sessionError } =
                await supabaseClient.auth.setSession({
                    access_token: result.session.access_token,
                    refresh_token: result.session.refresh_token
                });

            if (sessionError) {
                throw sessionError;
            }

            // 4. Determine the dashboard using the verified profile role.
            const destination = roleRoutes[result.user.role];

            if (!destination) {
                await supabaseClient.auth.signOut();

                showMessage(
                    "Your account has no valid role assigned.",
                    "error"
                );
                return;
            }

            // 5. Redirect to the corresponding dashboard.
            window.location.replace(destination);

        } catch (error) {
            console.error("Login flow failed:", error);

            showMessage(
                "Unable to complete login. Check your connection and try again.",
                "error"
            );
        } finally {
            setLoading(false);
        }
    });
})();
