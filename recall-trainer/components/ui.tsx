"use client";
import { useEffect, useState } from "react";

// ─── Toast (глобальный, через window-событие) ─────────────────────────────
export function toast(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("recall-toast", { detail: message }));
  }
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener("recall-toast", handler);
    return () => {
      window.removeEventListener("recall-toast", handler);
      clearTimeout(timer);
    };
  }, []);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

// ─── Modal ────────────────────────────────────────────────────────────────
export function Modal({
  children,
  onClose,
  className = "",
  width,
}: {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className={`modal ${className}`}
        style={width ? { maxWidth: width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" />;
}

export function fmtTimecode(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60} мин`;
}

export function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 30) return new Date(iso).toLocaleDateString("ru");
  if (d >= 1) return `${d} дн назад`;
  const h = Math.floor(diff / 3600000);
  if (h >= 1) return `${h} ч назад`;
  const m = Math.floor(diff / 60000);
  if (m >= 1) return `${m} мин назад`;
  return "только что";
}
