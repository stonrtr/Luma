"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import { GlowRing } from "@/components/ui/glow-ring";

// Плавающая кнопка «+» (внизу зліва). Керівник може обрати виконавця (себе або підлеглого).
export function QuickAddFab({
  userId, projects, members, locale = "uk",
}: {
  userId: string;
  projects: { id: string; name: string; color: string }[];
  members: { id: string; name: string; isActive?: boolean }[];
  locale?: string;
}) {
  const [open, setOpen] = useState(false);
  const canAssignOthers = members.length > 1;
  const pathname = usePathname();
  // На редакторе таблицы прячем кнопку (перекрывает добавление листа) и глушим хоткей
  const onSheetEditor = pathname.startsWith("/sheets");
  // Если открыта страница проекта — новая задача по умолчанию попадает в него
  const currentProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];

  // Хоткей «z» (физическая клавиша, независимо от раскладки) — открыть создание задачи.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (el?.closest?.("[data-sheet-editor]") || document.querySelector("[data-sheet-editor]")) return;
      if (e.code === "KeyZ") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (onSheetEditor) return null;

  return (
    <>
      <GlowRing tier={1} className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setOpen(true)}
          title={t(locale, "kc.addTask")}
          className="flex size-14 items-center justify-center rounded-full bg-card text-[#3D6B26] transition-all hover:bg-accent active:translate-y-px dark:text-[#A9D97F]"
        >
          <Plus className="size-7" />
        </button>
      </GlowRing>
      <NewTaskDialog
        projectId=""
        members={members}
        status={open ? "TODO" : null}
        onClose={() => setOpen(false)}
        lockedAssigneeId={canAssignOthers ? undefined : userId}
        defaultAssigneeId={canAssignOthers ? userId : undefined}
        projects={projects}
        defaultProjectId={currentProjectId}
        locale={locale}
      />
    </>
  );
}
