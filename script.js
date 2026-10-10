
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
        // Step 1: Send credentials to the Vercel backend.
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId: userId,
                password: password
            })
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
            throw new Error("Invalid login response.");
        }

        // Step 2: Save the authenticated Supabase session.
        const { error: sessionError } =
            await supabaseClient.auth.setSession({
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token
            });

        if (sessionError) {
            throw sessionError;
        }

        // Step 3: Display the authenticated user's profile.
        displayName.textContent = result.user.full_name;
        displayRole.textContent = result.user.role;
        userInfo.classList.remove("hidden");

        message.textContent = "Login successful!";
        message.className = "message success";

    } catch (error) {
        console.error("Login request failed:", error);

        message.textContent =
            "Unable to complete login. Please try again.";
        message.className = "message error";

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});
