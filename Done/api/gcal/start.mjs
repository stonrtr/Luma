// Старт OAuth: редирект пользователя на экран согласия Google.
// Требует ?key=<SYNC_SECRET>. access_type=offline + prompt=consent → получаем refresh_token.
import { SECRET, CLIENT_ID, SCOPE, redirectUri } from "./_lib.mjs";

export default async function handler(req, res) {
  try {
    if (!SECRET || req.query.key !== SECRET) { res.status(401).send("bad key"); return; }
    if (!CLIENT_ID) { res.status(500).send("GOOGLE_CLIENT_ID не задан"); return; }
    const p = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(req),
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: SECRET,
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
    res.setHeader("Location", url);
    res.status(302).end();
  } catch (e) {
    res.status(500).send("start error: " + (e && e.message ? e.message : String(e)));
  }
}
