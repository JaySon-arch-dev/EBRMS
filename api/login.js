
const { createClient } = require("@supabase/supabase-js");

module.exports = async function login(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({
            message: "Method not allowed."
        });
    }

    const { userId, password } = req.body || {};

    if (
        typeof userId !== "string" ||
        typeof password !== "string" ||
        !userId.trim() ||
        !password
    ) {
        return res.status(400).json({
            message: "User ID and password are required."
        });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !secretKey || !publishableKey) {
        console.error("Missing required Supabase environment variables.");

        return res.status(500).json({
            message: "Server authentication configuration error."
        });
    }

    try {
        // Server-only client for the profile lookup.
        const adminClient = createClient(
            supabaseUrl,
            secretKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );

        const { data: profile, error: lookupError } =
            await adminClient
                .from("users")
                .select("user_id, full_name, email, role, status")
                .eq("user_id", userId.trim())
                .maybeSingle();

        if (lookupError) {
            console.error("User lookup failed:", lookupError.message);

            return res.status(500).json({
                message: "Unable to process login."
            });
        }

        // Use a generic response for unknown IDs and wrong passwords.
        if (!profile || !profile.email) {
            return res.status(401).json({
                message: "Incorrect User ID or password."
            });
        }

        if (profile.status !== "Active") {
            return res.status(403).json({
                message: "This account is inactive."
            });
        }

        // A fresh Auth client per request avoids sharing session state.
        const authClient = createClient(
            supabaseUrl,
            publishableKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );

        const { data: authData, error: authError } =
            await authClient.auth.signInWithPassword({
                email: profile.email,
                password
            });

        if (authError || !authData.session || !authData.user) {
            return res.status(401).json({
                message: "Incorrect User ID or password."
            });
        }

        // Ensure the Auth identity matches the email on the profile.
        if (
            authData.user.email?.toLowerCase() !==
            profile.email.toLowerCase()
        ) {
            return res.status(401).json({
                message: "Unable to authenticate this account."
            });
        }

        return res.status(200).json({
            message: "Login successful.",
            session: {
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token
            },
            user: {
                user_id: profile.user_id,
                full_name: profile.full_name,
                role: profile.role
            }
        });
    } catch (error) {
        console.error("Login endpoint error:", error.message);

        return res.status(500).json({
            message: "An unexpected login error occurred."
        });
    }
};
