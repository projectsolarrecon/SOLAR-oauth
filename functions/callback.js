// OAuth "finish" step: exchange code for token, then send token back to /admin via postMessage
export async function handler(event) {
  try {
    const {
      GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET
    } = process.env;

    const url = new URL(event.rawUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return { statusCode: 400, body: "Missing code/state" };
    }

    // exchange the code for an access token
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

    // decode origin from state (where the /admin is open)
    const { origin } = JSON.parse(decodeURIComponent(state));

    // tiny HTML page that posts token back to the opener window (Decap CMS)
    const html = `
<!doctype html>
<meta charset="utf-8">
<script>
  (function() {
    var token = ${JSON.stringify(tokenJson.access_token)};
    var data = { token: token, provider: "github" };
    // tell the opener (your /admin) that we're done
    if (window.opener) {
      window.opener.postMessage(data, ${JSON.stringify(origin)});
      window.close();
    } else {
      document.body.innerText = "Logged in. You can close this window.";
    }
  })();
</script>`;

    return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
