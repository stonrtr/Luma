// Serverless-вебхук Telegram-бота захвата идей для приложения Done.
// Telegram шлёт сюда сообщение → мы мгновенно отвечаем пользователю и кладём
// идею в Upstash Redis. Приложение при открытии забирает идеи из хранилища.
//
// Переменные окружения (задаются в Vercel → Project → Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL   — REST URL базы Upstash Redis
//   UPSTASH_REDIS_REST_TOKEN — REST-токен Upstash
//   TG_BOT_TOKEN             — токен бота захвата (из @BotFather)
//   SYNC_SECRET             — произвольная строка-секрет (та же, что в настройках приложения)

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const BOT_TOKEN = process.env.TG_BOT_TOKEN;
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
  if (req.method !== "POST") { res.status(200).send("ok"); return; }
  // Проверяем секрет, которым Telegram подписывает вебхук (secret_token при регистрации).
  if (SECRET && req.headers["x-telegram-bot-api-secret-token"] !== SECRET) {
    res.status(401).send("forbidden"); return;
  }
  try {
    const update = req.body || {};
    const msg = update.message || update.edited_message;
    const text = (msg && typeof msg.text === "string" ? msg.text : "").trim();
    const chatId = msg && msg.chat ? msg.chat.id : null;
    if (text && !text.startsWith("/")) {
      const today = text.startsWith("!");
      const title = (today ? text.slice(1) : text).trim();
      if (title) {
        await redis(["RPUSH", "done:ideas", JSON.stringify({ title, today, at: Date.now() })]);
        if (chatId && BOT_TOKEN) {
          const reply = today ? "✓ Задача на сегодня принята в Done" : "✓ Идея принята в Done";
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(reply)}`);
        }
      }
    }
  } catch { /* глотаем ошибку, чтобы Telegram не ретраил бесконечно */ }
  res.status(200).send("ok");
}
