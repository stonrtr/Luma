"use client";
import { useT } from "@/lib/locale-context";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { savePushSubscription, removePushSubscription } from "@/server/actions/push";
import { Button } from "@/components/ui/button";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const tr = useT();

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription()).then((s) => setSubscribed(!!s)).catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error(tr("push.noPerm")); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource });
      const json = sub.toJSON();
      await savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth });
      setSubscribed(true);
      toast.success(tr("push.enabled"));
    } catch {
      toast.error(tr("push.enableFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setSubscribed(false);
      toast.success(tr("push.disabled"));
    } catch {
      toast.error(tr("push.disableFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="size-5 text-accent-foreground" />
        <div>
          <h2 className="text-sm font-semibold">{tr("push.title")}</h2>
          <p className="text-xs text-muted-foreground">{tr("push.desc")}</p>
        </div>
      </div>
      {!supported ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Браузер не підтримує web-push або не задано <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>.
        </p>
      ) : subscribed ? (
        <Button variant="outline" disabled={busy} onClick={disable}><BellOff className="size-4" /> {tr("push.disable")}</Button>
      ) : (
        <Button disabled={busy} onClick={enable}><Bell className="size-4" /> {tr("push.enable")}</Button>
      )}
    </section>
  );
}
