import "server-only";
import { db } from "@/server/db";

// Данные раздела «Дзвінки»: члены команды + мои поінти к каждому
export async function getCallBoard(userId: string) {
  const [members, points] = await Promise.all([
    db.user.findMany({
      where: { role: { not: "CLIENT" }, isActive: true, id: { not: userId } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, title: true },
    }),
    db.callPoint.findMany({
      where: { authorId: userId },
      orderBy: [{ done: "asc" }, { createdAt: "asc" }],
      select: { id: true, text: true, done: true, memberId: true },
    }),
  ]);

  const byMember = new Map<string, typeof points>();
  for (const p of points) {
    const arr = byMember.get(p.memberId) ?? [];
    arr.push(p);
    byMember.set(p.memberId, arr);
  }

  return members.map((m) => ({ ...m, points: byMember.get(m.id) ?? [] }));
}
