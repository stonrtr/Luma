import "server-only";
import { db } from "@/server/db";
import { sendTelegram } from "./api";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Кнопки нижней клавиатуры
const BTN = {
  task: "➕ Задача",
  idea: "💡 Ідея",
  tasks: "📋 Мої задачі",
  today: "📅 Сьогодні",
  inbox: "🔔 Сповіщення",
};
const KEYBOARD = {
  reply_markup: {
    keyboard: [
      [{ text: BTN.task }, { text: BTN.idea }],
      [{ text: BTN.tasks }, { text: BTN.today }],
      [{ text: BTN.inbox }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  },
};

const HELP = [
  "<b>team M бот</b>",
  "",
  "Користуйтесь кнопками нижче або командами:",
  "/new назва — задача (дедлайн сьогодні)",
  "/idea назва — ідея (колонка «Ідеї»)",
  "/today · /tasks · /inbox · /help",
].join("\n");

type Update = {
  message?: { chat?: { id?: number | string }; from?: { username?: string }; text?: string };
};

async function createFor(userId: string, title: string, status: "TODO" | "IDEA") {
  const last = await db.task.findFirst({ where: { status, parentId: null, assignees: { some: { userId } } }, orderBy: { position: "desc" }, select: { position: true } });
  const data: { title: string; status: "TODO" | "IDEA"; priority: number; createdById: string; position: number; dueDate?: Date; assignees: { create: { userId: string }[] } } = {
    title: title.slice(0, 200), status, priority: 5, createdById: userId,
    position: (last?.position ?? -1) + 1, assignees: { create: [{ userId }] },
  };
  if (status === "TODO") { const d = new Date(); d.setHours(23, 59, 0, 0); data.dueDate = d; }
  await db.task.create({ data });
}

// Обработка входящего апдейта Telegram
export async function handleTelegramUpdate(update: Update): Promise<void> {
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text ?? "").trim();
  if (chatId == null || !text) return;
  const chat = String(chatId);
  const reply = (t: string) => sendTelegram(chat, t, KEYBOARD);

  // /start <code> — привязка аккаунта
  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    if (code) {
      const user = await db.user.findFirst({ where: { telegramLinkCode: code } });
      if (user) {
        await db.telegramAccount.upsert({
          where: { userId: user.id },
          create: { userId: user.id, chatId: chat, username: msg?.from?.username ?? null },
          update: { chatId: chat, username: msg?.from?.username ?? null },
        });
        await db.user.update({ where: { id: user.id }, data: { telegramLinkCode: null } });
        await reply(`✅ Підключено до акаунта <b>${esc(user.name)}</b>.\n\n${HELP}`);
        return;
      }
      await reply("Код недійсний. Згенеруйте новий у застосунку: Налаштування → Telegram.");
      return;
    }
    await reply(`Вітаю! Щоб підключити акаунт, відкрийте у застосунку Налаштування → Telegram і натисніть «Підключити».\n\n${HELP}`);
    return;
  }

  // остальное — только для привязанного пользователя
  const acc = await db.telegramAccount.findUnique({ where: { chatId: chat }, select: { userId: true, pendingAction: true } });
  if (!acc) {
    await sendTelegram(chat, "Акаунт не підключено. Відкрийте застосунок: Налаштування → Telegram.");
    return;
  }
  const userId = acc.userId;

  // кнопки, которые начинают ввод названия
  if (text === BTN.task) {
    await db.telegramAccount.update({ where: { chatId: chat }, data: { pendingAction: "task" } });
    await reply("✍️ Напишіть назву задачі одним повідомленням:");
    return;
  }
  if (text === BTN.idea) {
    await db.telegramAccount.update({ where: { chatId: chat }, data: { pendingAction: "idea" } });
    await reply("✍️ Напишіть назву ідеї одним повідомленням:");
    return;
  }

  // нормализуем кнопки в команды
  let cmd = text;
  if (text === BTN.tasks) cmd = "/tasks";
  else if (text === BTN.today) cmd = "/today";
  else if (text === BTN.inbox) cmd = "/inbox";

  if (cmd === "/help") { await reply(HELP); return; }

  if (cmd === "/inbox") {
    const items = await db.notification.findMany({ where: { recipientId: userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 10 });
    if (items.length === 0) { await reply("Непрочитаних сповіщень немає ✅"); return; }
    const lines = items.map((n) => `• ${esc(n.message)}`);
    await reply(`<b>Непрочитані (${items.length})</b>\n${lines.join("\n")}\n\n${APP_URL}`);
    return;
  }

  if (cmd === "/today") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const tasks = await db.task.findMany({
      where: { archivedAt: null, status: { not: "DONE" }, assignees: { some: { userId } }, dueDate: { lt: tomorrow } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }], take: 15,
      select: { title: true, dueDate: true, priority: true },
    });
    if (tasks.length === 0) { await reply("На сьогодні задач немає 🎉"); return; }
    const lines = tasks.map((t) => `${t.dueDate && t.dueDate < today ? "⚠️" : "•"} [${t.priority}] ${esc(t.title)}`);
    await reply(`<b>Сьогодні та прострочені (${tasks.length})</b>\n${lines.join("\n")}`);
    return;
  }

  if (cmd === "/tasks") {
    const tasks = await db.task.findMany({
      where: { archivedAt: null, status: { notIn: ["DONE"] }, assignees: { some: { userId } } },
      orderBy: [{ priority: "desc" }, { position: "asc" }], take: 15,
      select: { title: true, priority: true },
    });
    if (tasks.length === 0) { await reply("Відкритих задач немає ✅"); return; }
    const lines = tasks.map((t) => `• [${t.priority}] ${esc(t.title)}`);
    await reply(`<b>Мої задачі (${tasks.length})</b>\n${lines.join("\n")}`);
    return;
  }

  if (cmd.startsWith("/new")) {
    const title = cmd.slice(4).trim();
    if (!title) { await reply("Вкажіть назву: /new Підготувати звіт"); return; }
    await createFor(userId, title, "TODO");
    await reply(`✅ Задачу створено: <b>${esc(title)}</b> (дедлайн сьогодні)`);
    return;
  }
  if (cmd.startsWith("/idea")) {
    const title = cmd.slice(5).trim();
    if (!title) { await reply("Вкажіть назву: /idea Нова фіча"); return; }
    await createFor(userId, title, "IDEA");
    await reply(`💡 Ідею додано: <b>${esc(title)}</b> (колонка «Ідеї»)`);
    return;
  }

  // ожидание названия после кнопки «Задача»/«Ідея»
  if (acc.pendingAction && !text.startsWith("/")) {
    const status = acc.pendingAction === "idea" ? "IDEA" : "TODO";
    await createFor(userId, text, status);
    await db.telegramAccount.update({ where: { chatId: chat }, data: { pendingAction: null } });
    await reply(status === "IDEA" ? `💡 Ідею додано: <b>${esc(text)}</b>` : `✅ Задачу створено: <b>${esc(text)}</b> (дедлайн сьогодні)`);
    return;
  }

  await reply(`Не зрозумів. Скористайтесь кнопками або /help`);
}
