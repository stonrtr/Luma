import { A } from "@/lib/api";

export type LessonTarget =
  | { kind: "existing"; lessonId: string }
  | {
      kind: "new";
      title: string;
      topic: { kind: "none" } | { kind: "existing"; id: string } | { kind: "new"; name: string };
    };

export function targetValid(t: LessonTarget): boolean {
  if (t.kind === "existing") return !!t.lessonId;
  if (!t.title.trim()) return false;
  if (t.topic.kind === "existing") return !!t.topic.id;
  if (t.topic.kind === "new") return !!t.topic.name.trim();
  return true;
}

/** Payload for POST /api/import (accepts a new lesson inline). */
export function importPayload(t: LessonTarget): Record<string, unknown> {
  if (t.kind === "existing") return { lessonId: t.lessonId };
  const base: Record<string, unknown> = { newLessonTitle: t.title.trim() };
  if (t.topic.kind === "existing") base.topicId = t.topic.id;
  else if (t.topic.kind === "new") base.newTopicName = t.topic.name.trim();
  return base;
}

/** Resolve to a concrete lessonId, creating the lesson/topic if needed. */
export async function resolveLessonId(t: LessonTarget): Promise<string> {
  if (t.kind === "existing") return t.lessonId;
  const body: { title: string; topicId?: string; newTopicName?: string } = { title: t.title.trim() };
  if (t.topic.kind === "existing") body.topicId = t.topic.id;
  else if (t.topic.kind === "new") body.newTopicName = t.topic.name.trim();
  const lesson = await A.createLesson(body);
  return lesson.id;
}
