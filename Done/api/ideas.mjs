// Эндпоинт синхронизации: приложение Done забирает отсюда накопленные идеи и
// атомарно очищает очередь в Upstash. Требует ?key=<SYNC_SECRET>.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.SYNC_SECRET;
const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const AUTO_MS = 5 * 60 * 1000; // авто-сброс невыбранных в идеи через 5 минут

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  return r.json();
}

// Сбросить «ожидающий выбора» старше 5 минут — в идеи.
async function sweepPending() {
  const g = await redis(["GET", "done:await"]);
  if (!g || !g.result) return;
  let p; try { p = JSON.parse(g.result); } catch { p = null; }
  if (!p) { await redis(["DEL", "done:await"]); return; }
  if (Date.now() - (p.at || 0) < AUTO_MS) return;
  await redis(["RPUSH", "done:ideas", JSON.stringify({ title: p.text, kind: "idea", today: false, at: Date.now() })]);
  await redis(["DEL", "done:await"]);
  if (BOT_TOKEN && p.chat) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: p.chat, text: `💡 В идеи (авто): ${p.text}` }),
      });
    } catch { /* ignore */ }
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const key = req.query.key;
  if (!SECRET || key !== SECRET) { res.status(401).json({ ok: false, error: "bad key" }); return; }

  try {
    // Сначала досыпаем в очередь просроченные (5 мин) невыбранные — как идеи.
    await sweepPending();
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
