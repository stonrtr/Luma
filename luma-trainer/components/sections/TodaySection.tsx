"use client";
import { StudySession } from "../study/StudySession";

// «Сегодня» — карточка для повторения сразу, без промежуточного экрана.
// Встроенный режим StudySession рендерится прямо в панели раздела.
export function TodaySection() {
  return <StudySession scope={{ scope: "today" }} embedded />;
}
