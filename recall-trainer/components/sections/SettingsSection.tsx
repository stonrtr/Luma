"use client";
import { useEffect, useState } from "react";
import { A } from "@/lib/api";
import { useApp } from "../app-context";
import { useToast, Confirm } from "../ui";
import type { Collection } from "@/lib/types";

export function SettingsSection() {
  const { settings, updateSettings } = useApp();
  const toast = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  const loadCollections = () => A.collections().then(setCollections).catch(() => {});
  useEffect(() => { loadCollections(); }, []);

  const num = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  };

  const addCollection = async () => {
    if (!newName.trim()) return;
    try {
      await A.createCollection(newName.trim());
      setNewName("");
      loadCollections();
    } catch (e) { toast((e as Error).message, "error"); }
  };

  const saveRename = async (id: string) => {
    try {
      await A.renameCollection(id, editName.trim());
      setEditId(null);
      loadCollections();
    } catch (e) { toast((e as Error).message, "error"); }
  };

  const doDelete = async (id: string) => {
    try {
      await A.deleteCollection(id);
      setDelId(null);
      loadCollections();
      toast("Раздел удалён (темы сохранены)", "info");
    } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="h1" style={{ marginBottom: 16 }}>Настройки</h1>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="h2" style={{ marginBottom: 4 }}>Повторение</div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Как планировать повторения, чтобы не забывать темы.
        </p>

        <Field label="Новых тем в день" hint="Сколько новых тем добавлять в очередь «Сегодня»">
          <input className="input" type="number" min={0} max={200} value={settings.newCardsPerDay}
            onChange={(e) => updateSettings({ newCardsPerDay: num(e.target.value, settings.newCardsPerDay) })} />
        </Field>
        <Field label="Максимум тем в день" hint="Верхний предел очереди на день">
          <input className="input" type="number" min={1} max={500} value={settings.cardsPerDay}
            onChange={(e) => updateSettings({ cardsPerDay: num(e.target.value, settings.cardsPerDay) })} />
        </Field>
        <Field label="Успешных повторений до «выучено»" hint="Сколько раз нужно вспомнить тему">
          <input className="input" type="number" min={1} max={20} value={settings.requiredSuccess}
            onChange={(e) => updateSettings({ requiredSuccess: num(e.target.value, settings.requiredSuccess) })} />
        </Field>
        <Field label="Серия без ошибок до «выучено»" hint="Подряд правильных ответов">
          <input className="input" type="number" min={1} max={20} value={settings.requiredStreak}
            onChange={(e) => updateSettings({ requiredStreak: num(e.target.value, settings.requiredStreak) })} />
        </Field>
        <Field label="Мин. интервал до «выучено» (дней)" hint="Тема считается выученной, когда её интервал вырос до этого значения">
          <input className="input" type="number" min={1} max={365} value={settings.minIntervalDays}
            onChange={(e) => updateSettings({ minIntervalDays: num(e.target.value, settings.minIntervalDays) })} />
        </Field>

        <Toggle label="«С трудом» считать как правильный ответ" checked={settings.countHardAsCorrect}
          onChange={(v) => updateSettings({ countHardAsCorrect: v })} />
        <Toggle label="Анимации" checked={settings.animationsEnabled}
          onChange={(v) => updateSettings({ animationsEnabled: v })} />
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="h2" style={{ marginBottom: 4 }}>Разделы</div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Группируйте темы по областям знаний.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input className="input" placeholder="Новый раздел" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCollection()} />
          <button className="btn btn-primary" style={{ flex: "none" }} onClick={addCollection}>Добавить</button>
        </div>

        {collections.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>Разделов пока нет.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {collections.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                {editId === c.id ? (
                  <>
                    <input className="input" style={{ minHeight: 38 }} value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRename(c.id)} autoFocus />
                    <button className="btn btn-sm btn-primary" onClick={() => saveRename(c.id)}>OK</button>
                    <button className="btn btn-sm" onClick={() => setEditId(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, fontWeight: 600 }}>{c.name}</div>
                    <span className="muted" style={{ fontSize: 13 }}>{c.topicCount ?? 0}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(c.id); setEditName(c.name); }}>✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDelId(c.id)}>🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {delId && (
        <Confirm
          message="Удалить раздел? Темы из него сохранятся и станут «Без раздела»."
          onConfirm={() => doDelete(delId)}
          onCancel={() => setDelId(null)}
        />
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
        {hint && <div className="muted" style={{ fontSize: 12 }}>{hint}</div>}
      </div>
      <div style={{ width: 100, flex: "none" }}>{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 48, height: 28, borderRadius: 999, border: "none", cursor: "pointer", flex: "none",
          background: checked ? "var(--primary)" : "color-mix(in srgb, var(--muted) 30%, transparent)",
          position: "relative", transition: "background .15s ease",
        }}
      >
        <span style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left .15s ease" }} />
      </button>
    </div>
  );
}
