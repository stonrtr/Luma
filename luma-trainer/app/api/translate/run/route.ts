import { translatePendingBatch } from "@/lib/server/translateWorker";
import { json } from "@/lib/server/http";

// Retry pending/failed translations (§16.2.7). Runs synchronously and reports the count.
export async function POST() {
  const translated = await translatePendingBatch();
  return json({ ok: true, translated });
}
