import "server-only";
import { db } from "@/server/db";
import { getValidAccessToken, isGoogleConfigured, APP_URL } from "./oauth";

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

// Нормализованное внешнее событие для календаря приложения
export type GoogleCalEvent = {
  id: string;
  title: string;
  start: string | null; // ISO, если событие со временем
  end: string | null;
  allDayDate: string | null; // YYYY-MM-DD, если событие «весь день»
  htmlLink: string | null;
  fromApp: boolean; // событие-зеркало нашей задачи (чтобы не дублировать)
};

async function calFetch(userId: string, path: string, init?: RequestInit): Promise<Response | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;
  return fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

// Прочитать события пользователя из Google Calendar за интервал
export async function listGoogleEvents(userId: string, timeMin: Date, timeMax: Date): Promise<GoogleCalEvent[]> {
  if (!isGoogleConfigured()) return [];
  const acc = await db.googleAccount.findUnique({ where: { userId }, select: { calendarId: true } });
  if (!acc) return [];
  const p = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await calFetch(userId, `/calendars/${encodeURIComponent(acc.calendarId)}/events?${p.toString()}`);
  if (!res || !res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((e: Record<string, unknown>) => {
    const start = e.start as { dateTime?: string; date?: string } | undefined;
    const end = e.end as { dateTime?: string; date?: string } | undefined;
    const desc = String(e.description ?? "");
    return {
      id: String(e.id),
      title: String(e.summary ?? "(без назви)"),
      start: start?.dateTime ?? null,
      end: end?.dateTime ?? null,
      allDayDate: start?.date ?? null,
      htmlLink: (e.htmlLink as string) ?? null,
      fromApp: desc.includes("/tasks/"),
    } satisfies GoogleCalEvent;
  });
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Собрать тело события Google из задачи. null — задачу нет смысла класть в календарь.
function taskToEventBody(task: { id: string; title: string; scheduledAt: Date | null; dueDate: Date | null; plannedMinutes: number | null }) {
  const description = `Задача у team M: ${APP_URL}/tasks/${task.id}`;
  if (task.scheduledAt) {
    const start = task.scheduledAt;
    const end = new Date(start.getTime() + (task.plannedMinutes ?? 60) * 60_000);
    return {
      summary: task.title,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    };
  }
  if (task.dueDate) {
    const day = new Date(task.dueDate);
    const next = new Date(day.getTime() + 24 * 3600_000);
    return { summary: task.title, description, start: { date: ymd(day) }, end: { date: ymd(next) } };
  }
  return null;
}

// Синхронизировать задачу в Google Calendar исполнителя (создать/обновить/удалить событие).
// Best-effort: любые ошибки/отсутствие подключения тихо игнорируются.
export async function syncTaskToGoogle(taskId: string): Promise<void> {
  if (!isGoogleConfigured()) return;
  try {
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true, title: true, scheduledAt: true, dueDate: true, plannedMinutes: true,
        googleEventId: true, archivedAt: true,
        assignees: { select: { userId: true }, take: 1 },
      },
    });
    if (!task) return;
    const ownerId = task.assignees[0]?.userId;
    if (!ownerId) return;
    const acc = await db.googleAccount.findUnique({ where: { userId: ownerId }, select: { calendarId: true } });
    if (!acc) return;
    const calPath = `/calendars/${encodeURIComponent(acc.calendarId)}/events`;

    const body = task.archivedAt ? null : taskToEventBody(task);

    // нечего показывать — удалить связанное событие, если было
    if (!body) {
      if (task.googleEventId) {
        await calFetch(ownerId, `${calPath}/${task.googleEventId}`, { method: "DELETE" });
        await db.task.update({ where: { id: task.id }, data: { googleEventId: null } });
      }
      return;
    }

    if (task.googleEventId) {
      await calFetch(ownerId, `${calPath}/${task.googleEventId}`, { method: "PATCH", body: JSON.stringify(body) });
    } else {
      const res = await calFetch(ownerId, calPath, { method: "POST", body: JSON.stringify(body) });
      if (res && res.ok) {
        const created = await res.json();
        if (created?.id) await db.task.update({ where: { id: task.id }, data: { googleEventId: String(created.id) } });
      }
    }
  } catch {
    // best-effort: не мешаем основному потоку
  }
}
