import "server-only";
import { db } from "@/server/db";

export async function getFiles(userId: string) {
  const [me, team, own, shared, users] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { driveFolderUrl: true } }),
    db.fileLink.findMany({
      where: { isTeam: true },
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { name: true } } },
    }),
    db.fileLink.findMany({
      where: { ownerId: userId, isTeam: false },
      orderBy: { createdAt: "desc" },
      include: { shares: { include: { user: { select: { id: true, name: true } } } } },
    }),
    db.fileLink.findMany({
      where: { isTeam: false, shares: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { name: true } } },
    }),
    db.user.findMany({ where: { isActive: true, id: { not: userId } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { team, own, shared, users, driveFolderUrl: me?.driveFolderUrl ?? null };
}
