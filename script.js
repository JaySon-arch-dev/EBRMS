// ========================================
// SUPABASE CONNECTION
// ========================================

const SUPABASE_URL =
    "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ========================================
// GET HTML ELEMENTS
// ========================================

const loginForm = document.getElementById("loginForm");

const userIdInput = document.getElementById("userId");
const passwordInput = document.getElementById("password");

const togglePassword =
    document.getElementById("togglePassword");

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

togglePassword.addEventListener("click", function () {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";
        togglePassword.textContent = "Hide";

    } else {

        passwordInput.type = "password";
        togglePassword.textContent = "Show";

    }

});


// ========================================
// LOGIN
// ========================================

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    message.textContent = "";
    userInfo.classList.add("hidden");


    // Check that fields are not empty

    if (!userId || !password) {

        message.textContent =
            "Please enter your User ID and Password.";

        return;
    }


    // ========================================
    // QUERY SUPABASE
    // ========================================

    const { data, error } = await supabaseClient
        .from("users")
        .select("user_id, full_name, password, role, status")
        .eq("user_id", userId)
        .maybeSingle();


    // ========================================
    // DATABASE ERROR
    // ========================================

    if (error) {

        console.error("Supabase error:", error);

        message.textContent =
            "Unable to connect to the database.";

        return;
    }


    // ========================================
    // USER NOT FOUND
    // ========================================

    if (!data) {

        message.textContent =
            "Invalid User ID or Password.";

        return;
    }


    // ========================================
    // CHECK PASSWORD
    // ========================================

    if (data.password !== password) {

        message.textContent =
            "Invalid User ID or Password.";

        return;
    }


    // ========================================
    // CHECK ACCOUNT STATUS
    // ========================================

    if (data.status !== "Active") {

        message.textContent =
            "This account is inactive.";

        return;
    }


    // ========================================
    // LOGIN SUCCESSFUL
    // ========================================

    displayName.textContent = data.full_name;
    displayRole.textContent = data.role;

    userInfo.classList.remove("hidden");

    message.textContent = "Login successful.";

    console.log("Logged in user:", data);

});
