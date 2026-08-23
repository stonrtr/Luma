"use client";

import React, { useState } from "react";
import { gettingStarted, useStore } from "@/lib/store";
import { Task, View } from "@/lib/types";
import { todayKey, timeLeft } from "@/lib/date";
import {
  Inbox, CalendarDay, CalendarUp, ListIcon, Check, Trash, Heart, Target, Repeat,
  ChartBars, Search, PanelLeft, ChevronDown, ChevronUp, Plus, User, CheckSmall, AreaIcon,
} from "./icons";
import { Modal, Dropdown, MenuItem } from "./ui";
import { TaskModal } from "./TaskViews";
import { PALETTE } from "@/lib/colors";

/** Пункты экспорта/импорта данных */
export function DataMenuItems({ close }: { close: () => void }) {
  const { data } = useStore();
  const importJson = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.areas)) throw new Error("bad");
        if (window.confirm("Заменить все текущие данные импортированными? Текущие данные будут перезаписаны.")) {
          localStorage.setItem("griply-clone-v1", JSON.stringify(d));
          location.reload();
        }
      } catch {
        window.alert("Файл не похож на экспорт данных этого приложения.");
      }
    };
    r.readAsText(file);
  };
  return (
    <>
      <MenuItem onClick={() => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "griply-data.json";
        a.click();
        close();
      }}>Экспорт данных (JSON)</MenuItem>
      <label className="menu-item" style={{ cursor: "pointer" }}>
        <span className="mi-check" />Импорт данных (JSON)
        <input type="file" accept="application/json,.json" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); close(); }} />
      </label>
    </>
  );
}

export default function Sidebar({ view, setView, onHide }: { view: View; setView: (v: View) => void; onHide?: () => void }) {
  const { data, set, deleteTag } = useStore();
  const [todoOpen, setTodoOpen] = useState(true);
  const [lifeOpen, setLifeOpen] = useState(true);
  const [favOpen, setFavOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tagModal, setTagModal] = useState(false);
  const [editTag, setEditTag] = useState<import("@/lib/types").Tag | null>(null);

  const t = todayKey();
  const todayCount = data.tasks.filter(
    (x) => !x.deletedAt && !x.completedAt && (x.date === t || (x.date && x.date < t))
  ).length;
  const favorites = data.goals.filter((g) => g.favorite && !g.parentId && !g.archived);
  const favAreas = data.areas.filter((a) => a.favorite && !a.archived);
  const gs = gettingStarted(data);

  const item = (
    v: View, icon: React.ReactNode, label: string,
    extra?: React.ReactNode
  ) => (
    <button
      className={`sb-item${view.kind === v.kind ? " active" : ""}`}
      onClick={() => setView(v)}
    >
      <span className="sb-icon">{icon}</span>
      {label}
      {extra}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="sb-top">
        <Dropdown trigger={
          <span className="sb-profile">
            <span className="sb-avatar"><User size={18} /></span>
            Ston
            <ChevronDown size={13} className="muted" />
          </span>
        }>
          {(close) => <DataMenuItems close={close} />}
        </Dropdown>
        <div className="sb-top-icons">
          <button className="icon-btn" onClick={() => setSearchOpen(true)}><Search size={17} /></button>
          <button className="icon-btn" onClick={onHide}><PanelLeft size={17} /></button>
        </div>
      </div>

      <div className="sb-section">
        <div className="sb-heading">
          Задачи
          <span className="sb-h-actions">
            <button onClick={() => setTodoOpen(!todoOpen)}>{todoOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button>
          </span>
        </div>
        {todoOpen && (
          <>
            {item({ kind: "inbox" }, <Inbox size={17} />, "Идеи")}
            {item({ kind: "today" }, <CalendarDay size={17} />, "Сегодня",
              todayCount > 0 ? <span className="sb-count">{todayCount}</span> : undefined)}
            {item({ kind: "upcoming" }, <CalendarUp size={17} />, "Предстоящие")}
            {item({ kind: "all" }, <ListIcon size={17} />, "Все задачи")}
            {item({ kind: "completed" }, <Check size={17} />, "Выполненные")}
            {item({ kind: "trash" }, <Trash size={17} />, "Архив")}
          </>
        )}
      </div>

      <div className="sb-section">
        <div className="sb-heading">
          Моя жизнь
          <span className="sb-h-actions">
            <button onClick={() => setLifeOpen(!lifeOpen)}>{lifeOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button>
          </span>
        </div>
        {lifeOpen && (
          <>
            {item({ kind: "areas" }, <Heart size={17} />, "Сферы жизни")}
            {item({ kind: "goals" }, <Target size={17} />, "Цели")}
            {item({ kind: "habits" }, <Repeat size={17} />, "Привычки")}
            {item({ kind: "insights" }, <ChartBars size={17} />, "Аналитика")}
          </>
        )}
      </div>

      {(favorites.length > 0 || favAreas.length > 0) && (
        <div className="sb-section">
          <div className="sb-heading">
            Избранное
            <span className="sb-h-actions">
              <button onClick={() => setFavOpen(!favOpen)}>{favOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button>
            </span>
          </div>
          {favOpen && favAreas.map((a) => (
            <button
              key={a.id}
              className={`sb-item${view.kind === "area" && view.id === a.id ? " active" : ""}`}
              onClick={() => setView({ kind: "area", id: a.id })}
            >
              <span className="sb-icon"><AreaIcon icon={a.icon} size={16} /></span>
              {a.name}
            </button>
          ))}
          {favOpen && favorites.map((g) => {
            const taskCount = data.tasks.filter(
              (x) => x.goalId === g.id && !x.completedAt && !x.deletedAt
            ).length;
            const habitCount = data.habits.filter(
              (h) => h.goalId === g.id && !h.archived && (!h.endDate || h.endDate >= t)
            ).length;
            return (
              <button
                key={g.id}
                className={`sb-item${view.kind === "goal" && view.id === g.id ? " active" : ""}`}
                onClick={() => setView({ kind: "goal", id: g.id })}
              >
                <span className="sb-icon">
                  <span style={{
                    width: 15, height: 15, borderRadius: "50%",
                    border: "1.6px solid #c9c9c9", display: "block",
                  }} />
                </span>
                {g.name}
                <span className="sb-meta" title="Активные задачи и привычки">
                  {taskCount > 0 || habitCount > 0
                    ? `${taskCount}з ${habitCount}п`
                    : g.deadline ? timeLeft(g.deadline) : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="sb-section">
        <div className="sb-heading">
          Теги
          <span className="sb-h-actions">
            <button onClick={() => setTagModal(true)}><Plus size={13} /></button>
            <button onClick={() => setTagsOpen(!tagsOpen)}>{tagsOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button>
          </span>
        </div>
        {tagsOpen && (data.tags.length === 0 ? (
          <div className="sb-empty">Создавайте теги, чтобы организовать задачи по сферам жизни и целям.</div>
        ) : (
          data.tags.map((tag) => (
            <div key={tag.id} style={{ display: "flex", alignItems: "center" }}>
              <button
                className={`sb-item${view.kind === "tag" && view.id === tag.id ? " active" : ""}`}
                style={{ flex: 1 }}
                onClick={() => setView({ kind: "tag", id: tag.id })}
              >
                <span className="sb-icon">
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: tag.color, display: "block" }} />
                </span>
                {tag.name}
              </button>
              <Dropdown align="right" trigger={<span className="icon-btn" style={{ width: 24, height: 24 }}>⋯</span>}>
                {(close) => (
                  <>
                    <MenuItem onClick={() => { setEditTag(tag); close(); }}>Изменить</MenuItem>
                    <button type="button" className="menu-item" style={{ color: "var(--red)" }}
                      onClick={() => {
                        if (window.confirm(`Удалить тег «${tag.name}»? Он снимется со всех задач.`)) deleteTag(tag.id);
                        close();
                      }}>
                      <span className="mi-check" />Удалить
                    </button>
                  </>
                )}
              </Dropdown>
            </div>
          ))
        ))}
      </div>

      {!data.gettingStartedDismissed && (
        <div className="gs">
          <div className="gs-head">
            Начало работы
            <span style={{ display: "flex", gap: 2 }}>
              <button onClick={() => set((d) => ({ ...d, gettingStartedCollapsed: !d.gettingStartedCollapsed }))}>
                {data.gettingStartedCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
              <button title="Скрыть навсегда" onClick={() => set((d) => ({ ...d, gettingStartedDismissed: true }))}>✕</button>
            </span>
          </div>
          <div className="gs-bar-row">
            <div className="gs-bar"><div className="gs-bar-fill" style={{ width: `${gs.pct}%` }} /></div>
            <span className="gs-pct">{gs.pct}%</span>
          </div>
          {!data.gettingStartedCollapsed && <GsSteps />}
        </div>
      )}

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} setView={setView} />}
      {tagModal && <TagModal onClose={() => setTagModal(false)} />}
      {editTag && <TagModal tag={editTag} onClose={() => setEditTag(null)} />}
    </aside>
  );
}

export function SearchModal({ onClose, setView }: { onClose: () => void; setView: (v: View) => void }) {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const ql = q.trim().toLowerCase();
  const match = (x: string, notes?: string) => x.toLowerCase().includes(ql) || (notes ?? "").toLowerCase().includes(ql);
  const areas = ql ? data.areas.filter((a) => match(a.name)) : [];
  const goals = ql ? data.goals.filter((g) => match(g.name, g.description)) : [];
  const habits = ql ? data.habits.filter((h) => match(h.name, h.notes)) : [];
  const tasks = ql ? data.tasks.filter((x) => !x.deletedAt && match(x.title, x.notes)) : [];
  const total = areas.length + goals.length + habits.length + tasks.length;
  const go = (v: View) => { setView(v); onClose(); };

  return (
    <Modal onClose={onClose} width={560}>
      <div className="modal-scroll" style={{ paddingBottom: 22 }}>
        <input className="finput" autoFocus placeholder="Поиск по задачам, целям, привычкам…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginTop: 10 }}>
          {areas.map((a) => (
            <button key={a.id} className="menu-item" onClick={() => go({ kind: "area", id: a.id })}>
              <span className="mi-check"><AreaIcon icon={a.icon} size={15} /></span>{a.name}
              <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>сфера</span>
            </button>
          ))}
          {goals.map((g) => (
            <button key={g.id} className="menu-item" onClick={() => go({ kind: "goal", id: g.id })}>
              <span className="mi-check"><Target size={15} /></span>{g.name}
              <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>цель</span>
            </button>
          ))}
          {habits.map((h) => (
            <button key={h.id} className="menu-item" onClick={() => go({ kind: "habits" })}>
              <span className="mi-check"><Repeat size={15} /></span>{h.name}
              <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>привычка</span>
            </button>
          ))}
          {tasks.map((x) => (
            <button key={x.id} className="menu-item" onClick={() => setEditingTask(x)}>
              <span className="mi-check"><Check size={15} /></span>{x.title}
              <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>задача</span>
            </button>
          ))}
          {editingTask && <TaskModal task={editingTask} onClose={() => { setEditingTask(null); onClose(); }} />}
          {ql && total === 0 && <div className="sb-empty">Ничего не найдено</div>}
        </div>
      </div>
    </Modal>
  );
}

function TagModal({ tag, onClose }: { tag?: import("@/lib/types").Tag; onClose: () => void }) {
  const { addTag, updateTag } = useStore();
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? PALETTE[19].hex);
  const save = () => {
    if (!name.trim()) return;
    if (tag) updateTag(tag.id, { name: name.trim(), color });
    else addTag(name.trim(), color);
    onClose();
  };
  return (
    <Modal onClose={onClose} width={440}>
      <div className="modal-scroll">
        <div className="modal-head" style={{ marginBottom: 12 }}>
          <div className="m-titles">
            <input className="m-name" autoFocus placeholder="Название тега" value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()} />
          </div>
        </div>
        <div className="pop-sub">Цвет</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {PALETTE.map((c) => (
            <button key={c.hex} title={c.name}
              style={{
                width: 22, height: 22, borderRadius: "50%", background: c.hex,
                border: color === c.hex ? "2.5px solid var(--text)" : "2.5px solid transparent",
              }}
              onClick={() => setColor(c.hex)} />
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn-primary" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}

function GsSteps() {
  const { data } = useStore();
  const steps: [string, boolean][] = [
    ["Добавить первую задачу", data.tasks.length > 0],
    ["Создать цель", data.goals.length > 0],
    ["Завести привычку", data.habits.length > 0],
    ["Написать видение", data.areas.some((a) => a.vision && a.vision.length > 0)],
    ["Выполнить задачу", data.tasks.some((t) => !!t.completedAt)],
  ];
  return (
    <div className="gs-steps">
      {steps.map(([label, done]) => (
        <div key={label} className={`gs-step${done ? " done" : ""}`}>
          <span className="dot">{done && <CheckSmall size={9} />}</span>
          {label}
        </div>
      ))}
    </div>
  );
}
