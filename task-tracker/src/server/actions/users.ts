"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireActionAdmin } from "@/server/dal";
import { createUserSchema } from "@/server/validation/user";
import { Role } from "@/generated/prisma/client";

export async function createUser(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  await requireActionAdmin();

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Некорректные данные";
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return "Пользователь с таким email уже существует";
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: Role.MEMBER,
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
