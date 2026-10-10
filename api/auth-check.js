
import { authorize } from "../lib/authorize.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      message: "Method not allowed."
    });
  }

  try {
    const result = await authorize(req);

    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message
      });
    }

    return res.status(200).json({
      message: "Authorization check successful.",
      user: {
        user_id: result.user.user_id,
        full_name: result.user.full_name,
        role: result.user.role
      }
    });
  } catch (error) {
    console.error("Authorization check failed:", error);

    return res.status(500).json({
      message: "An internal server error occurred."
    });
  }
}
