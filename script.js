const SUPABASE_URL = "https://lrlzlzfulcajbuqeufym.supabase.co";
const SUPABASE_KEY = "const SUPABASE_URL = "https://lrlzlzfulcajbuqeufym.supabase.co";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function testDatabase() {
    const { data, error } = await supabaseClient
        .from("users")
        .select("*");

    if (error) {
        console.error("Database error:", error);
        return;
    }

    console.log("Users from Supabase:", data);
}

testDatabase(); ";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function testDatabase() {
    const { data, error } = await supabaseClient
        .from("users")
        .select("*");

    if (error) {
        console.error("Database error:", error);
        return;
    }

    console.log("Users from Supabase:", data);
}

testDatabase();
