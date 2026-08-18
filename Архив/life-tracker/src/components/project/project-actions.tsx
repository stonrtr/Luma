"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pause, Play, CheckCircle2, Archive, Trash2 } from "lucide-react";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { setProjectStatus, deleteProject } from "@/server/actions/projects";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ProjectActions({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const router = useRouter();
  const tr = useT();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function change(next: ProjectStatus, label: string) {
    start(async () => {
      const res = await setProjectStatus(projectId, next);
      if (res.error) { toast.error(res.error); return; }
      toast.success(label);
      router.refresh();
    });
  }

  function doDelete() {
    start(async () => {
      const res = await deleteProject(projectId);
      if (res?.error) { toast.error(res.error); return; }
      // при успехе — редирект на /projects из экшена
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted" title={tr("proj.actions")}>
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {status !== "ACTIVE" && (
            <DropdownMenuItem onClick={() => change("ACTIVE", tr("proj.stActive"))}>
              <Play className="size-4" /> {tr("proj.makeActive")}
            </DropdownMenuItem>
          )}
          {status !== "ON_HOLD" && (
            <DropdownMenuItem onClick={() => change("ON_HOLD", tr("proj.stHold"))}>
              <Pause className="size-4" /> {tr("proj.pause")}
            </DropdownMenuItem>
          )}
          {status !== "DONE" && (
            <DropdownMenuItem onClick={() => change("DONE", tr("proj.stDone"))}>
              <CheckCircle2 className="size-4" /> {tr("proj.complete")}
            </DropdownMenuItem>
          )}
          {status !== "ARCHIVED" && (
            <DropdownMenuItem onClick={() => change("ARCHIVED", tr("proj.stArchived"))}>
              <Archive className="size-4" /> {tr("proj.archive")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" /> {tr("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("proj.deleteQ")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {tr("proj.deleteDesc")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={pending}>{tr("common.cancel")}</Button>
            <Button variant="destructive" onClick={doDelete} disabled={pending}>{pending ? tr("common.deleting") : tr("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
