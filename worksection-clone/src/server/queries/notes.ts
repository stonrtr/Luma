import "server-only";
import { db } from "@/server/db";

// Личный скретчпад пользователя (одна заметка). Пусто, пока не написал.
export async function getUserNote(userId: string): Promise<string> {
  const n = await db.userNote.findUnique({ where: { userId }, select: { body: true } });
  return n?.body ?? "";
}
