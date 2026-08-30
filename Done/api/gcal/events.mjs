// Чтение событий из выделенного календаря + статус подключения.
// ?key=<SYNC_SECRET>&timeMin=<ISO>&timeMax=<ISO>
import { SECRET, getState, ensureCalendar, gcal } from "./_lib.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (!SECRET || req.query.key !== SECRET) { res.status(401).json({ ok: false, error: "bad key" }); return; }

  const state = await getState();
  if (!state || !state.refresh_token) { res.status(200).json({ ok: true, connected: false, events: [] }); return; }

  try {
    const calId = await ensureCalendar(state, "Done");
    const now = new Date();
    const timeMin = req.query.timeMin || new Date(now.getTime() - 2 * 864e5).toISOString();
    const timeMax = req.query.timeMax || new Date(now.getTime() + 45 * 864e5).toISOString();
    const p = new URLSearchParams({
      timeMin: String(timeMin),
      timeMax: String(timeMax),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const r = await gcal(state, `/calendars/${encodeURIComponent(calId)}/events?${p.toString()}`);
    const data = await r.json();
    const events = (data.items ?? []).map((e) => {
      const start = e.start || {};
      const end = e.end || {};
      // Событие со временем → date+timeStart; «весь день» → date без времени.
      // Берём локальное настенное время прямо из строки Google (…T23:27:00+03:00),
      // без new Date(), чтобы не конвертировать в UTC сервера.
      let date = null, timeStart = null, timeEnd = null;
      if (start.dateTime) {
        const s = String(start.dateTime);
        date = s.slice(0, 10);
        timeStart = s.slice(11, 16);
        if (end.dateTime) timeEnd = String(end.dateTime).slice(11, 16);
      } else if (start.date) {
        date = start.date;
      }
      return { gid: String(e.id), title: String(e.summary || "(без названия)"), date, timeStart, timeEnd, htmlLink: e.htmlLink || null };
    }).filter((e) => e.date);
    res.status(200).json({ ok: true, connected: true, email: state.email || null, calendarId: calId, events });
  } catch {
    res.status(200).json({ ok: true, connected: true, events: [] });
  }
}
