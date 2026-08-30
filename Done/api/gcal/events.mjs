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
      let date = null, timeStart = null, timeEnd = null;
      if (start.dateTime) {
        const d = new Date(start.dateTime);
        date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        timeStart = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        if (end.dateTime) {
          const de = new Date(end.dateTime);
          timeEnd = `${String(de.getHours()).padStart(2, "0")}:${String(de.getMinutes()).padStart(2, "0")}`;
        }
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
