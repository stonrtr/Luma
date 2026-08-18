"use server";

import { db } from "@/server/db";
import { requireUser } from "@/server/dal";

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }) {
  const user = await requireUser();
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
    update: { userId: user.id, p256dh: sub.p256dh, auth: sub.auth },
  });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  await requireUser();
  await db.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true };
}
