import "server-only";
import { db } from "@/server/db";

// Все файлы — общий пул команды: кто угодно прикрепляет, видят все.
export async function getFiles(userId: string) {
  const [files, viewer] = await Promise.all([
    db.fileLink.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { id: true, name: true } } },
    }),
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  return { files, viewerId: userId, isAdmin: viewer?.role === "OWNER" || viewer?.role === "ADMIN" };
}
