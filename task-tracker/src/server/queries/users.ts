import "server-only";
import { db } from "@/server/db";

export function getUsers() {
  return db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
    },
  });
}

export function getUser(id: string) {
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true },
  });
}
