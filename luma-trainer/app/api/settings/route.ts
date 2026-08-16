import { db } from "@/lib/db";
import { getSettingsRow } from "@/lib/server/settings";
import { toSettings } from "@/lib/serialize";
import { clampInt, json, readJson, str } from "@/lib/server/http";

export async function GET() {
  const row = await getSettingsRow();
  return json(toSettings(row));
}

export async function PATCH(req: Request) {
  const body = await readJson(req);
  await getSettingsRow(); // ensure singleton exists

  const data: Record<string, unknown> = {};
  if ("cardsPerDay" in body) data.cardsPerDay = clampInt(body.cardsPerDay, 1, 500, 40);
  if ("newCardsPerDay" in body) data.newCardsPerDay = clampInt(body.newCardsPerDay, 0, 200, 15);
  if ("showFirst" in body) data.showFirst = body.showFirst === "ru" ? "ru" : "en";
  if ("voice" in body) data.voice = str(body.voice, 100);
  if ("speechRate" in body)
    data.speechRate = Math.max(0.5, Math.min(2, Number(body.speechRate) || 1));
  if ("autoPlay" in body) data.autoPlay = !!body.autoPlay;
  if ("requiredSuccess" in body) data.requiredSuccess = clampInt(body.requiredSuccess, 1, 20, 4);
  if ("requiredStreak" in body) data.requiredStreak = clampInt(body.requiredStreak, 1, 20, 3);
  if ("minIntervalDays" in body) data.minIntervalDays = clampInt(body.minIntervalDays, 1, 365, 7);
  if ("countHardAsCorrect" in body) data.countHardAsCorrect = !!body.countHardAsCorrect;
  if ("progressThreshold" in body) data.progressThreshold = clampInt(body.progressThreshold, 50, 100, 100);
  if ("animationsEnabled" in body) data.animationsEnabled = !!body.animationsEnabled;
  if ("theme" in body)
    data.theme = ["blue", "green", "purple", "red"].includes(body.theme as string)
      ? body.theme
      : "blue";
  if ("lastSection" in body) data.lastSection = str(body.lastSection, 40);

  const row = await db.userSettings.update({ where: { id: "default" }, data });
  return json(toSettings(row));
}
