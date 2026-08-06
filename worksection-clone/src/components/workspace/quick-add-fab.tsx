"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewTaskDialog } from "@/components/board/new-task-dialog";

// Плавающая кнопка «+» (внизу зліва). Керівник може обрати виконавця (себе або підлеглого).
export function QuickAddFab({
  userId, projects, members,
}: {
  userId: string;
  projects: { id: string; name: string; color: string }[];
  members: { id: string; name: string; isActive?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const canAssignOthers = members.length > 1;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Додати задачу"
        className="fixed bottom-6 left-6 z-50 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:bg-emerald-600 hover:shadow-xl active:translate-y-px"
      >
        <Plus className="size-7" />
      </button>
      <NewTaskDialog
        projectId=""
        members={members}
        status={open ? "TODO" : null}
        onClose={() => setOpen(false)}
        lockedAssigneeId={canAssignOthers ? undefined : userId}
        defaultAssigneeId={canAssignOthers ? userId : undefined}
        projects={projects}
      />
    </>
  );
}
