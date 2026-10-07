console.log("1. script.js loaded");

console.log("2. Supabase library:", window.supabase);

const SUPABASE_URL =
    "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

console.log("3. Supabase client created");

async function testDatabase() {

    console.log("4. Testing users table...");

    const {
        data,
        error
    } = await supabaseClient
        .from("users")
        .select("user_id, full_name, role, status");

    console.log("5. Database response:");

    console.log("Data:", data);
    console.log("Error:", error);

    if (error) {

        alert(
            "Database connection failed:\n" +
            error.message
        );

        return;
    }

    alert(
        "Database connection works!\n\n" +
        "Users found: " +
        data.length
    );
}

testDatabase();
