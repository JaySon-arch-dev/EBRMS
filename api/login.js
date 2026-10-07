const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

module.exports = async (req, res) => {

    if (req.method !== "POST") {
        return res.status(405).json({
            message: "Method not allowed"
        });
    }

    const { userId, password } = req.body;

    if (!userId || !password) {
        return res.status(400).json({
            message: "User ID and Password are required."
        });
    }

    const { data, error } = await supabase
        .from("users")
        .select(
            "user_id, full_name, password, role, status"
        )
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error(error);

        return res.status(500).json({
            message: "Database error."
        });
    }

    if (!data || data.password !== password) {
        return res.status(401).json({
            message: "Incorrect User ID or Password."
        });
    }

    if (data.status !== "Active") {
        return res.status(403).json({
            message: "This account is inactive."
        });
    }

    return res.status(200).json({
        authenticated: true,
        user: {
            user_id: data.user_id,
            full_name: data.full_name,
            role: data.role
        }
    });
};
