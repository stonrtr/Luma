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
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json();
}
// Положить запись в очередь для приложения: kind = "idea" | "task".
async function enqueue(title, kind) {
  await redis(["RPUSH", "done:ideas", JSON.stringify({ title, kind, today: kind === "task", at: Date.now() })]);
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(200).send("ok"); return; }
  // Проверяем секрет, которым Telegram подписывает вебхук (secret_token при регистрации).
  if (SECRET && req.headers["x-telegram-bot-api-secret-token"] !== SECRET) {
    res.status(401).send("forbidden"); return;
  }
  try {
    const update = req.body || {};

    // --- Нажата кнопка выбора: в идеи или в задачу ---
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id;
      const msgId = cq.message?.message_id;
      let text = "";
      if (msgId != null) {
        const p = await redis(["GET", `done:pending:${msgId}`]);
        text = p && p.result ? p.result : "";
      }
      if (text) {
        const kind = cq.data === "task" ? "task" : "idea";
        await enqueue(text, kind);
        await redis(["DEL", `done:pending:${msgId}`]);
        const label = kind === "task" ? "✅ В задачи" : "💡 В идеи";
        await tg("editMessageText", { chat_id: chatId, message_id: msgId, text: `${label}: ${text}` });
      } else if (chatId && msgId != null) {
        await tg("editMessageText", { chat_id: chatId, message_id: msgId, text: "⏳ Запись устарела — отправьте текст заново." });
      }
      await tg("answerCallbackQuery", { callback_query_id: cq.id });
      res.status(200).send("ok"); return;
    }

    // --- Текстовое сообщение ---
    const msg = update.message || update.edited_message;
    const text = (msg && typeof msg.text === "string" ? msg.text : "").trim();
    const chatId = msg && msg.chat ? msg.chat.id : null;
    // Запоминаем chat_id — сюда утренний cron будет слать план дня.
    if (chatId) { try { await redis(["SET", "done:chat", String(chatId)]); } catch { /* ignore */ } }

    if (text && !text.startsWith("/") && chatId && BOT_TOKEN) {
      if (text.startsWith("!")) {
        // Быстрый путь: «!текст» — сразу задача на сегодня, без кнопок.
        const title = text.slice(1).trim();
        if (title) { await enqueue(title, "task"); await tg("sendMessage", { chat_id: chatId, text: `✅ Задача на сегодня: ${title}` }); }
      } else {
        // Спрашиваем кнопками, куда распределить.
        const sent = await tg("sendMessage", {
          chat_id: chatId,
          text: `Куда добавить?\n«${text}»`,
          reply_markup: { inline_keyboard: [[
            { text: "💡 В идеи", callback_data: "idea" },
            { text: "✅ В задачу", callback_data: "task" },
          ]] },
        });
        const mid = sent?.result?.message_id;
        if (mid != null) await redis(["SET", `done:pending:${mid}`, text, "EX", 86400]);
      }
    }
  } catch { /* глотаем ошибку, чтобы Telegram не ретраил бесконечно */ }
  res.status(200).send("ok");
}
