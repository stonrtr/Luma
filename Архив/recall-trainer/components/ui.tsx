"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export function ProgressBar({ value, known }: { value: number; known?: boolean }) {
  return (
    <div className={`progress ${known ? "is-known" : ""}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Star({ active, onClick, size = 22 }: { active: boolean; onClick?: (e: React.MouseEvent) => void; size?: number }) {
  return (
    <button
      className="star btn-ghost"
      onClick={onClick}
      aria-label={active ? "Убрать из избранного" : "В избранное"}
      style={{ border: "none", background: "none", cursor: "pointer", padding: 4, lineHeight: 0 }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "var(--yellow)" : "none"} stroke={active ? "var(--yellow)" : "var(--muted)"} strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" style={wide ? { maxWidth: 720 } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="h2">{title}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({
  message,
  confirmLabel = "Удалить",
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="Подтверждение" onClose={onCancel}>
      <p style={{ marginTop: 0 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
        <button className="btn" onClick={onCancel}>Отмена</button>
        <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

/* ── Toasts ──────────────────────────────────────────────────────────── */
type Toast = { id: number; text: string; kind: "info" | "error" | "success" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: "fixed", bottom: 16, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 80, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card"
            style={{
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: 14,
              maxWidth: "90vw",
              borderLeft: `4px solid ${t.kind === "error" ? "var(--danger)" : t.kind === "success" ? "var(--success)" : "var(--primary)"}`,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: string; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
      {icon && <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>}
      <div className="h2" style={{ marginBottom: 6 }}>{title}</div>
      {hint && <p className="muted" style={{ margin: "0 auto", maxWidth: 380 }}>{hint}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function formatInterval(days: number): string {
  if (days < 1 / 24) return "через ~10 мин";
  if (days < 1) return `через ${Math.round(days * 24)} ч`;
  if (days < 30) return `через ${Math.round(days)} дн`;
  if (days < 365) return `через ${Math.round(days / 30)} мес`;
  return `через ${(days / 365).toFixed(1)} г`;
}

export function daysAgo(iso: string | null): string {
  if (!iso) return "ещё не повторялась";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return "сегодня";
  if (d === 1) return "1 день назад";
  if (d < 5) return `${d} дня назад`;
  return `${d} дней назад`;
}
