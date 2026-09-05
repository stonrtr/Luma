// Приложение выгружает сюда компактный снимок привычек и задач, чтобы серверный
// утренний cron мог сформировать план дня даже при закрытом приложении.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.SYNC_SECRET;

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }

  const b = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  if (!SECRET || b.key !== SECRET) { res.status(401).json({ ok: false, error: "bad key" }); return; }

  try {
    const snapshot = {
      tz: b.tz || "UTC",
      habits: Array.isArray(b.habits) ? b.habits : [],
      tasks: Array.isArray(b.tasks) ? b.tasks : [],
      at: Date.now(),
    };
    await redis(["SET", "done:snapshot", JSON.stringify(snapshot)]);
    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: false });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
