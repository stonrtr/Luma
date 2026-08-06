"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6, "Минимум 6 символов"),
  title: z.string().max(80).optional(),
  role: z.enum(["ADMIN", "MEMBER", "CLIENT"]).default("MEMBER"),
  hourlyRate: z.number().nullable().optional(),
});

export async function createUser(input: z.infer<typeof schema>) {
  const admin = await requireUser();
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    return { error: "Недостаточно прав" };
  }
  const data = schema.parse(input);

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) return { error: "Пользователь с таким email уже есть" };

  await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 10),
      title: data.title || null,
      role: data.role,
      hourlyRate: data.hourlyRate ?? null,
    },
  });

  revalidatePath("/admin/users");
  return { error: null };
}

export async function setUserActive(input: { userId: string; active: boolean }) {
  const admin = await requireUser();
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") return { error: "Немає прав" };
  if (input.userId === admin.id) return { error: "Не можна деактивувати себе" };
  const target = await db.user.findUnique({ where: { id: input.userId }, select: { role: true } });
  if (target?.role === "OWNER") return { error: "Не можна деактивувати власника" };
  await db.user.update({ where: { id: input.userId }, data: { isActive: input.active } });
  revalidatePath("/admin/users");
  return { error: null };
}

export async function deleteUser(userId: string) {
  const admin = await requireUser();
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") return { error: "Немає прав" };
  if (userId === admin.id) return { error: "Не можна видалити себе" };
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role === "OWNER") return { error: "Не можна видалити власника" };
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { error: null };
}
