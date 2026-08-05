"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateTask } from "@/server/actions/tasks";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function EditableTaskHeader({
  taskId,
  title,
  description,
}: {
  taskId: string;
  title: string;
  description: string | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleVal, setTitleVal] = useState(title);
  const [descVal, setDescVal] = useState(description ?? "");

  function saveTitle() {
    setEditingTitle(false);
    if (titleVal.trim() && titleVal !== title) {
      start(async () => {
        await updateTask({ taskId, title: titleVal.trim() });
        toast.success("Название обновлено");
        router.refresh();
      });
    } else {
      setTitleVal(title);
    }
  }

  function saveDesc() {
    setEditingDesc(false);
    if (descVal !== (description ?? "")) {
      start(async () => {
        await updateTask({ taskId, description: descVal });
        toast.success("Описание обновлено");
        router.refresh();
      });
    }
  }

  return (
    <div>
      {editingTitle ? (
        <Input
          value={titleVal}
          onChange={(e) => setTitleVal(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") {
              setTitleVal(title);
              setEditingTitle(false);
            }
          }}
          autoFocus
          className="h-auto border-0 px-0 py-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        />
      ) : (
        <h1
          onClick={() => setEditingTitle(true)}
          className="group inline-flex cursor-text items-center gap-2 text-2xl font-semibold tracking-tight"
        >
          {title}
          <Pencil className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </h1>
      )}

      {editingDesc ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={descVal}
            onChange={(e) => setDescVal(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Добавьте описание…"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveDesc}>Сохранить</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDescVal(description ?? "");
                setEditingDesc(false);
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <p
          onClick={() => setEditingDesc(true)}
          className="mt-2 cursor-text whitespace-pre-wrap text-sm text-muted-foreground hover:text-foreground"
        >
          {description || "Добавьте описание…"}
        </p>
      )}
    </div>
  );
}
