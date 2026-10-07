console.log("EBRMS script.js is running");

const SUPABASE_URL =
    "https://lrlzlzfulcajbuqeufym.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

console.log("Supabase library:", window.supabase);

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

console.log("Supabase client created successfully");
