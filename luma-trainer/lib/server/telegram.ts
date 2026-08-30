// Telegram-бот: присылаешь русскую фразу → бот переводит на английский (через
// тот же LLM, что и Luma) и предлагает добавить карточку в отдельный урок.
// Токен живёт только на сервере (§28). Webhook: POST /api/telegram/webhook.
import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { translateRuToEnFast } from "./translate";
import { getSettingsRow } from "./settings";
import { estimateDifficulty } from "../difficulty";
import { normalize } from "../lang";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ALLOWED_CHAT = (process.env.TELEGRAM_ALLOWED_CHAT_ID || "").trim();
export const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

export function hasTelegram(): boolean {
  return TOKEN.length > 0;
}

function isAllowed(chatId: number | string): boolean {
  if (!ALLOWED_CHAT) return true; // не задан — отвечаем всем (для первичной настройки)
  return String(chatId) === ALLOWED_CHAT;
}

// --- Telegram Bot API ------------------------------------------------------
const API = (method: string) => `https://api.telegram.org/bot${TOKEN}/${method}`;

async function tg(method: string, body: unknown): Promise<void> {
  try {
    await fetch(API(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    /* best-effort */
  }
}

function sendMessage(chatId: number | string, text: string, replyMarkup?: unknown): Promise<void> {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

function sendTyping(chatId: number | string): Promise<void> {
  return tg("sendChatAction", { chat_id: chatId, action: "typing" });
}

function answerCallback(id: string, text?: string): Promise<void> {
  return tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
}

function editMessageText(chatId: number | string, messageId: number, text: string, replyMarkup?: unknown): Promise<void> {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

/** Зарегистрировать webhook (server-side, токен не покидает сервер). */
export async function setWebhook(url: string): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await fetch(API("setWebhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        allowed_updates: ["message", "callback_query"],
        ...(WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const j = (await res.json()) as { ok: boolean; description?: string };
    return j;
  } catch (e) {
    return { ok: false, description: (e as Error).message };
  }
}

// --- Ожидающие подтверждения переводы (в памяти, короткоживущие) -----------
type Pending = {
  russian: string;
  candidates: string[]; // варианты перевода (лучший первым)
  chosen?: string; // выбранный пользователем вариант
  expires: number;
};
const pending = new Map<string, Pending>();
const PENDING_TTL_MS = 30 * 60 * 1000;

// Чат ждёт ручной ввод перевода: chatId → token ожидающей фразы.
const awaitingManual = new Map<number, string>();

function putPending(p: Omit<Pending, "expires">): string {
  const token = randomUUID().slice(0, 8);
  pending.set(token, { ...p, expires: Date.now() + PENDING_TTL_MS });
  // Чистим протухшие.
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
  return token;
}

// --- Обработка апдейтов -----------------------------------------------------
type TgUpdate = {
  message?: { chat: { id: number }; text?: string; from?: { id: number } };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
    from?: { id: number };
  };
};

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
}

async function handleMessage(msg: NonNullable<TgUpdate["message"]>): Promise<void> {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  if (!text) return;

  // Команды и первичная настройка.
  if (text === "/start" || text === "/help" || text === "/id") {
    const idNote = ALLOWED_CHAT
      ? ""
      : `\n\nТвой chat id: <code>${chatId}</code>\nВпиши его в переменную <b>TELEGRAM_ALLOWED_CHAT_ID</b> на сервере, чтобы бот отвечал только тебе.`;
    await sendMessage(
      chatId,
      `Привет! Пришли фразу на русском — переведу на английский и предложу добавить в один из твоих уроков Luma (уроки настраиваются в Luma → Настройки → «Импорт из Telegram»).${idNote}`
    );
    return;
  }

  if (!isAllowed(chatId)) {
    await sendMessage(chatId, "Этот бот приватный.");
    return;
  }

  // Ждём ручной ввод перевода для ранее присланной фразы?
  const awaitToken = awaitingManual.get(chatId);
  if (awaitToken) {
    awaitingManual.delete(chatId);
    const item = pending.get(awaitToken);
    if (item && item.expires >= Date.now()) {
      const chosen = text;
      item.chosen = chosen;
      item.candidates = Array.from(new Set([chosen, ...item.candidates])).slice(0, 6);
      const kb = await lessonKeyboard(awaitToken);
      if (!kb) {
        await sendMessage(chatId, `<b>${escapeHtml(chosen)}</b>\n\n<i>Куда добавить не выбрано. Отметь уроки в Luma → Настройки → «Импорт из Telegram».</i>`);
      } else {
        await sendMessage(chatId, `<b>${escapeHtml(chosen)}</b>\nДобавить в урок:`, kb);
      }
      return;
    }
    // Срок истёк — просто переведём это сообщение как новую фразу (ниже).
  }

  void sendTyping(chatId); // нативный «печатает…», пока идёт перевод

  try {
    const result = await translateRuToEnFast(text);
    const english = normalize(result.english || "");
    if (!english) {
      await sendMessage(chatId, "Не удалось перевести. Попробуй переформулировать.");
      return;
    }
    // Все варианты (лучший первым), без дублей.
    const candidates = Array.from(
      new Set([english, ...result.alternatives.map((t) => normalize(t))].filter(Boolean))
    ).slice(0, 6);

    const token = putPending({ russian: text, candidates });

    // Шаг 1: выбрать верный перевод (или ввести свой).
    const rows = candidates.map((t, i) => [
      { text: t.slice(0, 60), callback_data: `pick:${token}:${i}` },
    ]);
    rows.push([{ text: "✍️ Ввести свой", callback_data: `own:${token}` }]);
    rows.push([{ text: "✖️ Отмена", callback_data: `skip:${token}` }]);

    await sendMessage(chatId, `<b>${escapeHtml(text)}</b>\nВыбери верный перевод:`, {
      inline_keyboard: rows,
    });
  } catch {
    await sendMessage(chatId, "⚠️ Перевод временно недоступен (лимит или сеть). Попробуй ещё раз.");
  }
}

/** Клавиатура выбора урока для сохранения выбранного перевода. */
async function lessonKeyboard(token: string): Promise<{ inline_keyboard: { text: string; callback_data: string }[][] } | null> {
  const lessons = await targetLessons();
  if (lessons.length === 0) return null;
  const rows = lessons.map((l) => [
    { text: `📎 ${l.title}`.slice(0, 60), callback_data: `add:${token}:${l.id}` },
  ]);
  rows.push([{ text: "✖️ Не добавлять", callback_data: `skip:${token}` }]);
  return { inline_keyboard: rows };
}

/** Уроки-цели из настроек (в порядке отметки), только существующие/не архивные. */
async function targetLessons(): Promise<{ id: string; title: string }[]> {
  let ids: string[] = [];
  try {
    const row = await getSettingsRow();
    const parsed = JSON.parse(row.telegramLessonIds || "[]");
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    ids = [];
  }
  if (ids.length === 0) return [];
  const found = await db.lesson.findMany({
    where: { id: { in: ids }, archived: false },
    select: { id: true, title: true },
  });
  const byId = new Map(found.map((l) => [l.id, l]));
  return ids.map((id) => byId.get(id)).filter((l): l is { id: string; title: string } => !!l);
}

async function handleCallback(cb: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  const data = cb.data || "";
  if (chatId === undefined || messageId === undefined) {
    await answerCallback(cb.id);
    return;
  }
  if (!isAllowed(chatId)) {
    await answerCallback(cb.id, "Приватный бот");
    return;
  }

  const parts = data.split(":");
  const action = parts[0];
  const token = parts[1];
  const lessonId = parts.slice(2).join(":"); // на случай двоеточий (у cuid их нет)
  const item = token ? pending.get(token) : undefined;

  if (action === "skip") {
    if (token) { pending.delete(token); awaitingManual.delete(chatId); }
    await answerCallback(cb.id, "Отменено");
    await editMessageText(chatId, messageId, "✖️ Отменено.");
    return;
  }

  // Ручной ввод: ждём следующее сообщение как перевод.
  if (action === "own") {
    if (!item || item.expires < Date.now()) {
      await answerCallback(cb.id, "Устарело");
      await editMessageText(chatId, messageId, "⌛ Срок истёк — пришли фразу заново.");
      return;
    }
    awaitingManual.set(chatId, token);
    await answerCallback(cb.id, "Жду перевод");
    await editMessageText(chatId, messageId, `<b>${escapeHtml(item.russian)}</b>\n✍️ Напиши свой перевод ответным сообщением.`);
    return;
  }

  // Шаг 1 → 2: выбран верный перевод, теперь предлагаем урок.
  if (action === "pick") {
    if (!item || item.expires < Date.now()) {
      await answerCallback(cb.id, "Устарело");
      await editMessageText(chatId, messageId, "⌛ Срок истёк — пришли фразу заново.");
      return;
    }
    const idx = Number(lessonId); // третья часть = индекс варианта
    const chosen = item.candidates[idx];
    if (!chosen) {
      await answerCallback(cb.id);
      return;
    }
    item.chosen = chosen;
    await answerCallback(cb.id, "Выбрано");
    const kb = await lessonKeyboard(token);
    if (!kb) {
      await editMessageText(
        chatId,
        messageId,
        `<b>${escapeHtml(chosen)}</b>\n\n<i>Куда добавить не выбрано. Отметь уроки в Luma → Настройки → «Импорт из Telegram».</i>`
      );
      return;
    }
    await editMessageText(chatId, messageId, `<b>${escapeHtml(chosen)}</b>\nДобавить в урок:`, kb);
    return;
  }

  if (action === "add") {
    if (!item || item.expires < Date.now()) {
      await answerCallback(cb.id, "Устарело");
      await editMessageText(chatId, messageId, "⌛ Срок истёк — пришли фразу заново.");
      return;
    }
    const chosen = item.chosen || item.candidates[0];
    const lesson = lessonId
      ? await db.lesson.findFirst({ where: { id: lessonId, archived: false }, select: { id: true, title: true } })
      : null;
    if (!lesson) {
      await answerCallback(cb.id, "Урок не найден");
      await editMessageText(chatId, messageId, "⚠️ Урок недоступен. Проверь выбор в настройках Luma.");
      return;
    }
    pending.delete(token);
    try {
      await db.phraseCard.create({
        data: {
          lessonId: lesson.id,
          english: chosen,
          russian: item.russian,
          alternativeTranslations: JSON.stringify(item.candidates.filter((t) => t !== chosen).slice(0, 4)),
          difficulty: estimateDifficulty(chosen),
          translationStatus: "ready",
          dueAt: new Date(),
          source: JSON.stringify({ type: "telegram" }),
        },
      });
      await answerCallback(cb.id, "Добавлено ✅");
      await editMessageText(
        chatId,
        messageId,
        `✅ <b>${escapeHtml(chosen)}</b> → «${escapeHtml(lesson.title)}»`
      );
    } catch {
      await answerCallback(cb.id, "Ошибка");
      await editMessageText(chatId, messageId, "⚠️ Не удалось сохранить. Попробуй позже.");
    }
    return;
  }

  await answerCallback(cb.id);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
