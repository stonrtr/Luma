// Общие помощники для серверной интеграции Google Calendar (по образцу workspace).
// Токены пользователя (refresh/access) и id выделенного календаря хранятся в Upstash.
// Файлы, начинающиеся с "_", Vercel не превращает в маршруты — только импортируются.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const SECRET = process.env.SYNC_SECRET;
export const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const SCOPE = "https://www.googleapis.com/auth/calendar";
const KEY = "done:gcal";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

export async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  return r.json();
}

export async function getState() {
  const out = await redis(["GET", KEY]);
  if (!out || !out.result) return null;
  try { return JSON.parse(out.result); } catch { return null; }
}
export async function setState(obj) {
  await redis(["SET", KEY, JSON.stringify(obj)]);
}
export async function clearState() {
  await redis(["DEL", KEY]);
}

export function redirectUri(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `https://${host}/api/gcal/callback`;
}

// Обменять refresh_token на свежий access_token при необходимости.
export async function validAccessToken(state) {
  const now = Date.now();
  if (state.access_token && state.expires_at && now < state.expires_at - 60000) {
    return state.access_token;
  }
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: state.refresh_token,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("refresh failed");
  state.access_token = j.access_token;
  state.expires_at = now + (Number(j.expires_in || 3600) * 1000);
  await setState(state);
  return state.access_token;
}

export async function gcal(state, path, init) {
  const token = await validAccessToken(state);
  return fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

// Найти календарь приложения по имени или создать новый.
export async function ensureCalendar(state, name = "Done") {
  if (state.calendarId) return state.calendarId;
  const listRes = await gcal(state, "/users/me/calendarList");
  const list = await listRes.json();
  const found = (list.items ?? []).find((c) => c.summary === name);
  if (found) { state.calendarId = found.id; await setState(state); return found.id; }
  const createRes = await gcal(state, "/calendars", { method: "POST", body: JSON.stringify({ summary: name }) });
  const created = await createRes.json();
  state.calendarId = created.id;
  await setState(state);
  return created.id;
}

export function ok(res, data) { res.status(200).json({ ok: true, ...data }); }
export function bad(res, code, error) { res.status(code).json({ ok: false, error }); }
