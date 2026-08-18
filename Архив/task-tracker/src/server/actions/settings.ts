"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireActionUser } from "@/server/dal";

const MAX_AVATAR_BYTES = 1_000_000;

export async function updateAvatar(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const user = await requireActionUser();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return "Выберите файл изображения";
  }
  if (!file.type.startsWith("image/")) {
    return "Файл должен быть изображением";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Файл слишком большой (максимум 1 МБ)";
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  await db.user.update({
    where: { id: user.id },
    data: { avatarUrl: dataUrl },
  });

  revalidatePath("/", "layout");
}
