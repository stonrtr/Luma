import "server-only";
import { db } from "@/server/db";
import { getNotificationConfig, type NotifConfig } from "@/server/queries/notification-settings";
import { notify } from "@/server/notify";
import { sendPushToUser } from "@/server/push";
import { sendTelegramToUser } from "@/server/telegram/api";
import { plannedLabel } from "@/lib/domain";
import { zonedWeekday, zonedMinutes } from "@/lib/tz";
import { listGoogleEvents } from "@/server/google/calendar";

const UA_TZ = "Europe/Kyiv";
const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Клавиатура «Так / Ні» под утренним планом (reply-кнопки, как в мастере бота)
const DAILY_YESNO_KB = { reply_markup: { keyboard: [[{ text: "Так" }, { text: "Ні" }]], resize_keyboard: true, one_time_keyboard: true } };

const MONTHS_UK = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];

// Склонение «задача» (uk): 1 задачу · 2–4 задачі · 5+ задач
function ukTasks(n: number): string {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return "задачу";
  if (d >= 2 && d <= 4 && (dd < 10 || dd >= 20)) return "задачі";
  return "задач";
}

// Дзвінки за сьогодні (зі застосунку + з Google-календаря користувача) — рядки «HH:MM–HH:MM Назва».
async function todayCallLines(userId: string, today: Date): Promise<string[]> {
  const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);
  const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const items: { startMin: number; label: string }[] = [];
  const appCalls = await db.call.findMany({ where: { userId, scheduledAt: { gte: today, lte: endOfDay } }, select: { title: true, scheduledAt: true, durationMin: true } });
  for (const c of appCalls) {
    const sm = zonedMinutes(new Date(c.scheduledAt), UA_TZ);
    items.push({ startMin: sm, label: `${hhmm(sm)}–${hhmm(sm + (c.durationMin || 30))} ${c.title}` });
  }
  for (const g of await listGoogleEvents(userId, today, endOfDay).catch(() => [])) {
    if (g.fromApp || !g.start) continue;
    const sm = zonedMinutes(new Date(g.start), UA_TZ);
    const em = g.end ? zonedMinutes(new Date(g.end), UA_TZ) : sm + 30;
    items.push({ startMin: sm, label: `${hhmm(sm)}–${hhmm(em)} ${g.title}` });
  }
  items.sort((a, b) => a.startMin - b.startMin);
  return items.slice(0, 12).map((c) => `• ${c.label}`);
}

// Автоочистка «одноразовых» записей, чтобы база не пухла. Удаляем ТОЛЬКО:
//  • ленту активности (аудит «кто что сделал») старше 30 дней;
//  • ПРОЧИТАННЫЕ уведомления старше 30 дней (непрочитанные не удаляем).
// НЕ ТРОГАЕМ НИКОГДА: задачи, комментарии, файлы, а также архивы —
// KPI, цели месяца, недельные приоритеты (weeklyPlanItem), победы недели (weeklyWin).
// Эти сущности удаляются только вручную из UI. Не добавляй их сюда.
const PRUNE_AFTER_DAYS = 30;
export async function pruneOldRecords(now = new Date()) {
  const cutoff = new Date(now.getTime() - PRUNE_AFTER_DAYS * 86400000);
  await db.activity.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await db.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lt: cutoff } } });
}

// Троттлинг: чистка тяжеловата для каждого запроса — гоняем не чаще раза в 12 часов.
let lastPruneAt = 0;
const PRUNE_THROTTLE_MS = 12 * 60 * 60 * 1000;
async function maybePrune(now: Date) {
  if (now.getTime() - lastPruneAt < PRUNE_THROTTLE_MS) return;
  lastPruneAt = now.getTime();
  try { await pruneOldRecords(now); } catch { /* не критично для рендера */ }
}

// Глобальное обслуживание: автоархив завершённых задач и проектов
export async function archiveCompleted(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  await db.task.updateMany({
    where: { status: "DONE", archivedAt: null, completedAt: { lt: weekAgo } },
    data: { archivedAt: now },
  });
  await db.project.updateMany({
    where: { status: "DONE", archivedAt: null },
    data: { archivedAt: now, status: "ARCHIVED" },
  });
}

// Напоминания одному пользователю: просрочка, просрочка у подчинённых, KPI.
// Флаги передаются извне, чтобы не читать настройки в цикле по всем сотрудникам.
export async function remindUser(
  userId: string,
  now = new Date(),
  configs?: Record<"daily_plan" | "overdue" | "kpi_reminder", NotifConfig>,
) {
  const cfg = configs ?? {
    daily_plan: await getNotificationConfig("daily_plan"),
    overdue: await getNotificationConfig("overdue"),
    kpi_reminder: await getNotificationConfig("kpi_reminder"),
  };
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const weekday = zonedWeekday(now, UA_TZ);
  const kyivMin = zonedMinutes(now, UA_TZ); // минуты от полуночи по Киеву
  // «пора слать»: тип включён, есть канал, будни (если задано) и наступило время из настроек
  const due = (c: NotifConfig) => c.enabled && (c.push || c.telegram) && (!c.weekdaysOnly || weekday <= 5) && c.sendAtMinutes != null && kyivMin >= c.sendAtMinutes;

  // План на сегодня — по расписанию из настроек. В Telegram — с вопросом и кнопками «Так/Ні».
  if (due(cfg.daily_plan)) {
    const already = await db.notification.findFirst({ where: { recipientId: userId, type: "daily_plan", createdAt: { gte: today } } });
    if (!already) {
      const endToday = new Date(today); endToday.setHours(23, 59, 59, 999);
      const tasks = await db.task.findMany({
        where: { archivedAt: null, status: { not: "DONE" }, dueDate: { lte: endToday }, assignees: { some: { userId } } },
        orderBy: [{ priority: "desc" }],
        select: { title: true, priority: true, plannedMinutes: true },
        take: 20,
      });
      // Дзвінки на сьогодні: зі застосунку + з Google-календаря (якщо підключений)
      const callArr = await todayCallLines(userId, today);
      const callLines = callArr.join("\n");
      const callItems = callArr; // назви нижче використовують .length

      if (tasks.length > 0 || callItems.length > 0) {
        const shown = tasks.slice(0, 12);
        const more = tasks.length > 12 ? `\n… +${tasks.length - 12}` : "";
        const dur = (m: number | null) => (m ? ` · ${plannedLabel(m, "uk")}` : "");
        // порядок: задача → пріоритет → час
        const plainLines = shown.map((t) => `• ${t.title} · п${t.priority}${dur(t.plannedMinutes)}`).join("\n");
        const taskPart = tasks.length > 0 ? `Судячи з занесених задач, ось ваш план на день:\n${plainLines}${more}` : "Задач із дедлайном на сьогодні немає.";
        const callPart = callItems.length > 0 ? `\n\n📞 Дзвінки сьогодні:\n${callLines}` : "";
        const planText = `Доброго ранку. ${taskPart}${callPart}`;
        await db.notification.create({ data: { type: "daily_plan", message: planText, recipientId: userId, link: "/" } });

        const ch = cfg.daily_plan;
        if (ch.push) await sendPushToUser(userId, { title: "Доброго ранку", body: planText, url: "/" }).catch(() => {});
        if (ch.telegram) {
          const tgLines = shown.map((t) => `• ${escHtml(t.title)} · п${t.priority}${dur(t.plannedMinutes)}`).join("\n");
          const tgTaskPart = tasks.length > 0 ? `Судячи з занесених задач, ось ваш план на день:\n${tgLines}${more}` : "Задач із дедлайном на сьогодні немає.";
          const tgCallPart = callArr.length > 0 ? `\n\n<b>📞 Дзвінки сьогодні:</b>\n${callArr.map((l) => escHtml(l)).join("\n")}` : "";
          const tgText = `<b>☀️ Доброго ранку</b>\n${tgTaskPart}${tgCallPart}\n\n<b>Бажаєте додати якусь задачу?</b>`;
          await sendTelegramToUser(userId, tgText, DAILY_YESNO_KB).catch(() => {});
        }
      }
    }
  }

  // «Не встигли сьогодні» — вечером, с 18:59; один мягкий итог за день, если есть незавершённые задачи с дедлайном сегодня/раньше
  if (due(cfg.overdue)) {
    const already = await db.notification.findFirst({ where: { recipientId: userId, type: "overdue", createdAt: { gte: today } } });
    if (!already) {
      const endToday = new Date(today); endToday.setHours(23, 59, 59, 999);
      const tasks = await db.task.findMany({
        // waitingForId=null — задачи, где «жду коллегу», не считаем моей просрочкой
        where: { archivedAt: null, status: { not: "DONE" }, dueDate: { lte: endToday }, waitingForId: null, assignees: { some: { userId } } },
        orderBy: [{ priority: "desc" }],
        select: { title: true, priority: true, plannedMinutes: true },
        take: 12,
      });
      // Закрытые сегодня: количество + список названий (для итога дня)
      const [doneToday, doneTasks] = await Promise.all([
        db.task.count({ where: { status: "DONE", completedAt: { gte: today }, assignees: { some: { userId } } } }),
        db.task.findMany({
          where: { status: "DONE", completedAt: { gte: today }, assignees: { some: { userId } } },
          orderBy: { completedAt: "desc" }, select: { title: true }, take: 12,
        }),
      ]);
      const doneList = doneTasks.map((t) => `• ${t.title}`).join("\n");
      const overdueList = tasks.map((t) => `• ${t.title} · п${t.priority}${t.plannedMinutes ? ` · ${plannedLabel(t.plannedMinutes, "uk")}` : ""}`).join("\n");

      // Нульова статистика — м'яка фраза без вини (ротація, форма «ви» — без роду).
      const ZERO_DONE = [
        "Дивно 🤔 Але за сьогодні немає жодної закритої задачі. Перевірте, будь ласка, чи всі виконані завдання ви відмітили в Workspace.",
        "Хм, за сьогодні немає закритих задач 🤔 Перевірте, будь ласка, чи не забули ви оновити статус виконаних завдань.",
        "Дивно, сьогодні Workspace не бачить жодної закритої задачі 👀 Якщо ви вже щось завершили, не забудьте оновити статус завдання.",
        "Схоже, сьогодні ще нічого не закрито 🤔 Перевірте, будь ласка, чи актуальні статуси ваших задач у Workspace.",
      ];
      // Є і виконані, і прострочені — шаблони користувача (ротація).
      const BOTH_TEMPLATES = [
        { h: "Підсумки дня 📋", d: "Сьогодні завершено:", o: "Є завдання з простроченим дедлайном:", c: "Якщо ви вже встигли їх виконати, закрийте, щоб вони не потрапили до завтрашнього нагадування зранку. ✅" },
        { h: "Результати за сьогодні 📊", d: "Виконано:", o: "Водночас залишаються завдання, дедлайн яких уже минув:", c: "Якщо завдання вже виконані, не забудьте закрити їх. ✅" },
        { h: "Підсумки на сьогодні 🙌", d: "Завершено:", o: "Потребують уваги завдання з простроченим дедлайном:", c: "Якщо ви вже виконали якесь із цих завдань, закрийте, щоб завтра воно не з'явилося у нагадуванні. ☑️" },
        { h: "Результати дня 📌", d: "Виконані завдання:", o: "Прострочені завдання:", c: "Якщо щось з простроченого уже виконано, закрийте відповідне завдання, щоб воно не потрапило до наступного нагадування. 👌" },
        { h: "День завершено ✨", d: "Сьогодні закрито:", o: "Наразі є завдання, термін виконання яких уже минув:", c: "Якщо ви все ж встигли їх виконати, закрийте їх, щоб завтра вони більше не відображалися. ✅" },
      ];

      // Дзвінки за сьогодні — блок між виконаними та простроченими
      const evCalls = await todayCallLines(userId, today);
      const callPart = evCalls.length > 0 ? `\n\n📞 Дзвінки сьогодні:\n${evCalls.join("\n")}` : "";

      let message: string | null = null;
      if (doneToday > 0 && tasks.length > 0) {
        const T = BOTH_TEMPLATES[Math.floor(Math.random() * BOTH_TEMPLATES.length)];
        message = `${T.h}\n${T.d}\n${doneList}${callPart}\n\n${T.o}\n${overdueList}\n\n${T.c}`;
      } else if (doneToday > 0) {
        // Прострочених немає — похвала (ротація, тексти користувача)
        const NO_OVERDUE = [
          "На сьогодні немає жодної простроченої задачі. Усі дедлайни під контролем 🙌",
          "Жодної задачі з простроченим дедлайном. Продовжуємо в тому ж темпі! 🚀",
          "На сьогодні прострочених задач немає. Так тримати! 🙌",
          "Схоже, з дедлайнами сьогодні повний порядок. Продовжуємо! 🚀",
          "На сьогодні немає жодної простроченої задачі. Чудовий результат! 👏",
        ];
        const praise = NO_OVERDUE[Math.floor(Math.random() * NO_OVERDUE.length)];
        message = `✅ Сьогодні закрито ${doneToday} ${ukTasks(doneToday)} 🎉\n${doneList}${callPart}\n\n${praise}`;
      } else if (tasks.length > 0) {
        // Підпис списку — з тих самих шаблонів користувача (ротація)
        const lead = BOTH_TEMPLATES[Math.floor(Math.random() * BOTH_TEMPLATES.length)].o;
        message = `${ZERO_DONE[Math.floor(Math.random() * ZERO_DONE.length)]}${callPart}\n\n${lead}\n${overdueList}\n\nНагадаю вам зранку 🌙`;
      }
      if (message) {
        await notify({ recipientId: userId, type: "overdue", message, link: "/" });
      }
    }
  }

  // Напоминание заполнить KPI за прошлый месяц — утром 1–3 числа
  if (due(cfg.kpi_reminder) && now.getDate() >= 1 && now.getDate() <= 3) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const unfilled = await db.kpi.count({ where: { userId, year: prev.getFullYear(), month: prev.getMonth(), actualValue: null } });
    if (unfilled > 0) {
      const tag = `kpi:${prev.getFullYear()}-${prev.getMonth()}`;
      const exists = await db.notification.findFirst({ where: { recipientId: userId, type: "kpi_reminder", message: { contains: tag } } });
      if (!exists) {
        await notify({ recipientId: userId, type: "kpi_reminder", message: `Заповніть виконання KPI за ${MONTHS_UK[prev.getMonth()]} · ${tag}`, link: "/planning" });
      }
    }
  }
}

// Обслуживание при заходе пользователя в приложение (фолбэк к планировщику)
export async function runLifecycleMaintenance(userId: string) {
  const now = new Date();
  await archiveCompleted(now);
  await maybePrune(now); // автоочистка старше 30 дней (журнал + прочитанные уведомления)
  await remindUser(userId, now);
}
