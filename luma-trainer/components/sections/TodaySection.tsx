"use client";
import { useApp } from "../app-context";
import { StudySession } from "../study/StudySession";

// «Сегодня» — карточка для повторения сразу, без промежуточного экрана.
// key=refreshKey: «На главную» из итога сессии ремонтирует сессию (сброс счётчиков).
export function TodaySection() {
  const { refreshKey } = useApp();
  return <StudySession key={refreshKey} scope={{ scope: "today" }} embedded />;
}
