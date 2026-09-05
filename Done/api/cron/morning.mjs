// Ежедневный утренний план: читает снимок из Upstash, формирует список привычек и
// задач на сегодня и шлёт боту. Запускается Vercel Cron (см. vercel.json).
// Ручной тест: /api/cron/morning?key=<SYNC_SECRET>

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.SYNC_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;
const BOT_TOKEN = process.env.TG_BOT_TOKEN;

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  return r.json();
}
async function getJSON(key) {
  const out = await redis(["GET", key]);
  if (!out || !out.result) return null;
  try { return JSON.parse(out.result); } catch { return out.result; }
}

function todayInTz(tz) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); }
  catch { return new Intl.DateTimeFormat("en-CA").format(new Date()); }
}
function dayOfWeekMon0(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  return (wd + 6) % 7; // 0=Mon..6=Sun
}
function habitActiveToday(h, date) {
  if (!h || !h.startDate) return false;
  if (date < h.startDate) return false;
  if (h.endDate && date > h.endDate) return false;
  if (h.schedule === "custom") return Array.isArray(h.daysOfWeek) && h.daysOfWeek.includes(dayOfWeekMon0(date));
  return true;
}
function humanDate(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export default async function handler(req, res) {
  const authed =
    (req.query && req.query.key && req.query.key === SECRET) ||
    (CRON_SECRET && req.headers.authorization === `Bearer ${CRON_SECRET}`) ||
    !CRON_SECRET;
  if (!authed) { res.status(401).json({ ok: false, error: "forbidden" }); return; }

  try {
    const snap = await getJSON("done:snapshot");
    const chat = await redis(["GET", "done:chat"]).then((o) => o && o.result);
    if (!snap) { res.status(200).json({ ok: false, error: "no snapshot" }); return; }
    if (!chat) { res.status(200).json({ ok: false, error: "no chat id (напишите боту)" }); return; }

    const tz = snap.tz || "UTC";
    const today = todayInTz(tz);

    const habits = (snap.habits || [])
      .filter((h) => !h.archived && h.showInHabits !== false && habitActiveToday(h, today))
      .map((h) => (h.time ? `• ${h.time} ${h.name}` : `• ${h.name}`));

    const tasks = (snap.tasks || [])
      .filter((t) => t.date === today && !t.completedAt && !t.deletedAt)
      .sort((a, b) => (a.timeStart || "99") < (b.timeStart || "99") ? -1 : 1)
      .map((t) => (t.timeStart ? `• ${t.timeStart} ${t.title}` : `• ${t.title}`));

    let text = `☀️ Доброе утро! План на ${humanDate(today)}\n`;
    text += `\n🔁 Привычки:\n` + (habits.length ? habits.join("\n") : "— на сегодня нет");
    text += `\n\n✅ Задачи:\n` + (tasks.length ? tasks.join("\n") : "— на сегодня нет");

    if (BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text }),
      });
    }
    res.status(200).json({ ok: true, sent: { habits: habits.length, tasks: tasks.length }, today });
  } catch (e) {
    res.status(200).json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
}
