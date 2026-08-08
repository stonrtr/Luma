import "server-only";
import { db } from "@/server/db";
import { sendTelegram } from "./api";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const HELP = [
  "<b>team M бот</b>",
  "",
  "/today — задачі на сьогодні",
  "/inbox — непрочитані сповіщення",
  "/tasks — мої відкриті задачі",
  "/new назва — створити задачу собі (дедлайн сьогодні)",
  "/idea назва — додати ідею (колонка «Ідеї»)",
  "/help — ця довідка",
].join("\n");

type Update = {
  message?: { chat?: { id?: number | string }; from?: { username?: string }; text?: string };
};

// Обработка входящего апдейта Telegram
export async function handleTelegramUpdate(update: Update): Promise<void> {
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text ?? "").trim();
  if (chatId == null || !text) return;
  const chat = String(chatId);

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
        await sendTelegram(chat, `✅ Підключено до акаунта <b>${esc(user.name)}</b>.\n\n${HELP}`);
        return;
      }
      await sendTelegram(chat, "Код недійсний. Згенеруйте новий у застосунку: Налаштування → Telegram.");
      return;
    }
    await sendTelegram(chat, `Вітаю! Щоб підключити акаунт, відкрийте у застосунку Налаштування → Telegram і натисніть «Підключити».\n\n${HELP}`);
    return;
  }

  // остальные команды — только для привязанного пользователя
  const acc = await db.telegramAccount.findUnique({ where: { chatId: chat }, select: { userId: true } });
  if (!acc) {
    await sendTelegram(chat, "Акаунт не підключено. Відкрийте застосунок: Налаштування → Telegram.");
    return;
  }
  const userId = acc.userId;

  if (text === "/help") { await sendTelegram(chat, HELP); return; }

  if (text === "/inbox") {
    const items = await db.notification.findMany({ where: { recipientId: userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 10 });
    if (items.length === 0) { await sendTelegram(chat, "Непрочитаних сповіщень немає ✅"); return; }
    const lines = items.map((n) => `• ${esc(n.message)}`);
    await sendTelegram(chat, `<b>Непрочитані (${items.length})</b>\n${lines.join("\n")}\n\n${APP_URL}`);
    return;
  }

  if (text === "/today") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const tasks = await db.task.findMany({
      where: { archivedAt: null, status: { not: "DONE" }, assignees: { some: { userId } }, dueDate: { lt: tomorrow } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 15,
      select: { id: true, title: true, dueDate: true, priority: true },
    });
    if (tasks.length === 0) { await sendTelegram(chat, "На сьогодні задач немає 🎉"); return; }
    const lines = tasks.map((t) => {
      const overdue = t.dueDate && t.dueDate < today;
      return `${overdue ? "⚠️" : "•"} [${t.priority}] ${esc(t.title)}`;
    });
    await sendTelegram(chat, `<b>Сьогодні та прострочені (${tasks.length})</b>\n${lines.join("\n")}`);
    return;
  }

  if (text === "/tasks") {
    const tasks = await db.task.findMany({
      where: { archivedAt: null, status: { notIn: ["DONE"] }, assignees: { some: { userId } } },
      orderBy: [{ priority: "desc" }, { position: "asc" }],
      take: 15,
      select: { title: true, priority: true, status: true },
    });
    if (tasks.length === 0) { await sendTelegram(chat, "Відкритих задач немає ✅"); return; }
    const lines = tasks.map((t) => `• [${t.priority}] ${esc(t.title)}`);
    await sendTelegram(chat, `<b>Мої задачі (${tasks.length})</b>\n${lines.join("\n")}`);
    return;
  }

  if (text.startsWith("/new")) {
    const title = text.slice(4).trim();
    if (!title) { await sendTelegram(chat, "Вкажіть назву: /new Підготувати звіт"); return; }
    const today = new Date(); today.setHours(23, 59, 0, 0);
    const last = await db.task.findFirst({ where: { status: "TODO", parentId: null, assignees: { some: { userId } } }, orderBy: { position: "desc" }, select: { position: true } });
    await db.task.create({
      data: {
        title: title.slice(0, 200), status: "TODO", priority: 5,
        createdById: userId, dueDate: today, position: (last?.position ?? -1) + 1,
        assignees: { create: [{ userId }] },
      },
    });
    await sendTelegram(chat, `✅ Задачу створено: <b>${esc(title)}</b> (дедлайн сьогодні)`);
    return;
  }

  if (text.startsWith("/idea")) {
    const title = text.slice(5).trim();
    if (!title) { await sendTelegram(chat, "Вкажіть назву: /idea Нова фіча"); return; }
    const last = await db.task.findFirst({ where: { status: "IDEA", parentId: null, assignees: { some: { userId } } }, orderBy: { position: "desc" }, select: { position: true } });
    await db.task.create({
      data: {
        title: title.slice(0, 200), status: "IDEA", priority: 5,
        createdById: userId, position: (last?.position ?? -1) + 1,
        assignees: { create: [{ userId }] },
      },
    });
    await sendTelegram(chat, `💡 Ідею додано: <b>${esc(title)}</b> (колонка «Ідеї»)`);
    return;
  }

  await sendTelegram(chat, `Не зрозумів команду.\n\n${HELP}`);
}
