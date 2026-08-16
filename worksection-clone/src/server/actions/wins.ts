"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/dal";
import { mondayUtc } from "@/lib/week";

// Сохранить «Победы недели» за конкретную неделю (текущую или архивную). Только свои.
export async function saveWeeklyWin(input: { weekStart: string; text: string }) {
  const user = await requireUser();
  const raw = new Date(input.weekStart);
  if (isNaN(raw.getTime())) return { error: "Невірна дата" };
  const d = mondayUtc(raw); // снап к маркеру недели (UTC), чтобы ключ совпал с чтением
  const text = (input.text ?? "").slice(0, 5000);
  await db.weeklyWin.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart: d } },
    update: { text },
    create: { userId: user.id, weekStart: d, text },
  });
  revalidatePath("/planning");
  return { error: null };
}
