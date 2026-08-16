"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { putObject, deleteByUrl } from "@/server/storage";

export async function addFileLink(input: { name: string; url: string; note?: string; isTeam?: boolean }) {
  const user = await requireUser();
  const schema = z.object({ name: z.string().min(1).max(200), url: z.string().url("Невірне посилання"), note: z.string().max(500).optional(), isTeam: z.boolean().optional() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Помилка" };
  const isTeam = !!parsed.data.isTeam && (user.role === "OWNER" || user.role === "ADMIN");
  await db.fileLink.create({ data: { name: parsed.data.name.trim(), url: parsed.data.url, note: parsed.data.note?.trim() || null, kind: "LINK", isTeam, ownerId: user.id } });
  revalidatePath("/files");
  return { error: null };
}

export async function setDriveFolder(input: { userId?: string; url: string }) {
  const viewer = await requireUser();
  const targetId = input.userId || viewer.id;
  if (targetId !== viewer.id) {
    if (viewer.role !== "OWNER" && viewer.role !== "ADMIN") {
      const target = await db.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
      if (target?.managerId !== viewer.id) return { error: "Немає прав" };
    }
  }
  const url = input.url.trim();
  await db.user.update({ where: { id: targetId }, data: { driveFolderUrl: url || null } });
  revalidatePath("/files");
  revalidatePath("/org");
  return { error: null };
}

export async function uploadFileDoc(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Файл не вибрано" };
  if (file.size > 20 * 1024 * 1024) return { error: "Файл більше 20 МБ" };
  const safeName = file.name.replace(/[^\w.\-а-яА-ЯіїєґІЇЄҐ ]+/g, "_");
  const key = `files/${randomUUID()}-${safeName}`;
  const url = await putObject(key, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
  // отображаемое имя: введённое пользователем, иначе имя файла
  const displayName = (formData.get("name")?.toString().trim() || file.name).slice(0, 200);
  await db.fileLink.create({ data: { name: displayName, url, kind: "UPLOAD", ownerId: user.id } });
  revalidatePath("/files");
  return { error: null };
}

export async function deleteFile(id: string) {
  const user = await requireUser();
  const f = await db.fileLink.findUnique({ where: { id } });
  const isAdmin = user.role === "OWNER" || user.role === "ADMIN";
  if (!f || (f.ownerId !== user.id && !isAdmin)) return; // свій файл або адмін
  if (f.kind === "UPLOAD") await deleteByUrl(f.url); // з диска або S3; зовнішні посилання ігноруються
  await db.fileLink.delete({ where: { id } });
  revalidatePath("/files");
}

export async function shareFile(input: { fileId: string; userId: string; on: boolean }) {
  const user = await requireUser();
  const f = await db.fileLink.findUnique({ where: { id: input.fileId } });
  if (!f || f.ownerId !== user.id) return;
  if (input.on) {
    await db.fileShare.upsert({
      where: { fileId_userId: { fileId: input.fileId, userId: input.userId } },
      update: {}, create: { fileId: input.fileId, userId: input.userId },
    });
  } else {
    await db.fileShare.deleteMany({ where: { fileId: input.fileId, userId: input.userId } });
  }
  revalidatePath("/files");
}
