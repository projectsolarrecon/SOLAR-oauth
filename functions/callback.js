// OAuth "finish" step: exchange code for token, then message it back to /admin
export async function handler(event) {
  try {
    const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;

    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return { statusCode: 400, body: "Missing code/state" };
    }

    // Exchange the code for an access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      return { statusCode: 400, body: "Token exchange failed" };
    }

    // Where the /admin page lives (we stored it in state)
    const { origin } = JSON.parse(decodeURIComponent(state));
    const token = tokenJson.access_token;

    // HTML that handles all known Decap/Netlify CMS auth message styles
    const html = `<!doctype html>
<meta charset="utf-8" />
<title>Signing you in…</title>
<script>
  (function () {
    var ORIGIN = ${JSON.stringify(origin)};
    var TOKEN = ${JSON.stringify(token)};

    function sendAllFormats() {
      // Old/alt format used by some builds
      window.opener && window.opener.postMessage({ token: TOKEN, provider: "github" }, ORIGIN);
      // Common Decap/Netlify CMS format
      window.opener && window.opener.postMessage({ type: "authorization:github", token: TOKEN }, ORIGIN);
    }

    // If the opener sends a handshake message, reply with the token
    function onMessage(e) {
      if (e.origin !== ORIGIN) return;
      if (e.data === "authorizing:github" || (e.data && e.data.type === "authorizing:github")) {
        sendAllFormats();
        setTimeout(function(){ window.close(); }, 100);
      }
    }

    window.addEventListener("message", onMessage, false);

    // Kick off the handshake (covers cases where CMS expects it)
    try {
      window.opener && window.opener.postMessage("authorizing:github", ORIGIN);
    } catch (e) {}

    // Also send token immediately (covers cases with no handshake)
    sendAllFormats();

    // Fallback: leave a message if there is no opener (rare)
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
