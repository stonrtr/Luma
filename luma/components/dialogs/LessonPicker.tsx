"use client";
import { useEffect, useState } from "react";
import { A } from "@/lib/api";
import type { Lesson, Topic } from "@/lib/types";
import type { LessonTarget } from "./lesson-target";

// Тема-first: сначала выбор/создание темы, затем выбор/создание урока внутри неё.
// Наружу отдаёт прежний LessonTarget (контракт не меняется).
export function LessonPicker({ onChange }: { value: LessonTarget; onChange: (t: LessonTarget) => void }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  // "" = «Без темы», <id> = существующая тема, "__new__" = новая тема
  const [topicSel, setTopicSel] = useState<string>("");
  const [newTopicName, setNewTopicName] = useState("");
  // "" = не выбран, <id> = существующий урок, "__new__" = новый урок
  const [lessonSel, setLessonSel] = useState<string>("");
  const [newLessonTitle, setNewLessonTitle] = useState("");

  useEffect(() => {
    A.lessons(false).then(setLessons).catch(() => {});
    A.topics().then(setTopics).catch(() => {});
  }, []);

  // Уроки, относящиеся к выбранной теме.
  const lessonsInTopic =
    topicSel === "__new__"
      ? []
      : topicSel === ""
        ? lessons.filter((l) => !l.topicId)
        : lessons.filter((l) => l.topicId === topicSel);

  // Транслируем внутреннее состояние в LessonTarget.
  useEffect(() => {
    if (lessonSel === "__new__") {
      const topicPart =
        topicSel === "__new__"
          ? ({ kind: "new", name: newTopicName } as const)
          : topicSel === ""
            ? ({ kind: "none" } as const)
            : ({ kind: "existing", id: topicSel } as const);
      onChange({ kind: "new", title: newLessonTitle, topic: topicPart });
    } else {
      onChange({ kind: "existing", lessonId: lessonSel });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicSel, newTopicName, lessonSel, newLessonTitle]);

  const onTopicChange = (v: string) => {
    setTopicSel(v);
    // Новая тема ещё не содержит уроков — сразу режим «новый урок».
    setLessonSel(v === "__new__" ? "__new__" : "");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 1. Тема */}
      <div>
        <label className="label">Тема</label>
        <select className="select" value={topicSel} onChange={(e) => onTopicChange(e.target.value)}>
          <option value="">Без темы</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="__new__">➕ Новая тема</option>
        </select>
      </div>
      {topicSel === "__new__" && (
        <input
          className="input"
          placeholder="Название темы"
          value={newTopicName}
          onChange={(e) => setNewTopicName(e.target.value)}
        />
      )}

      {/* 2. Урок (в выбранной теме) */}
      <div>
        <label className="label">Урок</label>
        <select
          className="select"
          value={lessonSel}
          onChange={(e) => setLessonSel(e.target.value)}
          disabled={topicSel === "__new__"}
        >
          <option value="" disabled>
            Выберите урок…
          </option>
          {lessonsInTopic.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title} ({l.stats.total})
            </option>
          ))}
          <option value="__new__">➕ Создать новый урок</option>
        </select>
      </div>
      {lessonSel === "__new__" && (
        <input
          className="input"
          placeholder="Название нового урока"
          value={newLessonTitle}
          onChange={(e) => setNewLessonTitle(e.target.value)}
        />
      )}
    </div>
  );
}
