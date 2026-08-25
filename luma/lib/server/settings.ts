import "server-only";
import { db } from "../db";
import type { SrsSettings } from "../srs";

export async function getSettingsRow() {
  const existing = await db.userSettings.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return db.userSettings.create({ data: { id: "default" } });
}

export function toSrsSettings(row: {
  countHardAsCorrect: boolean;
  requiredSuccess: number;
  requiredStreak: number;
  minIntervalDays: number;
  progressThreshold: number;
}): SrsSettings {
  return {
    countHardAsCorrect: row.countHardAsCorrect,
    requiredSuccess: row.requiredSuccess,
    requiredStreak: row.requiredStreak,
    minIntervalDays: row.minIntervalDays,
    progressThreshold: row.progressThreshold,
  };
}

export async function getSrsSettings(): Promise<SrsSettings> {
  return toSrsSettings(await getSettingsRow());
}
