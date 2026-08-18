import "server-only";
import { db } from "@/server/db";

// Единый слой проверок прав.

export function isAdmin(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

// Является ли viewer непосредственным руководителем target (self → false)
export async function isManagerOf(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return false;
  const t = await db.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
  return t?.managerId === viewerId;
}

// Может ли viewer управлять пользователем target (админ/власник или его руководитель)
export async function canManageUser(viewer: { id: string; role: string }, targetId: string): Promise<boolean> {
  if (isAdmin(viewer.role)) return true;
  return isManagerOf(viewer.id, targetId);
}
