
(() => {
    "use strict";

    const SUPABASE_URL =
        "https://lrlzlzfulcajbuqeufym.supabase.co";

    // This is the public publishable key, not the secret key.
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

    // Initialize the browser's Supabase client.
    if (!window.supabase?.createClient) {
        showMessage(
            "Authentication library failed to load. Refresh the page.",
            "error"
        );
    } else {
        const supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        // Show or hide password.
        togglePassword.addEventListener("click", () => {
            const showing = passwordInput.type === "text";

            passwordInput.type = showing ? "password" : "text";
            togglePassword.textContent = showing ? "Show" : "Hide";
        });

        // Submit login credentials to the server.
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
                // 1. Send UserID and password to Vercel.
                const response = await fetch("/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({ userId, password })
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

                // 2. Establish the Supabase session in the browser.
                const { error: sessionError } =
                    await supabaseClient.auth.setSession({
                        access_token: result.session.access_token,
                        refresh_token: result.session.refresh_token
                    });

                if (sessionError) {
                    throw sessionError;
                }

                // 3. Display the authenticated user's profile.
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
    }
})();
