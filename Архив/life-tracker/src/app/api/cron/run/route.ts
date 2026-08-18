import { runScheduledMaintenance } from "@/server/scheduler";

export const dynamic = "force-dynamic";

// Плановый прогон обслуживания. Дёргается внешним планировщиком (cron / Vercel Cron):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://APP/api/cron/run
// В проде обязателен CRON_SECRET; в dev без него разрешено для удобства.
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : new URL(request.url).searchParams.get("key");
  const authorized = secret ? provided === secret : process.env.NODE_ENV !== "production";
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await runScheduledMaintenance();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
