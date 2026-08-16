import { requireUser } from "@/server/dal";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Лёгкий эндпоинт для живого поллинга пушей в приложении (тостер снизу справа + звук).
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ items: [], unread: 0 }, { status: 401 });
  }

  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, type: true, message: true, link: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { recipientId: user.id, readAt: null } }),
  ]);

  return Response.json({
    unread,
    items: rows.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      link: n.link,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
