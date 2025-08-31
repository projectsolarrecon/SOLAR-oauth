// OAuth "finish" step: exchange code for token, then message it back to /admin
export async function handler(event) {
  try {
    const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;

    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) return { statusCode: 400, body: "Missing code" };

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) return { statusCode: 400, body: "Token exchange failed" };

    let origin = "*"; // safe default so message is received even if origin was mis-guessed
    try {
      if (state) {
        const parsed = JSON.parse(decodeURIComponent(state));
        if (parsed && parsed.origin) origin = parsed.origin;
      }
    } catch {}

    const token = tokenJson.access_token;

    const html = `<!doctype html>
<meta charset="utf-8" />
<title>Signing you in…</title>
<script>
  (function () {
    var ORIGIN = ${JSON.stringify(origin)};
    var TOKEN = ${JSON.stringify(token)};

    function sendAll() {
      try {
        // Legacy/alt format
        window.opener && window.opener.postMessage({ token: TOKEN, provider: "github" }, ORIGIN);
        // Decap/Netlify CMS format
        window.opener && window.opener.postMessage({ type: "authorization:github", token: TOKEN }, ORIGIN);
        // Super-safe broadcast when ORIGIN is "*" (covers strict origin checks)
        window.opener && window.opener.postMessage({ type: "authorization:github", token: TOKEN }, "*");
      } catch (e) {}
    }

    function onMessage(e) {
      if (ORIGIN !== "*" && e.origin !== ORIGIN) return;
      var d = e.data || {};
      if (d === "authorizing:github" || d.type === "authorizing:github") {
        sendAll();
        setTimeout(function(){ window.close(); }, 100);
      }
    }

    window.addEventListener("message", onMessage, false);

    // Start a handshake (some builds expect this)
    try { window.opener && window.opener.postMessage("authorizing:github", ORIGIN); } catch (e) {}

    // Also push immediately (covers builds that don't handshake)
    sendAll();

    // Fallback message if no opener
    setTimeout(function () {
      if (!window.opener) document.body.textContent = "Logged in. You can close this window.";
    }, 200);
  })();
</script>`;
    return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
