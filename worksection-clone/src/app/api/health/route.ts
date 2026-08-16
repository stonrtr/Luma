import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Health-check для внешнего мониторинга (UptimeRobot / cron-job.org):
// 200 — приложение живо и база отвечает; 503 — база недоступна.
export async function GET() {
  try {
    await db.$queryRawUnsafe("select 1");
    return Response.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
