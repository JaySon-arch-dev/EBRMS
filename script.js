// ========================================
// SUPABASE CONNECTION
// ========================================

const SUPABASE_URL =
const SUPABASE_URL =
    "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

// ========================================
// GET HTML ELEMENTS
// ========================================

const loginForm =
    document.getElementById("loginForm");

const userIdInput =
    document.getElementById("userId");

const passwordInput =
    document.getElementById("password");

const togglePassword =
    document.getElementById("togglePassword");

const loginButton =
    document.getElementById("loginButton");

const message =
    document.getElementById("message");

const userInfo =
    document.getElementById("userInfo");

const displayName =
    document.getElementById("displayName");

const displayRole =
    document.getElementById("displayRole");


// ========================================
// SHOW / HIDE PASSWORD
// ========================================

togglePassword.addEventListener(
    "click",
    function (event) {

        event.preventDefault();

        if (passwordInput.type === "password") {

            passwordInput.type = "text";

            togglePassword.textContent = "Hide";

        } else {

            passwordInput.type = "password";

            togglePassword.textContent = "Show";
        }

    }
);


// ========================================
// LOGIN
// ========================================

loginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        // Get input values

        const userId =
            userIdInput.value.trim();

        const password =
            passwordInput.value;


        // Clear previous messages

        message.textContent = "";

        message.className = "message";

        userInfo.classList.add("hidden");


        // ========================================
        // EMPTY INPUT
        // ========================================

        if (!userId || !password) {

            message.textContent =
                "Please enter your User ID and Password.";

            message.className =
                "message warning";

            return;
        }


        // ========================================
        // LOADING
        // ========================================

        loginButton.disabled = true;

        loginButton.textContent =
            "Checking...";


        // ========================================
        // QUERY USERS TABLE
        // ========================================

        const {
            data,
            error
        } = await supabaseClient
            .from("users")
            .select(
                "user_id, full_name, password, role, status"
            )
            .eq("user_id", userId)
            .maybeSingle();


        // ========================================
        // DATABASE ERROR
        // ========================================

        if (error) {

            console.error(
                "Supabase error:",
                error
            );

            message.textContent =
                "Unable to connect to the database.";

            message.className =
                "message error";

            loginButton.disabled = false;

            loginButton.textContent =
                "Login";

            return;
        }


        // ========================================
        // USER NOT FOUND
        // ========================================

        if (!data) {

            message.textContent =
                "Incorrect User ID or Password.";

            message.className =
                "message error";

            loginButton.disabled = false;

            loginButton.textContent =
                "Login";

            return;
        }


        // ========================================
        // PASSWORD CHECK
        // ========================================

        if (data.password !== password) {

            message.textContent =
                "Incorrect User ID or Password.";

            message.className =
                "message error";

            loginButton.disabled = false;

            loginButton.textContent =
                "Login";

            return;
        }


        // ========================================
        // ACCOUNT STATUS
        // ========================================

        if (data.status !== "Active") {

            message.textContent =
                "This account is inactive.";

            message.className =
                "message error";

            loginButton.disabled = false;

            loginButton.textContent =
                "Login";

            return;
        }


        // ========================================
        // SUCCESS
        // ========================================

        message.textContent =
            "Login successful!";

        message.className =
            "message success";


        displayName.textContent =
            data.full_name;

        displayRole.textContent =
            data.role;

        userInfo.classList.remove("hidden");


        console.log(
            "Logged in user:",
            data
        );


        // ========================================
        // RESET BUTTON
        // ========================================

        loginButton.disabled = false;

        loginButton.textContent =
            "Login";

    }
);
