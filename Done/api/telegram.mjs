// Serverless-вебхук Telegram-бота захвата для приложения Done.
// Постоянное меню снизу: «💡 В идеи» / «✅ В задачу». Пишете текст → он ждёт выбора,
// тапаете кнопку меню → распределяется. Прошлое невыбранное уходит в идеи при новом
// тексте или через 5 минут (досыпается в /api/ideas). «!текст» — сразу задача.
//
// ENV: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, TG_BOT_TOKEN, SYNC_SECRET

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const SECRET = process.env.SYNC_SECRET;

const IDEA_BTN = "💡 В идеи";
const TASK_BTN = "✅ В задачу";
const MENU = { keyboard: [[{ text: IDEA_BTN }, { text: TASK_BTN }]], resize_keyboard: true, is_persistent: true };

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
function say(chatId, text) { return tg("sendMessage", { chat_id: chatId, text, reply_markup: MENU }); }
async function enqueue(title, kind) {
  await redis(["RPUSH", "done:ideas", JSON.stringify({ title, kind, today: kind === "task", at: Date.now() })]);
}
async function getAwait() {
  const p = await redis(["GET", "done:await"]);
  if (!p || !p.result) return null;
  try { return JSON.parse(p.result); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(200).send("ok"); return; }
  if (SECRET && req.headers["x-telegram-bot-api-secret-token"] !== SECRET) {
    res.status(401).send("forbidden"); return;
  }
  try {
    const update = req.body || {};

    // Старые инлайн-кнопки больше не используются — просто гасим «часики».
    if (update.callback_query) {
      await tg("answerCallbackQuery", { callback_query_id: update.callback_query.id, text: "Используйте меню снизу 👇" });
      res.status(200).send("ok"); return;
    }

    const msg = update.message || update.edited_message;
    const text = (msg && typeof msg.text === "string" ? msg.text : "").trim();
    const chatId = msg && msg.chat ? msg.chat.id : null;
    if (!chatId || !BOT_TOKEN) { res.status(200).send("ok"); return; }
    try { await redis(["SET", "done:chat", String(chatId)]); } catch { /* ignore */ }

    // /start — показать меню
    if (text === "/start") {
      await say(chatId, "Привет! Пишите текст — распределяйте кнопками ниже: «В идеи» или «В задачу». Префикс «!» — сразу задача на сегодня.");
      res.status(200).send("ok"); return;
    }

    // Нажата кнопка меню — распределить ожидающее
    if (text === IDEA_BTN || text === TASK_BTN) {
      const aw = await getAwait();
      if (aw && aw.text) {
        const kind = text === TASK_BTN ? "task" : "idea";
        await enqueue(aw.text, kind);
        await redis(["DEL", "done:await"]);
        await say(chatId, `${kind === "task" ? "✅ В задачи" : "💡 В идеи"}: ${aw.text}`);
      } else {
        await say(chatId, "Нечего распределять — сначала пришлите текст.");
      }
      res.status(200).send("ok"); return;
    }

    if (text && !text.startsWith("/")) {
      if (text.startsWith("!")) {
        const title = text.slice(1).trim();
        if (title) { await enqueue(title, "task"); await say(chatId, `✅ Задача на сегодня: ${title}`); }
      } else {
        // Новый текст: прошлое невыбранное — в идеи.
        const prev = await getAwait();
        if (prev && prev.text) await enqueue(prev.text, "idea");
        await redis(["SET", "done:await", JSON.stringify({ chat: chatId, text, at: Date.now() }), "EX", 86400]);
        await say(chatId, `Куда добавить?\n«${text}»\nВыберите кнопкой ниже 👇`);
      }
    }
  } catch { /* глотаем ошибку, чтобы Telegram не ретраил */ }
  res.status(200).send("ok");
}
