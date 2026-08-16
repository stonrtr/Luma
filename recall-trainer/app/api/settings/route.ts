import { db } from "@/lib/db";
import { json, readJson, clampInt } from "@/lib/server/http";
import { toSettings } from "@/lib/serialize";
import { getSettingsRow } from "@/lib/server/settings";

export async function GET() {
  const row = await getSettingsRow();
  return json(toSettings(row));
}

export async function PATCH(req: Request) {
  const body = await readJson(req);
  await getSettingsRow(); // ensure exists
  const data: Record<string, unknown> = {};
  if ("newCardsPerDay" in body) data.newCardsPerDay = clampInt(body.newCardsPerDay, 0, 200, 10);
  if ("cardsPerDay" in body) data.cardsPerDay = clampInt(body.cardsPerDay, 1, 500, 40);
  if ("requiredSuccess" in body) data.requiredSuccess = clampInt(body.requiredSuccess, 1, 20, 3);
  if ("requiredStreak" in body) data.requiredStreak = clampInt(body.requiredStreak, 1, 20, 2);
  if ("minIntervalDays" in body) data.minIntervalDays = clampInt(body.minIntervalDays, 1, 365, 7);
  if ("progressThreshold" in body) data.progressThreshold = clampInt(body.progressThreshold, 50, 100, 100);
  if (typeof body.countHardAsCorrect === "boolean") data.countHardAsCorrect = body.countHardAsCorrect;
  if (typeof body.animationsEnabled === "boolean") data.animationsEnabled = body.animationsEnabled;
  if (typeof body.lastSection === "string") data.lastSection = body.lastSection.slice(0, 40);

  const row = await db.userSettings.update({ where: { id: "default" }, data });
  return json(toSettings(row));
}
