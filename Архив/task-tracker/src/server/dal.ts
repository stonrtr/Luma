import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export async function requireActionUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function requireActionAdmin() {
  const user = await requireActionUser();
  if (user.role !== "ADMIN") throw new Error("Forbidden");
  return user;
}
