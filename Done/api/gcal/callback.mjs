// OAuth callback: Google возвращает code → меняем на токены, создаём/находим
// выделенный календарь «Done», сохраняем всё в Upstash.
import { SECRET, CLIENT_ID, CLIENT_SECRET, redirectUri, setState, ensureCalendar, gcal } from "./_lib.mjs";

function page(msg) {
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
  <body style="font-family:system-ui;background:#0a0b0d;color:#f4f5f7;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
  <div style="text-align:center;max-width:420px;padding:24px">
  <div style="font-size:40px">✓</div><h2>${msg}</h2>
  <p style="opacity:.7">Можно закрыть эту вкладку и вернуться в приложение.</p></div></body>`;
}

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (error) { res.status(200).send(page(`Отказано в доступе: ${error}`)); return; }
  if (!SECRET || state !== SECRET) { res.status(401).send(page("Неверный state")); return; }
  if (!code) { res.status(400).send(page("Нет кода авторизации")); return; }
  try {
    const body = new URLSearchParams({
      code: String(code),
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
    });
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tok = await tr.json();
    if (!tok.access_token) { res.status(200).send(page("Не удалось получить токен")); return; }
    const st = {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token, // приходит только при prompt=consent
      expires_at: Date.now() + Number(tok.expires_in || 3600) * 1000,
      calendarId: null,
      email: null,
    };
    await setState(st);
    // почта пользователя (для показа в настройках)
    try {
      const who = await gcal(st, "/calendars/primary");
      const w = await who.json();
      st.email = w.id ?? null;
    } catch { /* не критично */ }
    await ensureCalendar(st, "Done");
    res.status(200).send(page("Google Календарь подключён"));
  } catch {
    res.status(200).send(page("Ошибка подключения"));
  }
}
