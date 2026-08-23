"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, CalendarDay } from "./icons";
import { todayKey, addDays, toKey, DAY_SHORT, MONTHS_SHORT, fromKey } from "@/lib/date";

export function Modal({ children, onClose, width }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width } : undefined}>{children}</div>
    </div>,
    document.body
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" className={`toggle${on ? " on" : ""}`} onClick={() => onChange(!on)} />;
}

export function Select({
  value, onChange, children, placeholder,
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder?: string;
}) {
  return (
    <div className="sel-wrap">
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ color: value === "" ? "#a8a8a8" : undefined }}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <span className="sel-chev"><ChevronDown size={13} /></span>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="stepper">
      <input
        type="text" value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? n : min);
        }}
      />
      <div className="st-btns">
        <button type="button" onClick={() => onChange(value + 1)}>▲</button>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}>▼</button>
      </div>
    </div>
  );
}

/** Дропдаун-меню: триггер + выпадающий список, закрывается по клику вне */
export function Dropdown({ trigger, children, align = "left", width }: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <span onClick={(e) => { e.stopPropagation(); setOpen(!open); }} style={{ display: "inline-flex", cursor: "pointer" }}>
        {trigger}
      </span>
      {open && (
        <div className={`menu-pop${align === "right" ? " right" : ""}`} style={width ? { minWidth: width } : undefined}
          onClick={(e) => e.stopPropagation()}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ selected, onClick, children }: {
  selected?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" className="menu-item" onClick={onClick}>
      <span className="mi-check">
        {selected && (
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

/** Мини-календарь на месяц (Пн-первый), 6 недель */
export function CalendarPanel({ value, onPick }: { value: string | null; onPick: (d: string) => void }) {
  const t = todayKey();
  const [[y, m], setYm] = useState<[number, number]>(() => {
    const d = fromKey(value ?? t);
    return [d.getFullYear(), d.getMonth()];
  });
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(y, m, 1 - startOffset + i);
    return { key: toKey(d), day: d.getDate(), inMonth: d.getMonth() === m };
  });
  const title = MONTHS_SHORT[m][0].toUpperCase() + MONTHS_SHORT[m].slice(1);

  return (
    <div className="cal-mini">
      <div className="cm-head">
        <span className="cm-title">{title} {y}</span>
        <span className="cm-nav">
          <button type="button" onClick={() => setYm(m === 0 ? [y - 1, 11] : [y, m - 1])}><ChevronLeft size={14} /></button>
          <button type="button" onClick={() => { const d = fromKey(t); setYm([d.getFullYear(), d.getMonth()]); }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid currentColor", display: "block" }} />
          </button>
          <button type="button" onClick={() => setYm(m === 11 ? [y + 1, 0] : [y, m + 1])}><ChevronRight size={14} /></button>
        </span>
      </div>
      <div className="cm-grid">
        {DAY_SHORT.map((d) => <span key={d} className="cm-dow">{d}</span>)}
        {cells.map((c) => (
          <button
            key={c.key} type="button"
            className={`cm-day${c.inMonth ? "" : " out"}${c.key === value ? " sel" : ""}${c.key === t ? " today" : ""}`}
            onClick={() => onPick(c.key)}
          >
            {c.day}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Содержимое дропдауна выбора даты: инпут, быстрые варианты, календарь */
export function DateMenu({ value, onChange, close, noneLabel = "Без даты" }: {
  value: string | null;
  onChange: (v: string | null) => void;
  close: () => void;
  noneLabel?: string;
}) {
  const t = todayKey();
  return (
    <>
      <div className="menu-inp" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#8a8a8a", display: "flex" }}><CalendarDay size={16} /></span>
        <input type="date" className="finput" value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)} />
      </div>
      <MenuItem selected={value === t} onClick={() => { onChange(t); close(); }}>Сегодня</MenuItem>
      <MenuItem selected={value === addDays(t, 1)} onClick={() => { onChange(addDays(t, 1)); close(); }}>Завтра</MenuItem>
      <MenuItem selected={value === addDays(t, 7)} onClick={() => { onChange(addDays(t, 7)); close(); }}>Через неделю</MenuItem>
      <MenuItem selected={!value} onClick={() => { onChange(null); close(); }}>{noneLabel}</MenuItem>
      <div style={{ borderTop: "1px solid #f2f2f2", margin: "4px 0" }} />
      <CalendarPanel value={value} onPick={(d) => { onChange(d); close(); }} />
    </>
  );
}

/** Пилюля-селект для поповеров фильтров: кастомное меню + крестик сброса */
export function PSel({ value, options, placeholder, onChange }: {
  value: string;
  options: { v: string; l: string }[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const label = value ? options.find((o) => o.v === value)?.l ?? value : placeholder;
  return (
    <Dropdown align="right" trigger={
      <span className={`psel${value ? "" : " empty"}`}>
        <span className="psel-val">{label}</span>
        {value ? (
          <span className="psel-x" onClick={(e) => { e.stopPropagation(); onChange(""); }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </span>
        ) : (
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        )}
      </span>
    }>
      {(close) => (
        <>
          {options.map((o) => (
            <MenuItem key={o.v} selected={o.v === value} onClick={() => { onChange(o.v); close(); }}>{o.l}</MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

/** Click-outside wrapper for popovers */
export function Pop({ children, onClose, style, className }: { children: React.ReactNode; onClose: () => void; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", fn), 0);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);
  return <div ref={ref} className={`popover${className ? ` ${className}` : ""}`} style={style}>{children}</div>;
}
