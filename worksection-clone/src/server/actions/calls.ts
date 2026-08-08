"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

// ---- Запланированные звонки (календарь) ----

const callSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string(),
  time: z.string(),
  durationMin: z.number().int().positive().default(30),
  userId: z.string().optional(), // кому (по умолчанию — себе)
});

export async function createCall(input: z.infer<typeof callSchema>) {
  const viewer = await requireUser();
  const data = callSchema.parse(input);
  const scheduledAt = new Date(`${data.date}T${data.time}`);
  if (isNaN(scheduledAt.getTime())) return { error: "Невірна дата/час" };

  const userId = data.userId || viewer.id;
  // назначать звонки другим может только админ/владелец или руководитель
  if (userId !== viewer.id && viewer.role !== "OWNER" && viewer.role !== "ADMIN") {
    const target = await db.user.findUnique({ where: { id: userId }, select: { managerId: true } });
    if (target?.managerId !== viewer.id) return { error: "Немає прав" };
  }

  await db.call.create({ data: { title: data.title.trim(), scheduledAt, durationMin: data.durationMin, userId } });
  revalidatePath("/calendar");
  return { error: null };
}

export async function deleteCall(id: string) {
  const viewer = await requireUser();
  const call = await db.call.findUnique({ where: { id } });
  if (!call) return;
  if (call.userId !== viewer.id && viewer.role !== "OWNER" && viewer.role !== "ADMIN") return;
  await db.call.delete({ where: { id } });
  revalidatePath("/calendar");
}

// ---- Поінти до дзвінка (что обсудить с членом команды) ----

export async function addCallPoint(input: { memberId: string; text: string }) {
  const user = await requireUser();
  const text = input.text.trim();
  if (!text) return { error: "Порожній пункт" };
  await db.callPoint.create({ data: { authorId: user.id, memberId: input.memberId, text } });
  revalidatePath("/calls");
  return { error: null };
}

export async function toggleCallPoint(id: string) {
  const user = await requireUser();
  const p = await db.callPoint.findUnique({ where: { id } });
  if (!p || p.authorId !== user.id) return;
  await db.callPoint.update({ where: { id }, data: { done: !p.done } });
  revalidatePath("/calls");
}

export async function deleteCallPoint(id: string) {
  const user = await requireUser();
  const p = await db.callPoint.findUnique({ where: { id } });
  if (!p || p.authorId !== user.id) return;
  await db.callPoint.delete({ where: { id } });
  revalidatePath("/calls");
}

// ---- Извлечение задач из саммари созвона в «Ідеї» ----

// Эвристический разбор: берём строки-пункты, похожие на задачи.
function heuristicExtract(summary: string): string[] {
  const lines = summary
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·▪◦]|\d+[.)]|[a-zа-яґєіїA-ZА-ЯҐЄІЇ][.)])\s+/u, "").trim())
    .filter(Boolean);

  const actionWords = /(зроби|додай|підготу|напиши|створи|перевір|надішли|узгодь|з'ясуй|виправ|онови|проаналізуй|запланова|сделать|подготов|написать|создать|проверить|отправить|согласовать|выяснить|исправить|обновить|запланировать|todo|task|need to|should|must)/iu;

  const candidates = (lines.length > 1 ? lines : summary.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 200)
    .filter((s) => lines.length > 1 || actionWords.test(s));

  // если бул-листов не было и глаголов не нашли — берём непустые предложения
  const result = candidates.length ? candidates : lines;
  // dedupe + лимит
  return [...new Set(result)].slice(0, 30);
}

const EXTRACT_PROMPT =
  "Ось саммарі робочого дзвінка. Виокрем із нього чіткі задачі до виконання (тільки конкретні дії). " +
  "Поверни ЛИШЕ JSON-масив рядків, без пояснень, кожен рядок — коротке формулювання задачі українською.\n\n";

// Достать JSON-массив строк из ответа модели
function parseTitles(text: string): string[] | null {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 30) : null;
  } catch { return null; }
}

// Один вызов Gemini конкретной моделью. status=429 → лимит (пробуем следующую модель).
async function geminiCall(key: string, model: string, summary: string): Promise<{ titles: string[] | null; rateLimited: boolean }> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "user", content: EXTRACT_PROMPT + summary }] }),
    });
    if (res.status === 429) return { titles: null, rateLimited: true };
    if (!res.ok) return { titles: null, rateLimited: false };
    const data = await res.json();
    return { titles: parseTitles(data?.choices?.[0]?.message?.content ?? ""), rateLimited: false };
  } catch { return { titles: null, rateLimited: false }; }
}

// Google Gemini с авто-переключением моделей при исчерпании лимита.
async function geminiExtract(summary: string): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const primary = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
  // при лимите переходим на модели с более щедрими квотами
  const chain = [...new Set([primary, "gemini-2.5-flash", "gemini-2.0-flash"])];
  for (const model of chain) {
    const { titles, rateLimited } = await geminiCall(key, model, summary);
    if (titles && titles.length) return titles;
    if (!rateLimited && titles !== null) return titles; // модель ответила (пусть и пусто) — не лимит
    // rateLimited или ошибка → пробуем следующую модель
  }
  return null;
}

// Anthropic Claude (если задан ключ)
async function anthropicExtract(summary: string): Promise<string[] | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content: EXTRACT_PROMPT + summary }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseTitles(data?.content?.[0]?.text ?? "");
  } catch { return null; }
}

// Сначала Gemini, затем Anthropic; null → откат на эвристику
async function aiExtract(summary: string): Promise<string[] | null> {
  return (await geminiExtract(summary)) ?? (await anthropicExtract(summary));
}

// Только извлекаем задачи из саммари (без создания) — далее сотрудник
// проходит их мастером по одной, задаёт приоритет и дедлайн.
export async function extractTaskTitles(input: { summary: string }): Promise<{ error: string | null; titles: string[] }> {
  await requireUser();
  const summary = input.summary.trim();
  if (summary.length < 10) return { error: "Замало тексту", titles: [] };

  const titles = ((await aiExtract(summary)) ?? heuristicExtract(summary)).map((t) => t.slice(0, 200));
  if (titles.length === 0) return { error: "Не вдалося виокремити задачі", titles: [] };
  return { error: null, titles };
}
