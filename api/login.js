
const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
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
            message: "Enter your User ID and password."
        });
    }

    const url = process.env.SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !secret || !publishable) {
        console.error("Missing Supabase environment configuration.");

        return res.status(500).json({
            message: "Server configuration error."
        });
    }

    try {
        // 1. Look up the profile using the UserID.
        const admin = createClient(url, secret, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        const { data: profile, error: lookupError } = await admin
            .from("users")
            .select("user_id, full_name, email, role")
            .eq("user_id", userId.trim())
            .maybeSingle();

        if (lookupError) {
            console.error("Profile lookup failed:", lookupError.message);

            return res.status(500).json({
                message: "Unable to process login."
            });
        }

        if (!profile || !profile.email) {
            return res.status(401).json({
                message: "Incorrect User ID or password."
            });
        }

        // 2. Verify the password through Supabase Auth.
        const auth = createClient(url, publishable, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        const { data, error } = await auth.auth.signInWithPassword({
            email: profile.email,
            password
        });

        
if (error || !data.user || !data.session) {
    console.error("Supabase Auth diagnostic:", {
        code: error?.code,
        status: error?.status,
        message: error?.message
    });

    return res.status(401).json({
        message: "Incorrect User ID or password."
    });
}
        // 3. Confirm that the authenticated email matches the profile.
        if (
            !data.user.email ||
            data.user.email.toLowerCase() !==
                profile.email.toLowerCase()
        ) {
            return res.status(401).json({
                message: "Unable to authenticate this account."
            });
        }

        // 4. Return the session and basic profile information.
        return res.status(200).json({
            message: "Login successful.",
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            },
            user: {
                user_id: profile.user_id,
                full_name: profile.full_name,
                role: profile.role
            }
        });

    } catch (error) {
        console.error("Login API error:", error.message);

        return res.status(500).json({
            message: "An unexpected login error occurred."
        });
    }
};
