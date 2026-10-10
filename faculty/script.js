
document.addEventListener("DOMContentLoaded", () => {
    console.log("Dashboard loaded.");
});

async function testAuthorization() {
  const message = document.getElementById("authTestMessage");

  message.textContent = "Testing authorization...";

  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error || !data.session?.access_token) {
      message.textContent =
        "No active session found. Please log in again.";
      return;
    }

    const response = await fetch("/api/auth-check", {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${data.session.access_token}`
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
      "Could not complete the test. Check the console or deployment.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("authTestButton");

  if (button) {
    button.addEventListener("click", testAuthorization);
  }
});
