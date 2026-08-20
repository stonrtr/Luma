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
