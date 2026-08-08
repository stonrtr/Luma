import "server-only";
import { db } from "@/server/db";
import { sendTelegram } from "./api";

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Кнопки ---
const BTN = { task: "➕ Задача", idea: "💡 Ідея", tasks: "📋 Мої задачі", today: "📅 Сьогодні", inbox: "🔔 Сповіщення" };
const CANCEL = "❌ Відміна";

const MAIN_KB = { reply_markup: { keyboard: [
  [{ text: BTN.task }, { text: BTN.idea }],
  [{ text: BTN.tasks }, { text: BTN.today }],
  [{ text: BTN.inbox }],
], resize_keyboard: true, is_persistent: true } };
const CANCEL_KB = { reply_markup: { keyboard: [[{ text: CANCEL }]], resize_keyboard: true } };
const PRIORITY_KB = { reply_markup: { keyboard: [
  [1, 2, 3, 4, 5].map((n) => ({ text: String(n) })),
  [6, 7, 8, 9, 10].map((n) => ({ text: String(n) })),
  [{ text: CANCEL }],
], resize_keyboard: true } };
const DL = { today: "Сьогодні до кінця дня", tomorrowNoon: "Завтра до обіду", tomorrow: "Завтра до кінця дня", weekEnd: "До кінця тижня" };
const DEADLINE_KB = { reply_markup: { keyboard: [
  [{ text: DL.today }],
  [{ text: DL.tomorrowNoon }, { text: DL.tomorrow }],
  [{ text: DL.weekEnd }],
  [{ text: CANCEL }],
], resize_keyboard: true } };

const HELP = [
  "<b>team M бот</b>",
  "",
  "Кнопки нижче або команди:",
  "➕ Задача — назва → пріоритет → дедлайн",
  "💡 Ідея — лише назва",
  "/today · /tasks · /inbox · /help",
].join("\n");

const REQUEST_CONTACT_KB = { reply_markup: { keyboard: [[{ text: "📱 Поділитися номером", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };
const normPhone = (s: string) => s.replace(/\D/g, "");
const sameLast10 = (a: string, b: string) => a.length >= 10 && a.slice(-10) === b.slice(-10);

function endOfDay(d: Date): Date { d.setHours(19, 0, 0, 0); return d; } // кінець робочого дня — 19:00
function parseDeadline(text: string): Date | null {
  const day = 86400000;
  switch (text) {
    case DL.today: return endOfDay(new Date());
    case DL.tomorrowNoon: { const d = new Date(Date.now() + day); d.setHours(12, 0, 0, 0); return d; }
    case DL.tomorrow: return endOfDay(new Date(Date.now() + day));
    case DL.weekEnd: { const now = new Date(); const add = (5 - now.getDay() + 7) % 7; return endOfDay(new Date(Date.now() + add * day)); } // до п'ятниці
    default: return null;
  }
}
function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function createFor(userId: string, title: string, status: "TODO" | "IDEA", opts?: { priority?: number; dueDate?: Date }) {
  const last = await db.task.findFirst({ where: { status, parentId: null, assignees: { some: { userId } } }, orderBy: { position: "desc" }, select: { position: true } });
  await db.task.create({
    data: {
      title: title.slice(0, 200), status, priority: opts?.priority ?? 5,
      createdById: userId, dueDate: opts?.dueDate ?? null,
      position: (last?.position ?? -1) + 1, assignees: { create: [{ userId }] },
    },
  });
}

type State = { flow: "task" | "idea"; step: string; title?: string; priority?: number };
function readState(raw: string | null): State | null {
  if (!raw) return null;
  try { const s = JSON.parse(raw); return s && s.flow ? s : null; } catch { return null; }
}

type Update = { message?: { chat?: { id?: number | string }; from?: { username?: string }; text?: string; contact?: { phone_number?: string } } };

export async function handleTelegramUpdate(update: Update): Promise<void> {
  const msg = update.message;
  const chatId = msg?.chat?.id;
  if (chatId == null) return;
  const chat = String(chatId);
  const reply = (t: string, kb: Record<string, unknown> = MAIN_KB) => sendTelegram(chat, t, kb);

  // --- привязка по номеру телефона (пользователь поделился контактом) ---
  const contactPhone = msg?.contact?.phone_number;
  if (contactPhone) {
    const digits = normPhone(contactPhone);
    const users = await db.user.findMany({ where: { phone: { not: null }, isActive: true }, select: { id: true, name: true, phone: true } });
    const match = users.find((u) => u.phone && sameLast10(normPhone(u.phone), digits));
    if (match) {
      await db.telegramAccount.upsert({
        where: { userId: match.id },
        create: { userId: match.id, chatId: chat, username: msg?.from?.username ?? null },
        update: { chatId: chat, username: msg?.from?.username ?? null },
      });
      await reply(`✅ Підключено за номером до акаунта <b>${esc(match.name)}</b>.\n\n${HELP}`);
    } else {
      await reply("Номер не знайдено серед співробітників. Впишіть цей номер у профіль (Налаштування → Профіль) і спробуйте ще раз.");
    }
    return;
  }

  const text = (msg?.text ?? "").trim();
  if (!text) return;
  const setState = (s: State | null) => db.telegramAccount.update({ where: { chatId: chat }, data: { pendingAction: s ? JSON.stringify(s) : null } });

  // /start <code> — привязка
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
      await reply("Код недійсний. Згенеруйте новий: Налаштування → Telegram.");
      return;
    }
    await reply(`Вітаю! Підключіть акаунт: Налаштування → Telegram → «Підключити».\n\n${HELP}`);
    return;
  }

  const acc = await db.telegramAccount.findUnique({ where: { chatId: chat }, select: { userId: true, pendingAction: true } });
  if (!acc) { await sendTelegram(chat, "Акаунт не підключено. Поділіться номером телефону, вказаним у вашому профілі 👇 (або підключіть у застосунку: Налаштування → Telegram).", REQUEST_CONTACT_KB); return; }
  const userId = acc.userId;
  const state = readState(acc.pendingAction);

  // Отмена мастера
  if (text === CANCEL) { await setState(null); await reply("Скасовано."); return; }

  // --- Мастер задачи ---
  if (state?.flow === "task") {
    if (state.step === "title") {
      await setState({ flow: "task", step: "priority", title: text });
      await reply(`Задача: <b>${esc(text)}</b>\n\nОберіть <b>пріоритет</b> (1–10):`, PRIORITY_KB);
      return;
    }
    if (state.step === "priority") {
      const p = Number(text);
      if (!Number.isInteger(p) || p < 1 || p > 10) { await reply("Оберіть число 1–10 кнопкою:", PRIORITY_KB); return; }
      await setState({ flow: "task", step: "deadline", title: state.title, priority: p });
      await reply("Оберіть <b>дедлайн</b>:", DEADLINE_KB);
      return;
    }
    if (state.step === "deadline") {
      const due = parseDeadline(text);
      if (!due) { await reply("Оберіть дедлайн кнопкою:", DEADLINE_KB); return; }
      await createFor(userId, state.title ?? "Без назви", "TODO", { priority: state.priority, dueDate: due });
      await setState(null);
      await reply(`✅ Задачу створено: <b>${esc(state.title ?? "")}</b>\nПріоритет ${state.priority}\nДедлайн ${fmtDate(due)}`);
      return;
    }
  }
  // --- Идея: только название ---
  if (state?.flow === "idea" && state.step === "title") {
    await createFor(userId, text, "IDEA");
    await setState(null);
    await reply(`💡 Ідею додано: <b>${esc(text)}</b> (колонка «Ідеї»)`);
    return;
  }

  // Кнопки, начинающие мастер
  if (text === BTN.task) { await setState({ flow: "task", step: "title" }); await reply("✍️ Напишіть <b>назву задачі</b>:", CANCEL_KB); return; }
  if (text === BTN.idea) { await setState({ flow: "idea", step: "title" }); await reply("✍️ Напишіть <b>назву ідеї</b>:", CANCEL_KB); return; }

  // Списки (кнопки/команды)
  let cmd = text;
  if (text === BTN.tasks) cmd = "/tasks"; else if (text === BTN.today) cmd = "/today"; else if (text === BTN.inbox) cmd = "/inbox";

  if (cmd === "/help") { await reply(HELP); return; }

  if (cmd === "/inbox") {
    const items = await db.notification.findMany({ where: { recipientId: userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 10 });
    if (items.length === 0) { await reply("Непрочитаних сповіщень немає ✅"); return; }
    await reply(`<b>Непрочитані (${items.length})</b>\n${items.map((n) => `• ${esc(n.message)}`).join("\n")}\n\n${APP_URL}`);
    return;
  }
  if (cmd === "/today") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const tasks = await db.task.findMany({ where: { archivedAt: null, status: { not: "DONE" }, assignees: { some: { userId } }, dueDate: { lt: tomorrow } }, orderBy: [{ dueDate: "asc" }, { priority: "desc" }], take: 15, select: { title: true, dueDate: true, priority: true } });
    if (tasks.length === 0) { await reply("На сьогодні задач немає 🎉"); return; }
    await reply(`<b>Сьогодні та прострочені (${tasks.length})</b>\n${tasks.map((t) => `${t.dueDate && t.dueDate < today ? "⚠️" : "•"} [${t.priority}] ${esc(t.title)}`).join("\n")}`);
    return;
  }
  if (cmd === "/tasks") {
    const tasks = await db.task.findMany({ where: { archivedAt: null, status: { notIn: ["DONE"] }, assignees: { some: { userId } } }, orderBy: [{ priority: "desc" }, { position: "asc" }], take: 15, select: { title: true, priority: true } });
    if (tasks.length === 0) { await reply("Відкритих задач немає ✅"); return; }
    await reply(`<b>Мої задачі (${tasks.length})</b>\n${tasks.map((t) => `• [${t.priority}] ${esc(t.title)}`).join("\n")}`);
    return;
  }
  // Быстрые текстовые команды
  if (cmd.startsWith("/idea")) { const t = cmd.slice(5).trim(); if (!t) { await reply("Вкажіть назву: /idea Нова фіча"); return; } await createFor(userId, t, "IDEA"); await reply(`💡 Ідею додано: <b>${esc(t)}</b>`); return; }
  if (cmd.startsWith("/new")) { const t = cmd.slice(4).trim(); if (!t) { await reply("Натисніть ➕ Задача або: /new Назва"); return; } await setState({ flow: "task", step: "priority", title: t }); await reply(`Задача: <b>${esc(t)}</b>\n\nОберіть <b>пріоритет</b> (1–10):`, PRIORITY_KB); return; }

  await reply("Скористайтесь кнопками нижче або /help");
}
