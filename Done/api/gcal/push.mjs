// Запись задачи приложения в выделенный календарь Google.
// POST { key, op: "upsert"|"delete", gid?, title, date, timeStart?, timeEnd?, notes? }
// Возвращает { gid } — id события в Google (сохраняется на задаче).
import { SECRET, getState, ensureCalendar, gcal } from "./_lib.mjs";

function body(t) {
  if (t.timeStart) {
    // Часовой пояс приходит от клиента (на сервере Intl вернул бы UTC).
    const tz = t.tz || "UTC";
    const end = t.timeEnd || addMin(t.timeStart, 60);
    return {
      summary: t.title,
      description: t.notes || undefined,
      start: { dateTime: `${t.date}T${t.timeStart}:00`, timeZone: tz },
      end: { dateTime: `${t.date}T${end}:00`, timeZone: tz },
    };
  }
  return { summary: t.title, description: t.notes || undefined, start: { date: t.date }, end: { date: nextDay(t.date) } };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }

  const b = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  if (!SECRET || b.key !== SECRET) { res.status(401).json({ ok: false, error: "bad key" }); return; }

  const state = await getState();
  if (!state || !state.refresh_token) { res.status(200).json({ ok: false, error: "not connected" }); return; }

  try {
    const calId = await ensureCalendar(state, "Done");
    if (b.op === "delete") {
      if (b.gid) await gcal(state, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(b.gid)}`, { method: "DELETE" });
      res.status(200).json({ ok: true });
      return;
    }
    // upsert
    if (b.gid) {
      const r = await gcal(state, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(b.gid)}`, { method: "PATCH", body: JSON.stringify(body(b)) });
      if (r.ok) { const j = await r.json(); res.status(200).json({ ok: true, gid: j.id }); return; }
      // событие удалили в Google — создадим заново ниже
    }
    const r = await gcal(state, `/calendars/${encodeURIComponent(calId)}/events`, { method: "POST", body: JSON.stringify(body(b)) });
    const j = await r.json();
    res.status(200).json({ ok: !!j.id, gid: j.id || null });
  } catch {
    res.status(200).json({ ok: false });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
function nextDay(d) { const [y, m, day] = d.split("-").map(Number); const dt = new Date(y, m - 1, day + 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`; }
function addMin(hhmm, min) { const [h, m] = hhmm.split(":").map(Number); const t = Math.min(23 * 60 + 59, h * 60 + m + min); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; }
