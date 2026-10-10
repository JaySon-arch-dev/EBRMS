
(() => {
    "use strict";

    const SUPABASE_URL =
        "https://lrlzlzfulcajbuqeufym.supabase.co";

    // Public publishable key. Never put the secret key here.
    const SUPABASE_KEY =
        "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

    const loginForm = document.getElementById("loginForm");
    const userIdInput = document.getElementById("userId");
    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");
    const loginButton = document.getElementById("loginButton");
    const message = document.getElementById("message");
    const userInfo = document.getElementById("userInfo");
    const displayName = document.getElementById("displayName");
    const displayRole = document.getElementById("displayRole");

    function showMessage(text, type = "") {
        message.textContent = text;
        message.className = type ? `message ${type}` : "message";
    }

    function setLoading(loading) {
        loginButton.disabled = loading;
        loginButton.textContent = loading ? "Checking..." : "Login";
    }

    // Check that the required HTML elements exist.
    if (
        !loginForm ||
        !userIdInput ||
        !passwordInput ||
        !togglePassword ||
        !loginButton ||
        !message ||
        !userInfo ||
        !displayName ||
        !displayRole
    ) {
        console.error("One or more login form elements are missing.");
        return;
    }

    // Initialize the browser Supabase client.
    if (!window.supabase?.createClient) {
        showMessage(
            "Authentication library failed to load. Refresh the page.",
            "error"
        );
        return;
    }

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    // Show or hide the password.
    togglePassword.addEventListener("click", () => {
        const showing = passwordInput.type === "text";

        passwordInput.type = showing ? "password" : "text";
        togglePassword.textContent = showing ? "Show" : "Hide";
    });

    // Handle login submission.
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (loginButton.disabled) return;

        const userId = userIdInput.value.trim();
        const password = passwordInput.value;

        showMessage("");
        userInfo.classList.add("hidden");

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
            // Step 1: Send credentials to the Vercel API.
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

            if (
                !result?.session?.access_token ||
                !result?.session?.refresh_token ||
                !result?.user
            ) {
                throw new Error(
                    "Incomplete authentication response."
                );
            }

            // Step 2: Establish the Supabase session in the browser.
            const { error: sessionError } =
                await supabaseClient.auth.setSession({
                    access_token: result.session.access_token,
                    refresh_token: result.session.refresh_token
                });

            if (sessionError) {
                throw sessionError;
            }

            // Step 3: Display the authenticated user's information.
            displayName.textContent = result.user.full_name;
            displayRole.textContent = result.user.role;

            userInfo.classList.remove("hidden");
            passwordInput.value = "";

            showMessage("Login successful!", "success");

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
