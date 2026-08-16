"use server";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

const MAX_BYTES = 10 * 1024 * 1024; // 10 МБ

export async function uploadAttachment(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const file = formData.get("file");

  if (!taskId || !(file instanceof File) || file.size === 0) {
    return { error: "Файл не выбран" };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Файл больше 10 МБ" };
  }

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Задача не найдена" };

  const safeName = file.name.replace(/[^\w.\-а-яА-ЯёЁ ]+/g, "_");
  const key = `${randomUUID()}-${safeName}`;
  const dir = path.join(process.cwd(), "public", "uploads", taskId);
  await fs.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, key), buffer);

  await db.attachment.create({
    data: {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      url: `/uploads/${taskId}/${key}`,
      uploadedById: user.id,
      taskId,
    },
  });

  revalidatePath(`/tasks/${taskId}`);
  return { error: null };
}

export async function deleteAttachment(input: { id: string; taskId: string }) {
  await requireUser();
  const att = await db.attachment.findUnique({ where: { id: input.id } });
  if (!att) return;
  // удаляем файл с диска, если он локальный
  if (att.url.startsWith("/uploads/")) {
    try {
      await fs.unlink(path.join(process.cwd(), "public", att.url));
    } catch {
      // файл мог быть уже удалён — не критично
    }
  }
  await db.attachment.delete({ where: { id: input.id } });
  revalidatePath(`/tasks/${input.taskId}`);
}
