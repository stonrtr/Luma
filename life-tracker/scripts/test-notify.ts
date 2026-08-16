import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });
const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plannedLabel = (m: number) => (m < 60 ? `${m}хв` : Number.isInteger(m / 60) ? `${m / 60}год` : `${(m / 60).toFixed(1)}год`);

async function send(chatId: string, text: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }),
  });
  const j = await res.json();
  console.log(res.ok ? "✓ sent" : "✗ FAIL", j.ok ? "" : JSON.stringify(j));
}

async function main() {
  const acc = await db.telegramAccount.findFirst({ where: { user: { name: "Артур Стон" } }, select: { chatId: true, userId: true } });
  if (!acc) { console.log("Артур не привязан к Telegram"); return; }
  const { chatId, userId } = acc;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const endToday = new Date(today); endToday.setHours(23, 59, 59, 999);
  const tasks = await db.task.findMany({
    where: { archivedAt: null, status: { not: "DONE" }, dueDate: { lte: endToday }, assignees: { some: { userId } } },
    orderBy: [{ priority: "desc" }],
    select: { title: true, priority: true, plannedMinutes: true },
    take: 12,
  });

  // 1) Вечер 18:59 — итог дня (просрочка) со списком. Если задач нет — НЕ шлём ничего.
  if (tasks.length === 0) { console.log("нет незавершённых задач — ничего не отправляю (как и в проде)"); await db.$disconnect(); return; }
  const odList = tasks.map((t) => `• ${esc(t.title)} · п${t.priority}${t.plannedMinutes ? ` · ${plannedLabel(t.plannedMinutes)}` : ""}`).join("\n");
  await send(chatId, `🔔 <b>Підсумок дня</b>\nУпс. Здається, ви дещо не встигли сьогодні:\n${odList}\n\nНагадаю вам зранку 🌙`);

  await new Promise((r) => setTimeout(r, 1200));

  // 2) Утро 10:00 — план дня с реальными задачами + кнопки Так/Ні
  const lines = tasks.length
    ? tasks.map((t) => `• ${esc(t.title)} · п${t.priority}${t.plannedMinutes ? ` · ${plannedLabel(t.plannedMinutes)}` : ""}`).join("\n")
    : "• (немає задач з дедлайном сьогодні — це тестовий приклад)";
  const tgText = `<b>☀️ Доброго ранку</b>\nСудячи з занесених задач, ось ваш план на день:\n${lines}\n\n<b>Бажаєте додати якусь задачу?</b>`;
  await send(chatId, tgText, { reply_markup: { keyboard: [[{ text: "Так" }, { text: "Ні" }]], resize_keyboard: true, one_time_keyboard: true } });

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
