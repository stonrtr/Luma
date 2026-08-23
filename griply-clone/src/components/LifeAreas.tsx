"use client";

import React, { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { LifeArea, Task, View } from "@/lib/types";
import { AREA_ICONS } from "./icons";
import {
  Plus, Dots, ArrowLeft, Star, Target, ChevronRight, ChevronDown, FilterLines, Settings2, Search, Pencil, Trash,
} from "./icons";
import { Pop, Toggle } from "./ui";
import { AreaIcon } from "./icons";
import { Modal, Dropdown, MenuItem } from "./ui";
import { PALETTE } from "@/lib/colors";
import { AddTask, TaskRow, TaskModal } from "./TaskViews";
import { GoalModal, goalColor, goalProgress } from "./Goals";

export function LifeAreasView({ setView }: { setView: (v: View) => void }) {
  const { data, updateArea, deleteArea } = useStore();
  const [modal, setModal] = useState(false);
  const [editArea, setEditArea] = useState<LifeArea | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const areas = [...data.areas]
    .filter((a) => showArchived || !a.archived)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      <div className="page-head">
        <div className="page-title">Мои сферы жизни</div>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Добавить сферу</button>
      </div>

      {settingsOpen && (
        <Pop onClose={() => setSettingsOpen(false)} style={{ top: 58, right: 16, width: 340 }}>
          <div className="pop-row" style={{ padding: "2px 0" }}>
            <div className="flabel" style={{ fontSize: 15 }}>Показывать архивные</div>
            <Toggle on={showArchived} onChange={setShowArchived} />
          </div>
        </Pop>
      )}
      <div className="main-scroll">
        <div className="table" style={{ ["--cols" as string]: "minmax(260px, 1fr) 150px 130px 130px 30px" } as React.CSSProperties}>
          <div className="table-head">
            <div>Название</div>
            <div>Видение</div>
            <div>Активные цели</div>
            <div>Завершено</div>
            <div />
          </div>
          {areas.map((a) => {
            const active = data.goals.filter((g) => g.areaId === a.id && !g.completedAt && !g.parentId).length;
            const completed = data.goals.filter((g) => g.areaId === a.id && g.completedAt).length;
            return (
              <div key={a.id} className="table-row" onClick={() => setView({ kind: "area", id: a.id })}>
                <div className="row-name">
                  <span className="row-dot-icon">
                    <AreaIcon icon={a.icon} size={21} />
                    <span className="cdot" style={{ background: a.color }} />
                  </span>
                  {a.name}
                </div>
                <div className="cell">{a.vision ? "✓" : "–"}</div>
                <div className="cell">{active || "–"}</div>
                <div className="cell">
                  {a.archived ? "в архиве" : completed || "–"}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown align="right" trigger={<span className="icon-btn"><Dots className="row-more" /></span>}>
                    {(close) => (
                      <>
                        <MenuItem onClick={() => { setEditArea(a); close(); }}>
                          <Pencil size={15} /> Редактировать сферу
                        </MenuItem>
                        <MenuItem onClick={() => { updateArea(a.id, { favorite: !a.favorite }); close(); }}>
                          <Star size={15} /> {a.favorite ? "Убрать из избранного" : "В избранное"}
                        </MenuItem>
                        <div className="menu-sep" />
                        <MenuItem onClick={() => { updateArea(a.id, { archived: !a.archived }); close(); }}>
                          {a.archived ? "Вернуть из архива" : "Архивировать"}
                        </MenuItem>
                        <button type="button" className="menu-item" style={{ color: "var(--red)" }}
                          onClick={() => {
                            if (window.confirm(`Удалить сферу «${a.name}»? Её цели и привычки останутся, но потеряют привязку.`)) {
                              deleteArea(a.id);
                            }
                            close();
                          }}>
                          <span className="mi-check" style={{ color: "var(--red)" }}><Trash size={15} /></span>Удалить
                        </button>
                      </>
                    )}
                  </Dropdown>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {modal && <AreaModal onClose={() => setModal(false)} />}
      {editArea && <AreaModal area={editArea} onClose={() => setEditArea(null)} />}
    </>
  );
}

export function AreaModal({ area, onClose }: { area?: LifeArea; onClose: () => void }) {
  const { addArea, updateArea } = useStore();
  const [name, setName] = useState(area?.name ?? "");
  const [icon, setIcon] = useState(area?.icon ?? "heart");
  const [color, setColor] = useState(area?.color ?? "#6e6ade");

  const save = () => {
    if (!name.trim()) return;
    if (area) updateArea(area.id, { name: name.trim(), icon, color });
    else addArea({ name: name.trim(), icon, color });
    onClose();
  };

  return (
    <Modal onClose={onClose} width={480}>
      <div className="modal-scroll">
        <div className="modal-head">
          <div className="m-icon" style={{ position: "relative" }}>
            <AreaIcon icon={icon} size={22} />
            <span style={{ position: "absolute", right: 6, bottom: 6, width: 8, height: 8, borderRadius: "50%", background: color }} />
          </div>
          <div className="m-titles">
            <input className="m-name" autoFocus placeholder="Название сферы" value={name}
              onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <div className="pop-sub">Иконка</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {Object.keys(AREA_ICONS).map((k) => (
            <button key={k} className="icon-btn"
              style={icon === k ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
              onClick={() => setIcon(k)}>
              <AreaIcon icon={k} size={18} />
            </button>
          ))}
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

export function AreaDetail({ id, tab, setView }: { id: string; tab?: string; setView: (v: View) => void }) {
  const { data, updateArea, deleteArea } = useStore();
  const area = data.areas.find((a) => a.id === id);
  const [activeTab, setActiveTab] = useState(tab ?? "Обзор");
  const [goalModal, setGoalModal] = useState(false);
  const [edit, setEdit] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [taskSearchOpen, setTaskSearchOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const tasksBoxRef = useRef<HTMLDivElement>(null);
  if (!area) return <div className="empty-state">Сфера не найдена</div>;

  const goals = data.goals.filter((g) => g.areaId === area.id && !g.parentId && !g.completedAt && !g.archived);
  const tasks = data.tasks.filter((t) => t.areaId === area.id && !t.deletedAt && !t.completedAt);

  return (
    <>
      <div className="page-head" style={{ borderBottom: "1px solid var(--border)" }}>
        <button className="icon-btn" onClick={() => setView({ kind: "areas" })}><ArrowLeft size={17} /></button>
        <span className="row-dot-icon" style={{ width: 20, height: 20 }}>
          <AreaIcon icon={area.icon} size={18} />
          <span className="cdot" style={{ background: area.color }} />
        </span>
        <div className="page-title" style={{ fontSize: 17 }}>{area.name}</div>
        <div className="spacer" />
        <div className="head-tabs">
          {["Обзор", "Видение", "Цели", "Задачи"].map((t) => (
            <button key={t} className={`head-tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </div>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => setEdit(true)}><Pencil size={16} /></button>
        <button className="icon-btn" onClick={() => {
          if (window.confirm(`Удалить сферу «${area.name}»? Её цели и привычки останутся, но потеряют привязку.`)) {
            deleteArea(area.id);
            setView({ kind: "areas" });
          }
        }}><Trash size={16} /></button>
      </div>

      <div className="main-scroll">
        {activeTab === "Обзор" && (
          <>
            <div className="goal-hero">
              <div className="gh-icon">
                <AreaIcon icon={area.icon} size={36} />
              </div>
              <div style={{ alignSelf: "center" }}>
                <div className="gh-name">{area.name}</div>
                <div className="gh-desc" style={{ marginBottom: 0, cursor: "pointer" }} onClick={() => setActiveTab("Видение")}>
                  {area.vision || "Напишите своё видение"}
                </div>
              </div>
            </div>
            <GoalsSection goals={goals} onAdd={() => setGoalModal(true)} setView={setView} />
            <div className="section-card" ref={tasksBoxRef}>
              <div className="section-head">
                <span className="section-title" style={{ cursor: "pointer" }} onClick={() => setTasksOpen(!tasksOpen)}>Задачи</span>
                <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setTasksOpen(!tasksOpen)}>
                  {tasksOpen ? <ChevronDown size={15} className="chev" /> : <ChevronRight size={15} className="chev" />}
                </button>
                <span className="spacer" />
                <button className="icon-btn" onClick={() => { setTaskSearchOpen(!taskSearchOpen); if (taskSearchOpen) setTaskQuery(""); }}>
                  <Search size={17} />
                </button>
                <button className="icon-btn" onClick={() => {
                  setTasksOpen(true);
                  setTimeout(() => tasksBoxRef.current?.querySelector<HTMLInputElement>(".add-task input, .composer input.c-title")?.focus(), 0);
                }}><Plus size={17} /></button>
                <Dropdown align="right" trigger={<span className="icon-btn"><FilterLines size={17} /></span>}>
                  {(close) => (
                    <MenuItem onClick={() => close()}>Сортировка: вручную</MenuItem>
                  )}
                </Dropdown>
                <Dropdown align="right" trigger={<span className="icon-btn"><Settings2 size={17} /></span>}>
                  {(close) => (
                    <MenuItem onClick={() => { setTasksOpen(!tasksOpen); close(); }}>
                      {tasksOpen ? "Свернуть секцию" : "Развернуть секцию"}
                    </MenuItem>
                  )}
                </Dropdown>
              </div>
              {tasksOpen && (
                <>
                  {taskSearchOpen && (
                    <div style={{ padding: "0 24px 6px 24px" }}>
                      <input className="finput" autoFocus placeholder="Поиск задач…" value={taskQuery}
                        onChange={(e) => setTaskQuery(e.target.value)} />
                    </div>
                  )}
                  <div className="task-list">
                    {tasks.filter((x) => !taskQuery || x.title.toLowerCase().includes(taskQuery.toLowerCase()))
                      .map((x) => <TaskRow key={x.id} task={x} onClick={() => setEditingTask(x)} />)}
                    <AddTask defaults={{ areaId: area.id }} />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === "Видение" && (
          <div className="vision-wrap">
            <div className="section-title" style={{ marginBottom: 10 }}>Видение</div>
            <textarea
              className="vision-input"
              placeholder={`Опишите свою идеальную жизнь в сфере «${area.name}». Как выглядит успех?`}
              defaultValue={area.vision ?? ""}
              onBlur={(e) => updateArea(area.id, { vision: e.target.value })}
            />
          </div>
        )}

        {activeTab === "Цели" && <GoalsSection goals={goals} onAdd={() => setGoalModal(true)} setView={setView} standalone />}

        {activeTab === "Задачи" && (
          <div className="task-list" style={{ paddingTop: 14 }}>
            {tasks.map((t) => <TaskRow key={t.id} task={t} onClick={() => setEditingTask(t)} />)}
            <AddTask defaults={{ areaId: area.id }} />
          </div>
        )}
      </div>

      {goalModal && <GoalModal defaultAreaId={area.id} onClose={() => setGoalModal(false)} />}
      {edit && <AreaModal area={area} onClose={() => setEdit(false)} />}
      {editingTask && <TaskModal task={editingTask} onClose={() => setEditingTask(null)} />}
    </>
  );
}

function GoalsSection({ goals, onAdd, setView, standalone }: {
  goals: ReturnType<typeof Object>[] & any[]; onAdd: () => void; setView: (v: View) => void; standalone?: boolean;
}) {
  const { data } = useStore();
  const [open, setOpen] = useState(true);
  const [sort, setSort] = useState("manual");
  let list = goals as any[];
  if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  if (sort === "progress") list = [...list].sort((a, b) => goalProgress(b, data) - goalProgress(a, data));
  return (
    <div className="section-card" style={standalone ? { borderTop: "none" } : undefined}>
      <div className="section-head">
        <span className="section-title" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>Цели</span>
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={15} className="chev" /> : <ChevronRight size={15} className="chev" />}
        </button>
        <span className="spacer" />
        <Dropdown align="right" trigger={<span className="icon-btn"><FilterLines size={17} /></span>}>
          {(close) => (
            <>
              <div className="menu-label">Сортировка</div>
              <MenuItem selected={sort === "manual"} onClick={() => { setSort("manual"); close(); }}>Вручную</MenuItem>
              <MenuItem selected={sort === "name"} onClick={() => { setSort("name"); close(); }}>По названию</MenuItem>
              <MenuItem selected={sort === "progress"} onClick={() => { setSort("progress"); close(); }}>По прогрессу</MenuItem>
            </>
          )}
        </Dropdown>
        <button className="icon-btn" onClick={onAdd}><Plus size={17} /></button>
        <Dropdown align="right" trigger={<span className="icon-btn"><Settings2 size={17} /></span>}>
          {(close) => (
            <MenuItem onClick={() => { setOpen(!open); close(); }}>{open ? "Свернуть секцию" : "Развернуть секцию"}</MenuItem>
          )}
        </Dropdown>
      </div>
      {!open ? null : goals.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><MapPinIcon /></div>
          <h3>Создайте цель</h3>
          <p>Ставьте цели, которые приближают вас к вашему видению.</p>
          <button className="btn-primary" onClick={onAdd}>Создать цель</button>
        </div>
      ) : (
        <div className="task-list">
          {list.map((g) => {
            const pct = goalProgress(g, data);
            return (
              <div key={g.id} className="task-row" onClick={() => setView({ kind: "goal", id: g.id })}>
                <span className="row-dot-icon" style={{ width: 20, height: 20 }}>
                  <Target size={18} />
                  <span className="cdot" style={{ background: goalColor(g, data.areas) }} />
                </span>
                <div className="task-body"><div className="task-title">{g.name}</div></div>
                <span className="cell">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MapPinIcon() {
  return (
    <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
      <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
