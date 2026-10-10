
(() => {
    "use strict";

    document.addEventListener("DOMContentLoaded", initializeLogin);

    function initializeLogin() {
        const loginForm = document.getElementById("loginForm");
        const userIdInput = document.getElementById("userId");
        const passwordInput = document.getElementById("password");
        const togglePassword = document.getElementById("togglePassword");
        const loginButton = document.getElementById("loginButton");
        const message = document.getElementById("message");
        const userInfo = document.getElementById("userInfo");
        const displayName = document.getElementById("displayName");
        const displayRole = document.getElementById("displayRole");

        const requiredElements = [
            loginForm,
            userIdInput,
            passwordInput,
            togglePassword,
            loginButton,
            message,
            userInfo,
            displayName,
            displayRole
        ];

        if (requiredElements.some(element => !element)) {
            console.error("Login initialization failed: HTML element missing.");
            return;
        }

        // The publishable key is safe for browser-side use.
        const SUPABASE_URL =
            "https://lrlzlzfulcajbuqeufym.supabase.co";

        const SUPABASE_KEY =
            "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

        if (!window.supabase?.createClient) {
            showMessage(
                "The authentication library failed to load. Reload the page.",
                "error"
            );
            return;
        }

        const supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

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

        togglePassword.addEventListener("click", () => {
            const showing = passwordInput.type === "text";

            passwordInput.type = showing ? "password" : "text";
            togglePassword.textContent = showing ? "Show" : "Hide";
        });

        loginForm.addEventListener("submit", async event => {
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
            showMessage("Verifying your credentials...", "warning");

            try {
                // All UserID lookup and password verification happen server-side.
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
                    throw new Error("The server returned an incomplete login response.");
                }

                // Establish the session in the browser's Supabase client.
                const { error: sessionError } =
                    await supabaseClient.auth.setSession({
                        access_token: result.session.access_token,
                        refresh_token: result.session.refresh_token
                    });

                if (sessionError) {
                    throw sessionError;
                }

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

        // Verify that the client is initialized without exposing credentials.
        console.info("EBRMS login module initialized.");
    }
})();
