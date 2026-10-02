// Порядок уроков для разделов «Уроки» и «Слушать»:
// вверху — последние открытые, ниже — по дате добавления (новые выше),
// сами темы — по самому свежему добавленному уроку.
import type { Lesson } from "./types";

const ts = (d: string | null | undefined): number => (d ? new Date(d).getTime() : 0);

/** N последних открытых уроков (по lastOpenedAt, новые первыми). */
export function recentlyOpened(lessons: Lesson[], n = 2): Lesson[] {
  return [...lessons]
    .filter((l) => l.lastOpenedAt)
    .sort((a, b) => ts(b.lastOpenedAt) - ts(a.lastOpenedAt))
    .slice(0, n);
}

export type LessonGroup = { name: string; items: Lesson[] };

/**
 * Группы по темам: внутри — по дате добавления (новые выше); темы — по самому
 * свежему добавленному уроку; «Без темы» — в конце.
 */
export function groupByTopicNewest(
  lessons: Lesson[],
  topics: { id: string; name: string }[]
): LessonGroup[] {
  const byCreated = (a: Lesson, b: Lesson) => ts(b.createdAt) - ts(a.createdAt);
  const groups: LessonGroup[] = topics
    .map((t) => ({ name: t.name, items: lessons.filter((l) => l.topicId === t.id).sort(byCreated) }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => ts(b.items[0]?.createdAt) - ts(a.items[0]?.createdAt));
  const noTopic = lessons.filter((l) => !l.topicId).sort(byCreated);
  if (noTopic.length) groups.push({ name: "Без темы", items: noTopic });
  return groups;
}

/** Полный порядок: [Недавно открытые?] + группы по темам (по дате добавления). */
export function orderedLessonGroups(
  lessons: Lesson[],
  topics: { id: string; name: string }[]
): LessonGroup[] {
  const recent = recentlyOpened(lessons);
  const groups = groupByTopicNewest(lessons, topics);
  return recent.length > 0 ? [{ name: "Недавно открытые", items: recent }, ...groups] : groups;
}
