"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { priorityColor } from "@/lib/status-colors";
import { setTaskPriority } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

export function PriorityBadge({
  priority,
  taskId,
  editable = false,
}: {
  priority: number;
  taskId?: string;
  editable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(priority);
  const [pending, setPending] = useState(false);

  const chip = (
    <span
      className={cn(
        "inline-flex size-[15px] items-center justify-center rounded-sm text-[10px] font-semibold text-white transition-transform",
        editable && "cursor-pointer hover:scale-150",
      )}
      style={{ backgroundColor: priorityColor(value) }}
      title={`Приоритет: ${value}/10`}
    >
      {value}
    </span>
  );

  if (!editable || !taskId) {
    return chip;
  }

  async function choose(next: number) {
    setValue(next);
    setOpen(false);
    setPending(true);
    try {
      await setTaskPriority({ id: taskId!, priority: next });
    } catch {
      setValue(priority);
      toast.error("Не удалось изменить приоритет");
    } finally {
      setPending(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={pending}
          aria-label="Изменить приоритет"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          {chip}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => choose(n)}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-md text-xs font-semibold text-white transition-transform hover:scale-110",
                n === value && "ring-2 ring-offset-1 ring-foreground",
              )}
              style={{ backgroundColor: priorityColor(n) }}
            >
              {n}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
