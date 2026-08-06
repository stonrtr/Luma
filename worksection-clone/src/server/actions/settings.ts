"use server";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const profileSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  avatarUrl: z.string().max(500).optional().nullable(),
});

export async function updateProfile(input: z.infer<typeof profileSchema>) {
  const user = await requireUser();
  const data = profileSchema.parse(input);
  const firstName = (data.firstName ?? "").trim();
  const lastName = (data.lastName ?? "").trim();
  const name = `${firstName} ${lastName}`.trim() || user.name;
  await db.user.update({
    where: { id: user.id },
    data: { firstName: firstName || null, lastName: lastName || null, name, avatarUrl: data.avatarUrl ?? undefined },
  });
  revalidatePath("/", "layout");
  return { error: null };
}

const prefsSchema = z.object({
  locale: z.enum(["uk", "ru", "en"]).optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  timezone: z.string().max(60).optional(),
  weekStartsMon: z.boolean().optional(),
});

export async function updatePreferences(input: z.infer<typeof prefsSchema>) {
  const user = await requireUser();
  const data = prefsSchema.parse(input);
  await db.user.update({ where: { id: user.id }, data });
  revalidatePath("/", "layout");
  return { error: null };
}

export async function changePassword(input: { current: string; next: string }) {
  const user = await requireUser();
  if (input.next.length < 6) return { error: "Мінімум 6 символів" };
  const ok = await bcrypt.compare(input.current, user.passwordHash);
  if (!ok) return { error: "Невірний поточний пароль" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.next, 10) } });
  return { error: null };
}

export async function uploadAvatar(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Файл не вибрано" };
  if (file.size > 4 * 1024 * 1024) return { error: "Файл більше 4 МБ" };

  const ext = (file.name.split(".").pop() || "png").replace(/[^\w]/g, "");
  const key = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "avatars");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), Buffer.from(await file.arrayBuffer()));

  await db.user.update({ where: { id: user.id }, data: { avatarUrl: `/uploads/avatars/${key}` } });
  revalidatePath("/", "layout");
  return { error: null, url: `/uploads/avatars/${key}` };
}
