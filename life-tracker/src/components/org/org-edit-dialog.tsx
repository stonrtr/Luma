"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Mail } from "lucide-react";
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
  role?: string; isActive?: boolean; email?: string;
};

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Адміністратор" },
  { value: "MEMBER", label: "Співробітник" },
];
const ROLE_LABEL: Record<string, string> = { OWNER: "Власник", ADMIN: "Адміністратор", MEMBER: "Співробітник", CLIENT: "Клієнт" };

export function OrgEditDialog({
  user, candidates, isAdmin, canDelete, canManageAccess,
}: {
  user: OrgUser; candidates: { id: string; name: string }[]; isAdmin: boolean; canDelete?: boolean; canManageAccess?: boolean;
}) {
  const router = useRouter();
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title ?? "");
  const [functions, setFunctions] = useState(user.functions ?? "");
  const [hours, setHours] = useState(user.weeklyHours != null ? String(user.weeklyHours / 5) : "");
  const [drive, setDrive] = useState(user.driveFolderUrl ?? "");
  const [managerId, setManagerId] = useState(user.managerId ?? "none");
  const [role, setRole] = useState(user.role ?? "MEMBER");
  const [pending, start] = useTransition();

  function save() {
    if (!name.trim()) { toast.error(tr("org.enterName")); return; }
    start(async () => {
      const res = await updateOrgUser({
        userId: user.id,
        name: name.trim(),
        title: title.trim(),
        functions: functions.trim(),
        weeklyHours: hours.trim() ? parseFloat(hours) * 5 : null,
        driveFolderUrl: drive.trim(),
        managerId: isAdmin ? (managerId === "none" ? null : managerId) : undefined,
        role: canManageAccess ? (role as "ADMIN" | "MEMBER") : undefined,
      });
      if (res?.error) toast.error(res.error);
      else { toast.success(tr("common.saved")); setOpen(false); router.refresh(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-muted-foreground hover:text-foreground" title={tr("org.edit")}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{user.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {user.email && (
            <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3.5" /> {user.email}
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 font-medium">{tr(`role.${user.role ?? "MEMBER"}`)}</span>
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="org-name">{tr("org.firstName")}</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-title">{tr("org.title")}</Label>
            <Input id="org-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-func">{tr("org.func")}</Label>
            <Textarea id="org-func" value={functions} onChange={(e) => setFunctions(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-drive">{tr("org.drive")}</Label>
            <Input id="org-drive" value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="org-hours">{tr("org.hoursPerDay")}</Label>
              <Input id="org-hours" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="8" />
              {hours.trim() && !Number.isNaN(parseFloat(hours)) && (
                <p className="text-xs text-muted-foreground">≈ {parseFloat(hours) * 5} {tr("org.perWeek")}</p>
              )}
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>{tr("org.manager")}</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tr("common.none")}</SelectItem>
                    {candidates.filter((c) => c.id !== user.id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {canManageAccess && (
            <div className="space-y-2 border-t pt-4">
              <Label>{tr("org.roleAccess")}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{tr(`role.${r.value}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          {canDelete ? (
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm(tr("org.deleteConfirm"))) return;
                start(async () => {
                  const res = await deleteUser(user.id);
                  if (res?.error) toast.error(res.error);
                  else { toast.success(tr("common.deleted")); setOpen(false); router.refresh(); }
                });
              }}
            >
              <Trash2 className="size-4" /> {tr("org.deleteEmp")}
            </Button>
          ) : <span />}
          <Button onClick={save} disabled={pending}>{pending ? tr("common.saving") : tr("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
