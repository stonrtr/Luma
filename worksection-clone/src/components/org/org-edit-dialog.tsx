"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { updateOrgUser } from "@/server/actions/org";
import { deleteUser } from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type OrgUser = {
  id: string; name: string; title: string | null; functions: string | null;
  weeklyHours: number | null; managerId: string | null; driveFolderUrl: string | null;
};

export function OrgEditDialog({
  user, candidates, isAdmin, canDelete,
}: {
  user: OrgUser; candidates: { id: string; name: string }[]; isAdmin: boolean; canDelete?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(user.title ?? "");
  const [functions, setFunctions] = useState(user.functions ?? "");
  const [hours, setHours] = useState(user.weeklyHours != null ? String(user.weeklyHours) : "");
  const [drive, setDrive] = useState(user.driveFolderUrl ?? "");
  const [managerId, setManagerId] = useState(user.managerId ?? "none");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateOrgUser({
        userId: user.id,
        title: title.trim(),
        functions: functions.trim(),
        weeklyHours: hours.trim() ? parseFloat(hours) : null,
        driveFolderUrl: drive.trim(),
        managerId: isAdmin ? (managerId === "none" ? null : managerId) : undefined,
      });
      if (res?.error) toast.error(res.error);
      else { toast.success("Збережено"); setOpen(false); router.refresh(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-muted-foreground hover:text-foreground" title="Редагувати">
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{user.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-title">Посада</Label>
            <Input id="org-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-func">Функції / обов&apos;язки</Label>
            <Textarea id="org-func" value={functions} onChange={(e) => setFunctions(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-drive">Папка Google Drive</Label>
            <Input id="org-drive" value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="org-hours">Годин на тиждень</Label>
              <Input id="org-hours" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="40" />
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Керівник</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Немає</SelectItem>
                    {candidates.filter((c) => c.id !== user.id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {canDelete ? (
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm("Видалити співробітника назавжди?")) return;
                start(async () => {
                  const res = await deleteUser(user.id);
                  if (res?.error) toast.error(res.error);
                  else { toast.success("Видалено"); setOpen(false); router.refresh(); }
                });
              }}
            >
              <Trash2 className="size-4" /> Видалити
            </Button>
          ) : <span />}
          <Button onClick={save} disabled={pending}>{pending ? "Збереження…" : "Зберегти"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
