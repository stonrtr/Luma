import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
