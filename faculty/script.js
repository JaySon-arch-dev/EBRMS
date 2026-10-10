
const SUPABASE_URL = "https://lrlzlzfulcajbuqeufym.supabase.co";
const SUPABASE_KEY = "sb_publishable_zVdMyZmwz8NnOo4YHqY9pg_JSoMivtn";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("authTestButton");
  const message = document.getElementById("authTestMessage");

  button.addEventListener("click", async () => {
    button.disabled = true;
    message.textContent = "Testing authorization...";

    try {
      const { data, error } =
        await supabaseClient.auth.getSession();

      if (error) {
        throw error;
      }

      if (!data.session?.access_token) {
        message.textContent =
          "No active session found. Please log in again.";
        return;
      }

      const response = await fetch("/api/auth-check", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      });

      const result = await response.json();

      message.textContent =
        `HTTP ${response.status}: ${result.message}` +
        (result.user
          ? ` | User: ${result.user.user_id}` +
            ` | Role: ${result.user.role}`
          : "");
    } catch (error) {
      console.error("Authorization test failed:", error);
      message.textContent =
        `Error: ${error.message || String(error)}`;
    } finally {
      button.disabled = false;
    }
  });
});
