const SUPABASE_URL =
    "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
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


// Show / Hide Password
togglePassword.addEventListener("click", function () {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";
        togglePassword.textContent = "Hide";

    } else {

        passwordInput.type = "password";
        togglePassword.textContent = "Show";
    }
});


// Login
loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    // Reset messages
    message.textContent = "";
    message.className = "message";

    userInfo.classList.add("hidden");

    // Check empty fields
    if (!userId || !password) {

        message.textContent =
            "Please enter your User ID and Password.";

        message.className = "message warning";

        return;
    }

    // Disable login button
    loginButton.disabled = true;
    loginButton.textContent = "Checking...";


    try {

        // Step 1:
        // Find the User ID and its email
        const { data: userData, error: userError } =
            await supabaseClient
                .from("users")
                .select("user_id, full_name, email, role, status")
                .eq("user_id", userId)
                .maybeSingle();


        if (userError) {

            console.error("User lookup error:", userError);

            message.textContent =
                "Unable to connect to the database.";

            message.className = "message error";

            return;
        }


        // User ID doesn't exist
        if (!userData) {

            message.textContent =
                "Incorrect User ID or Password.";

            message.className = "message error";

            return;
        }


        // Check account status
        if (userData.status !== "Active") {

            message.textContent =
                "This account is inactive.";

            message.className = "message error";

            return;
        }


        // Make sure an email exists
        if (!userData.email) {

            message.textContent =
                "This account is not configured for login.";

            message.className = "message error";

            return;
        }


        // Step 2:
        // Let Supabase Auth verify the password
        const { data: authData, error: authError } =
            await supabaseClient.auth.signInWithPassword({

                email: userData.email,
                password: password

            });


        // Wrong password
        if (authError) {

            console.error("Authentication error:", authError);

            message.textContent =
                "Incorrect User ID or Password.";

            message.className = "message error";

            return;
        }


        // Step 3:
        // Authentication successful
        console.log("Authenticated user:", authData.user);


        message.textContent =
            "Login successful!";

        message.className = "message success";


        // Display user information
        displayName.textContent =
            userData.full_name;

        displayRole.textContent =
            userData.role;

        userInfo.classList.remove("hidden");


        // Store basic session information
        console.log("User ID:", userData.user_id);
        console.log("Name:", userData.full_name);
        console.log("Role:", userData.role);


    } catch (error) {

        console.error("Unexpected error:", error);

        message.textContent =
            "Something went wrong. Please try again.";

        message.className = "message error";

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }

});
