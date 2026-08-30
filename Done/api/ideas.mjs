// Эндпоинт синхронизации: приложение Done забирает отсюда накопленные идеи и
// атомарно очищает очередь в Upstash. Требует ?key=<SYNC_SECRET>.

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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const key = req.query.key;
  if (!SECRET || key !== SECRET) { res.status(401).json({ ok: false, error: "bad key" }); return; }

  try {
    // LPOP с count атомарно снимает до 100 идей за раз.
    const out = await redis(["LPOP", "done:ideas", "100"]);
    let items = out && out.result;
    if (!Array.isArray(items)) items = items ? [items] : [];
    const ideas = items
      .map((s) => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean);
    res.status(200).json({ ok: true, ideas });
  } catch {
    res.status(200).json({ ok: true, ideas: [] });
  }
}
