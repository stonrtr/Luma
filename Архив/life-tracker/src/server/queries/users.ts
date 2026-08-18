import "server-only";
import { db } from "@/server/db";

export async function getUsersNotInProject(projectId: string) {
  return db.user.findMany({
    where: { projectMembers: { none: { projectId } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, title: true },
  });
}

export async function getAllUsers() {
  return db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, title: true, role: true, isActive: true },
  });
}
