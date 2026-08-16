"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/server/db";
import { sendMail } from "@/server/mail";

// Сброс пароля по email. Токен живёт 1 час, в БД хранится только его sha256-хеш
// (utечка базы не даёт готовых ссылок сброса). Ответ всегда одинаковый — чтобы
// нельзя было перебором узнать, какие email зарегистрированы.

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function requestPasswordReset(emailRaw: string) {
  const generic = { error: null as string | null }; // анти-перечисление: всегда «ок»
  const email = (emailRaw ?? "").trim().toLowerCase();
  if (!email.includes("@")) return generic;

  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, isActive: true } });
  if (!user || !user.isActive) return generic;

  const token = randomBytes(32).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3100";
  const link = `${appUrl}/reset-password?token=${token}`;
  await sendMail({
    to: email,
    subject: "Скидання пароля — Workspace M",
    text:
      `Вітаємо, ${user.name}!\n\n` +
      `Щоб задати новий пароль, перейдіть за посиланням (діє 1 годину):\n${link}\n\n` +
      `Якщо ви не запитували скидання — просто проігноруйте цей лист.`,
    html:
      `<p>Вітаємо, <b>${user.name}</b>!</p>` +
      `<p>Щоб задати новий пароль, перейдіть за посиланням (діє 1 годину):</p>` +
      `<p><a href="${link}">Задати новий пароль</a></p>` +
      `<p style="color:#666">Якщо ви не запитували скидання — просто проігноруйте цей лист.</p>`,
  });
  return generic;
}

export async function resetPassword(input: { token: string; password: string }) {
  const schema = z.object({
    token: z.string().min(32),
    password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ошибка" };

  const user = await db.user.findFirst({
    where: { resetTokenHash: sha256(parsed.data.token), resetTokenExp: { gt: new Date() } },
    select: { id: true },
  });
  if (!user) return { error: "Ссылка недействительна или устарела. Запросите сброс ещё раз." };

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      resetTokenHash: null,
      resetTokenExp: null,
    },
  });
  return { error: null };
}
