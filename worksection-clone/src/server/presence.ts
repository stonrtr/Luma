import "server-only";
import { db } from "@/server/db";

// Обновляет отметку последнего визита пользователя, но не чаще раза в ~5 минут,
// чтобы не писать в БД на каждый переход между страницами.
const THROTTLE_MS = 5 * 60 * 1000;

export async function touchLastSeen(userId: string, current: Date | null | undefined) {
  if (current && Date.now() - new Date(current).getTime() < THROTTLE_MS) return;
  try {
    await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  } catch {
    // не критично для рендера — молча игнорируем
  }
}
