import "server-only";
import { db } from "@/server/db";
import { isAdmin } from "@/server/authz";

// Персональная таблица пользователя (одна на человека). Создаём при первом обращении.
export async function getOrCreatePersonalSpreadsheet(userId: string, ownerName?: string) {
  const existing = await db.spreadsheet.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, data: true, ownerId: true },
  });
  if (existing) return existing;
  return db.spreadsheet.create({
    data: { name: ownerName ? `Таблиця — ${ownerName}` : "Моя таблиця", ownerId: userId, data: "" },
    select: { id: true, name: true, data: true, ownerId: true },
  });
}

// Список людей, чьи таблицы доступны наблюдателю: он сам + подчинённые.
// Админ/владелец видит таблицы всех активных сотрудников (кроме клиентов).
export async function getAccessibleSheetOwners(viewer: { id: string; role: string }) {
  const rows = isAdmin(viewer.role)
    ? await db.user.findMany({
        where: { isActive: true, role: { not: "CLIENT" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : await db.user.findMany({
        where: { isActive: true, role: { not: "CLIENT" }, OR: [{ id: viewer.id }, { managerId: viewer.id }] },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
  // Сам наблюдатель — всегда первым в списке.
  return rows.sort((a, b) => (a.id === viewer.id ? -1 : b.id === viewer.id ? 1 : 0));
}
