import "server-only";
import webpush from "web-push";
import { db } from "@/server/db";

const PUB = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIV = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

export function isPushConfigured(): boolean {
  return !!(PUB && PRIV);
}

let configured = false;
function ensureConfigured() {
  if (!configured && isPushConfigured()) {
    webpush.setVapidDetails(SUBJECT, PUB, PRIV);
    configured = true;
  }
  return configured;
}

export type PushPayload = { title: string; body: string; url?: string };

// Отправить web-push всем подпискам пользователя. Мёртвые подписки удаляем.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
}
