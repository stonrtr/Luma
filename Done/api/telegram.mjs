// Serverless-вебхук Telegram-бота захвата для приложения Done.
// Постоянное меню снизу: «💡 В идеи» / «✅ В задачу». Для задачи — пошаговый мастер:
//   выбор цели (частые выше) → выбор дедлайна (кнопки/календарь) → создание задачи.
// Прошлое невыбранное уходит в идеи при новом тексте или через 5 мин (см. /api/ideas).
// «!текст» — сразу задача на сегодня без мастера.
//
// ENV: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, TG_BOT_TOKEN, SYNC_SECRET

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const SECRET = process.env.SYNC_SECRET;

const IDEA_BTN = "💡 В идеи";
const TASK_BTN = "✅ В задачу";
const MENU = { keyboard: [[{ text: IDEA_BTN }, { text: TASK_BTN }]], resize_keyboard: true, is_persistent: true };
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DL = [
  { k: "today", label: "Сегодня" }, { k: "tomorrow", label: "Завтра" }, { k: "after", label: "Послезавтра" },
  { k: "eow", label: "До конца недели" }, { k: "eonw", label: "До конца след. недели" }, { k: "pick", label: "Выбрать дату" },
];

async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: "POST", headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  return r.json();
}
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
function say(chatId, text) { return tg("sendMessage", { chat_id: chatId, text, reply_markup: MENU }); }
async function getJSON(key) { const p = await redis(["GET", key]); if (!p || !p.result) return null; try { return JSON.parse(p.result); } catch { return null; } }
async function enqueueIdea(title) { await redis(["RPUSH", "done:ideas", JSON.stringify({ title, kind: "idea", today: false, at: Date.now() })]); }
async function enqueueTask(title, goalId, date) { await redis(["RPUSH", "done:ideas", JSON.stringify({ title, kind: "task", goalId: goalId || null, date: date || null, at: Date.now() })]); }
async function setState(s) { await redis(["SET", "done:state", JSON.stringify(s), "EX", 3600]); }

// --- даты (в часовом поясе пользователя из снимка) ---
function todayInTz(tz) { try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); } catch { return new Intl.DateTimeFormat("en-CA").format(new Date()); } }
function addDays(ds, n) { const [y, m, d] = ds.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d + n)); return dt.toISOString().slice(0, 10); }
function dowMon0(ds) { const [y, m, d] = ds.split("-").map(Number); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; }
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function humanDate(ds) { const [, m, d] = ds.split("-").map(Number); return `${d} ${MONTHS_GEN[m - 1]}`; }
function deadlineDate(key, today) {
  if (key === "today") return today;
  if (key === "tomorrow") return addDays(today, 1);
  if (key === "after") return addDays(today, 2);
  if (key === "eow") return addDays(today, 6 - dowMon0(today));
  if (key === "eonw") return addDays(today, 6 - dowMon0(today) + 7);
  return today;
}

// --- клавиатуры ---
async function goalKeyboard() {
  const snap = await getJSON("done:snapshot");
  const goals = ((snap && snap.goals) || []).filter((g) => !g.completedAt && !g.archived);
  const freqOut = await redis(["HGETALL", "done:goalfreq"]);
  const fa = freqOut && freqOut.result ? freqOut.result : [];
  const freq = {};
  if (Array.isArray(fa)) for (let i = 0; i < fa.length; i += 2) freq[fa[i]] = Number(fa[i + 1]) || 0;
  else if (fa && typeof fa === "object") for (const k of Object.keys(fa)) freq[k] = Number(fa[k]) || 0;
  const active = {};
  for (const t of (snap && snap.tasks) || []) if (t.goalId && !t.completedAt) active[t.goalId] = (active[t.goalId] || 0) + 1;
  goals.sort((a, b) => (freq[b.id] || 0) - (freq[a.id] || 0) || (active[b.id] || 0) - (active[a.id] || 0) || a.name.localeCompare(b.name, "ru"));
  const top = goals.slice(0, 10);
  const rows = [];
  for (let i = 0; i < top.length; i += 2) rows.push(top.slice(i, i + 2).map((g) => ({ text: g.name.length > 28 ? g.name.slice(0, 27) + "…" : g.name, callback_data: `goal:${g.id}` })));
  rows.push([{ text: "Без цели", callback_data: "goal:none" }]);
  return { inline_keyboard: rows };
}
function deadlineKeyboard() {
  const rows = [];
  for (let i = 0; i < DL.length; i += 2) rows.push(DL.slice(i, i + 2).map((d) => ({ text: d.label, callback_data: `dl:${d.k}` })));
  return { inline_keyboard: rows };
}
function calKeyboard(year, month) { // month 1..12
  const startDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const rows = [[
    { text: "‹", callback_data: `calnav:${prev.y}-${prev.m}` },
    { text: `${MONTHS[month - 1]} ${year}`, callback_data: "noop" },
    { text: "›", callback_data: `calnav:${next.y}-${next.m}` },
  ], WDAYS.map((d) => ({ text: d, callback_data: "noop" }))];
  let week = [];
  for (let i = 0; i < startDow; i++) week.push({ text: " ", callback_data: "noop" });
  for (let day = 1; day <= days; day++) {
    const ds = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    week.push({ text: String(day), callback_data: `cal:${ds}` });
    if (week.length === 7) { rows.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push({ text: " ", callback_data: "noop" }); rows.push(week); }
  return { inline_keyboard: rows };
}

async function startTaskFlow(chatId, text) {
  const kb = await goalKeyboard();
  if (kb.inline_keyboard.length <= 1) { // нет незавершённых целей — сразу дедлайн
    await setState({ step: "deadline", text, goalId: null, goalName: null });
    await tg("sendMessage", { chat_id: chatId, text: `Задача: «${text}»\nДедлайн?`, reply_markup: deadlineKeyboard() });
    return;
  }
  await setState({ step: "goal", text });
  await tg("sendMessage", { chat_id: chatId, text: `Задача: «${text}»\nК какой цели?`, reply_markup: kb });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(200).send("ok"); return; }
  if (SECRET && req.headers["x-telegram-bot-api-secret-token"] !== SECRET) { res.status(401).send("forbidden"); return; }
  try {
    const update = req.body || {};

    // ---------- callback от inline-кнопок мастера ----------
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id;
      const mid = cq.message?.message_id;
      const data = cq.data || "";
      const ans = (t) => tg("answerCallbackQuery", { callback_query_id: cq.id, ...(t ? { text: t } : {}) });
      const st = await getJSON("done:state");
      const snap = await getJSON("done:snapshot");
      const tz = (snap && snap.tz) || "UTC";

      if (data === "noop") { await ans(); res.status(200).send("ok"); return; }

      if (data.startsWith("goal:") && st && st.step === "goal") {
        const gid = data.slice(5);
        let goalName = null;
        if (gid !== "none") {
          await redis(["HINCRBY", "done:goalfreq", gid, 1]);
          const g = ((snap && snap.goals) || []).find((x) => x.id === gid);
          goalName = g ? g.name : null;
        }
        await setState({ step: "deadline", text: st.text, goalId: gid === "none" ? null : gid, goalName });
        await tg("editMessageText", { chat_id: chatId, message_id: mid, text: `Задача: «${st.text}»${goalName ? `\nЦель: ${goalName}` : ""}\nДедлайн?`, reply_markup: deadlineKeyboard() });
        await ans();
      } else if (data.startsWith("dl:") && st && st.step === "deadline") {
        const key = data.slice(3);
        if (key === "pick") {
          const today = todayInTz(tz); const [y, m] = today.split("-").map(Number);
          await setState({ ...st, step: "cal" });
          await tg("editMessageText", { chat_id: chatId, message_id: mid, text: `Задача: «${st.text}»\nВыберите дату:`, reply_markup: calKeyboard(y, m) });
          await ans();
        } else {
          const date = deadlineDate(key, todayInTz(tz));
          await enqueueTask(st.text, st.goalId, date);
          await redis(["DEL", "done:state"]);
          await tg("editMessageText", { chat_id: chatId, message_id: mid, text: `✅ Задача: ${st.text}${st.goalName ? `\nЦель: ${st.goalName}` : ""}\nДедлайн: ${humanDate(date)}` });
          await ans("Готово");
        }
      } else if (data.startsWith("calnav:") && st && st.step === "cal") {
        const [y, m] = data.slice(7).split("-").map(Number);
        await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: mid, reply_markup: calKeyboard(y, m) });
        await ans();
      } else if (data.startsWith("cal:") && st && st.step === "cal") {
        const date = data.slice(4);
        await enqueueTask(st.text, st.goalId, date);
        await redis(["DEL", "done:state"]);
        await tg("editMessageText", { chat_id: chatId, message_id: mid, text: `✅ Задача: ${st.text}${st.goalName ? `\nЦель: ${st.goalName}` : ""}\nДедлайн: ${humanDate(date)}` });
        await ans("Готово");
      } else {
        await ans("Шаг устарел — начните заново");
      }
      res.status(200).send("ok"); return;
    }

    // ---------- обычные сообщения ----------
    const msg = update.message || update.edited_message;
    const text = (msg && typeof msg.text === "string" ? msg.text : "").trim();
    const chatId = msg && msg.chat ? msg.chat.id : null;
    if (!chatId || !BOT_TOKEN) { res.status(200).send("ok"); return; }
    try { await redis(["SET", "done:chat", String(chatId)]); } catch { /* ignore */ }

    if (text === "/start") {
      await say(chatId, "Привет! Пишите текст — распределяйте кнопками ниже: «В идеи» или «В задачу». Для задачи спрошу цель и дедлайн. Префикс «!» — сразу задача на сегодня.");
      res.status(200).send("ok"); return;
    }

    if (text === IDEA_BTN || text === TASK_BTN) {
      const aw = await getJSON("done:await");
      if (aw && aw.text) {
        await redis(["DEL", "done:await"]);
        if (text === IDEA_BTN) { await enqueueIdea(aw.text); await say(chatId, `💡 В идеи: ${aw.text}`); }
        else { await startTaskFlow(chatId, aw.text); }
      } else { await say(chatId, "Нечего распределять — сначала пришлите текст."); }
      res.status(200).send("ok"); return;
    }

    if (text && !text.startsWith("/")) {
      if (text.startsWith("!")) {
        const title = text.slice(1).trim();
        if (title) { const snap = await getJSON("done:snapshot"); await enqueueTask(title, null, todayInTz((snap && snap.tz) || "UTC")); await say(chatId, `✅ Задача на сегодня: ${title}`); }
      } else {
        const prev = await getJSON("done:await");
        if (prev && prev.text) await enqueueIdea(prev.text);
        await redis(["SET", "done:await", JSON.stringify({ chat: chatId, text, at: Date.now() }), "EX", 86400]);
        await say(chatId, `Куда добавить?\n«${text}»\nВыберите кнопкой ниже 👇`);
      }
    }
  } catch { /* глотаем ошибку, чтобы Telegram не ретраил */ }
  res.status(200).send("ok");
}
