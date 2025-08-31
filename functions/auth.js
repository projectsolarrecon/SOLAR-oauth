// OAuth "start" step: send user to GitHub's consent screen
export async function handler(event) {
  const {
    GITHUB_CLIENT_ID,
    ALLOWED_ORIGINS = ""
  } = process.env;

  const allowed = ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
  const origin = new URL(event.headers.referer || `https://${event.headers.host}`).origin;

  if (!allowed.includes(origin)) {
    return {
      statusCode: 403,
      body: "Origin not allowed. Set ALLOWED_ORIGINS env var."
    };
  }

  // where to come back after GitHub
  const redirectUri = new URL("/api/callback", `https://${event.headers.host}`).toString();

  // keep origin in state so callback knows where to postMessage
  const state = encodeURIComponent(JSON.stringify({ origin }));

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "repo"); // or "public_repo" if you prefer
  authUrl.searchParams.set("state", state);

  return {
    statusCode: 302,
    headers: { Location: authUrl.toString() }
  };
}
