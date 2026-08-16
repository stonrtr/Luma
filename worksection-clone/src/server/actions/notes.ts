"use server";

import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

// Автосохранение личной заметки (upsert одной строки на пользователя).
export async function saveNote(input: { body: string }) {
  const user = await requireUser();
  const body = (input.body ?? "").slice(0, 50000);
  await db.userNote.upsert({
    where: { userId: user.id },
    update: { body },
    create: { userId: user.id, body },
  });
  return { error: null };
}
