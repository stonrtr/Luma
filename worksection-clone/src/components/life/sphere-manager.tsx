"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check } from "lucide-react";
import { addSphere, renameSphere, deleteSphere } from "@/server/actions/life";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Sphere } from "./sphere-board";

// Палитра цветов для сфер
const PALETTE = ["#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308", "#64748b"];

function ColorDots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn("size-5 rounded-full border transition-transform hover:scale-110", value === c && "ring-2 ring-ring ring-offset-1")}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
    </div>
  );
}

function SphereRow({ sphere }: { sphere: Sphere }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(sphere.name);
  const [color, setColor] = useState(sphere.color);
  const dirty = name.trim() !== sphere.name || color !== sphere.color;

  function save() {
    if (!name.trim()) return;
    start(async () => {
      const r = await renameSphere({ tagId: sphere.id, name: name.trim(), color });
      if (r?.error) toast.error(r.error); else { toast.success("Сохранено"); router.refresh(); }
    });
  }
  function remove() {
    start(async () => {
      await deleteSphere({ tagId: sphere.id });
      toast.success("Сфера удалена");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="flex items-center gap-2">
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" />
        {dirty && (
          <Button size="icon" variant="ghost" className="size-8 text-emerald-600" onClick={save} disabled={pending} title="Сохранить">
            <Check className="size-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" onClick={remove} disabled={pending} title="Удалить сферу">
          <Trash2 className="size-4" />
        </Button>
      </div>
      <ColorDots value={color} onChange={setColor} />
    </div>
  );
}

export function SphereManager({ projectId, spheres, onClose }: { projectId: string; spheres: Sphere[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[5]);

  function add() {
    if (!newName.trim()) { toast.error("Введите название сферы"); return; }
    start(async () => {
      const r = await addSphere({ projectId, name: newName.trim(), color: newColor });
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Сфера добавлена");
      setNewName("");
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Сферы жизни</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {spheres.map((s) => <SphereRow key={s.id} sphere={s} />)}
        </div>
        <div className="mt-2 space-y-2 rounded-lg border border-dashed p-3">
          <div className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: newColor }} />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Новая сфера…"
              className="h-8 flex-1"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button size="sm" onClick={add} disabled={pending}><Plus className="size-4" /> Добавить</Button>
          </div>
          <ColorDots value={newColor} onChange={setNewColor} />
        </div>
        <p className="text-xs text-muted-foreground">Удаление сферы не удаляет задачи — они переедут в «Без сферы».</p>
      </DialogContent>
    </Dialog>
  );
}
