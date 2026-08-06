import "server-only";
import { db } from "@/server/db";

export async function getFiles(userId: string) {
  const [own, shared, users] = await Promise.all([
    db.fileLink.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      include: { shares: { include: { user: { select: { id: true, name: true } } } } },
    }),
    db.fileLink.findMany({
      where: { shares: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { name: true } } },
    }),
    db.user.findMany({ where: { isActive: true, id: { not: userId } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { own, shared, users };
}
