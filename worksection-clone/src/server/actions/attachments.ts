"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { putObject, deleteByUrl } from "@/server/storage";

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
  const contentType = file.type || "application/octet-stream";
  const key = `tasks/${taskId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await putObject(key, buffer, contentType);

  await db.attachment.create({
    data: {
      fileName: file.name,
      mimeType: contentType,
      sizeBytes: file.size,
      url,
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
  await deleteByUrl(att.url); // удалит из хранилища (диск или S3), внешние ссылки игнорирует
  await db.attachment.delete({ where: { id: input.id } });
  revalidatePath(`/tasks/${input.taskId}`);
}
