"use client";
import { useEffect, useState } from "react";
import { A } from "@/lib/api";
import type { Lesson, Topic } from "@/lib/types";
import type { LessonTarget } from "./lesson-target";

export function LessonPicker({
  value,
  onChange,
}: {
  value: LessonTarget;
  onChange: (t: LessonTarget) => void;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    A.lessons(false).then(setLessons).catch(() => {});
    A.topics().then(setTopics).catch(() => {});
  }, []);

  const grouped = topics
    .map((t) => ({ topic: t, items: lessons.filter((l) => l.topicId === t.id) }))
    .filter((g) => g.items.length > 0);
  const noTopic = lessons.filter((l) => !l.topicId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label className="label">Урок</label>
        <select
          className="select"
          value={value.kind === "existing" ? value.lessonId : "__new__"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__new__") onChange({ kind: "new", title: "", topic: { kind: "none" } });
            else onChange({ kind: "existing", lessonId: v });
          }}
        >
          <option value="" disabled>
            Выберите урок…
          </option>
          {grouped.map((g) => (
            <optgroup key={g.topic.id} label={g.topic.name}>
              {g.items.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.stats.total})
                </option>
              ))}
            </optgroup>
          ))}
          {noTopic.length > 0 && (
            <optgroup label="Без темы">
              {noTopic.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.stats.total})
                </option>
              ))}
            </optgroup>
          )}
          <option value="__new__">➕ Создать новый урок</option>
        </select>
      </div>

      {value.kind === "new" && (
        <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">Название нового урока</label>
            <input
              className="input"
              value={value.title}
              placeholder="Напр. «Сериал S01E02»"
              onChange={(e) => onChange({ ...value, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Тема</label>
            <select
              className="select"
              value={
                value.topic.kind === "existing"
                  ? value.topic.id
                  : value.topic.kind === "new"
                    ? "__newtopic__"
                    : "__none__"
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__none__") onChange({ ...value, topic: { kind: "none" } });
                else if (v === "__newtopic__") onChange({ ...value, topic: { kind: "new", name: "" } });
                else onChange({ ...value, topic: { kind: "existing", id: v } });
              }}
            >
              <option value="__none__">Без темы</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="__newtopic__">➕ Новая тема</option>
            </select>
          </div>
          {value.topic.kind === "new" && (
            <input
              className="input"
              value={value.topic.name}
              placeholder="Название темы"
              onChange={(e) => onChange({ ...value, topic: { kind: "new", name: e.target.value } })}
            />
          )}
        </div>
      )}
    </div>
  );
}
