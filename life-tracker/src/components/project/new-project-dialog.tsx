"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createProject } from "@/server/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"];

export function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [pending, start] = useTransition();
  const tr = useT();

  function onSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      toast.error(tr("proj.enterName"));
      return;
    }
    start(async () => {
      try {
        await createProject({
          name,
          description: String(formData.get("description") ?? ""),
          color,
        });
      } catch (e) {
        // redirect бросает NEXT_REDIRECT — это ожидаемо
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
        toast.error(tr("proj.createFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {tr("proj.newProject")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr("proj.newProject")}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{tr("proj.nameLabel")}</Label>
            <Input id="name" name="name" placeholder={tr("proj.namePh")} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{tr("proj.descLabel")}</Label>
            <Textarea id="description" name="description" placeholder={tr("proj.descPh")} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>{tr("proj.colorLabel")}</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full ring-offset-2 transition-all"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? tr("common.creating") : tr("proj.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
