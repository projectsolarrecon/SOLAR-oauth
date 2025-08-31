// OAuth "start" step: send user to GitHub's consent screen
export async function handler(event) {
  const {
    GITHUB_CLIENT_ID,
    ALLOWED_ORIGINS = ""
  } = process.env;

  const params = new URLSearchParams(event.rawQuery || "");
  const qsOrigin = params.get("origin");

  let origin = qsOrigin;
  if (!origin && event.headers.referer) {
    try { origin = new URL(event.headers.referer).origin; } catch {}
  }
  if (!origin) origin = "*"; // last resort to avoid loops

  const allowed = ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
  // If we know the exact origin, enforce allowlist; if "*", let it through
  if (origin !== "*" && !allowed.includes(origin)) {
    return { statusCode: 403, body: "Origin not allowed. Set ALLOWED_ORIGINS env var." };
  }

  const redirectUri = new URL("/api/callback", `https://${event.headers.host}`).toString();
  const state = encodeURIComponent(JSON.stringify({ origin }));

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "repo");
  authUrl.searchParams.set("state", state);

  return { statusCode: 302, headers: { Location: authUrl.toString() } };
}
