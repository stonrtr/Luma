import "server-only";
import { db } from "@/server/db";

export async function getNotifications(userId: string) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: true },
    }),
    db.notification.count({ where: { recipientId: userId, readAt: null } }),
  ]);
  return { items, unread };
}
