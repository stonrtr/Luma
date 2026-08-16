import "server-only";
import { db } from "@/server/db";
import { zonedDateStr } from "@/lib/tz";

const UA_TZ = "Europe/Kyiv";

// Активные собеседники + их темы:
//  open      — не закрытые (в работе);
//  doneToday — закрытые сегодня (зачёркнуты, ещё в карточке, уйдут в архив в полночь);
//  archived  — закрытые в предыдущие дни (в архиве, с датой).
export async function getCallContacts(userId: string) {
  const todayStr = zonedDateStr(new Date(), UA_TZ);
  const contacts = await db.callContact.findMany({
    where: { ownerId: userId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      topics: {
        orderBy: { createdAt: "asc" },
        select: { id: true, text: true, closedAt: true },
      },
    },
  });

  return contacts
    .map((c) => {
      const open: { id: string; text: string }[] = [];
      const doneToday: { id: string; text: string }[] = [];
      const archived: { id: string; text: string; closedAt: string }[] = [];
      for (const t of c.topics) {
        if (!t.closedAt) open.push({ id: t.id, text: t.text });
        else if (zonedDateStr(t.closedAt, UA_TZ) === todayStr) doneToday.push({ id: t.id, text: t.text });
        else archived.push({ id: t.id, text: t.text, closedAt: t.closedAt.toISOString() });
      }
      archived.sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1)); // новые сверху
      return { id: c.id, name: c.name, open, doneToday, archived };
    })
    // больше открытых (в работе) тем — выше; без активных тем — внизу
    .sort((a, b) => b.open.length - a.open.length);
}

// Архивные собеседники (обратимо, можно вернуть) — с числом тем для контекста.
export async function getArchivedCallContacts(userId: string) {
  const rows = await db.callContact.findMany({
    where: { ownerId: userId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    select: { id: true, name: true, archivedAt: true, _count: { select: { topics: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, archivedAt: r.archivedAt!.toISOString(), topicCount: r._count.topics }));
}
