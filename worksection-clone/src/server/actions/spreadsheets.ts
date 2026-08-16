"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { canManageUser } from "@/server/authz";

async function requireMember() {
  const user = await requireUser();
  if (user.role === "CLIENT") return null;
  return user;
}

// Доступ к конкретной таблице: владелец или его руководитель/админ.
async function canAccessSheet(viewer: { id: string; role: string }, sheetId: string): Promise<boolean> {
  const s = await db.spreadsheet.findUnique({ where: { id: sheetId }, select: { ownerId: true } });
  if (!s) return false;
  if (s.ownerId === viewer.id) return true;
  return canManageUser(viewer, s.ownerId);
}

// Автосохранение содержимого (JSON книги Univer как строка).
export async function saveSpreadsheet(input: { id: string; data: string }) {
  const user = await requireMember();
  if (!user) return { error: "Немає прав" };
  if (!(await canAccessSheet(user, input.id))) return { error: "Немає прав" };
  await db.spreadsheet.update({ where: { id: input.id }, data: { data: (input.data ?? "").slice(0, 5_000_000) } });
  return { error: null };
}

export async function renameSpreadsheet(input: { id: string; name: string }) {
  const user = await requireMember();
  if (!user) return { error: "Немає прав" };
  if (!(await canAccessSheet(user, input.id))) return { error: "Немає прав" };
  const name = input.name.trim();
  if (!name) return { error: "Порожня назва" };
  await db.spreadsheet.update({ where: { id: input.id }, data: { name: name.slice(0, 120) } });
  revalidatePath("/sheets");
  return { error: null };
}
