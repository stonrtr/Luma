"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Copy } from "lucide-react";
import { inviteMember } from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function OrgAddDialog({ candidates, defaultManagerId, trigger }: { candidates: { id: string; name: string }[]; defaultManagerId?: string; trigger?: React.ReactNode }) {
  const router = useRouter();
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [managerId, setManagerId] = useState(defaultManagerId ?? "none");
  const [hours, setHours] = useState("");
  const [created, setCreated] = useState<{ email: string; pass: string; emailed: boolean } | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setFirstName(""); setLastName(""); setEmail(""); setTitle(""); setManagerId(defaultManagerId ?? "none"); setHours(""); setCreated(null);
  }

  function submit() {
    if (!firstName.trim() || !email.trim()) { toast.error(tr("org.enterNameEmail")); return; }
    start(async () => {
      const res = await inviteMember({
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), title: title.trim(),
        managerId: managerId === "none" ? null : managerId,
        weeklyHours: hours.trim() ? parseFloat(hours) * 5 : null,
      });
      if (res?.error) toast.error(res.error);
      else { setCreated({ email: email.trim(), pass: res.tempPassword!, emailed: !!res.emailed }); router.refresh(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button><UserPlus className="size-4" /> {tr("org.invite")}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{defaultManagerId ? tr("org.addSub") : tr("org.invite")}</DialogTitle></DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-sm">
              {created.emailed
                ? `${tr("org.acctSent")} ${created.email}.`
                : tr("org.acctManual")}
            </p>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p><span className="text-muted-foreground">Email:</span> {created.email}</p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{tr("org.password")}:</span> <span className="font-mono">{created.pass}</span>
                <button onClick={() => { navigator.clipboard.writeText(`${created.email} / ${created.pass}`); toast.success(tr("common.copied")); }} className="text-muted-foreground hover:text-foreground"><Copy className="size-3.5" /></button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => reset()}>{tr("common.addMore")}</Button>
              <Button onClick={() => { setOpen(false); reset(); }}>{tr("common.ready")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>{tr("org.firstName")}</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus /></div>
                <div className="space-y-2"><Label>{tr("org.lastName")}</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>{tr("org.title")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("org.titlePh")} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@company.com" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{tr("org.manager")}</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tr("common.none")}</SelectItem>
                      {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tr("org.hoursPerDay")}</Label>
                  <Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="8" />
                  {hours.trim() && !Number.isNaN(parseFloat(hours)) && (
                    <p className="text-xs text-muted-foreground">≈ {parseFloat(hours) * 5} {tr("org.perWeek")}</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending}>{pending ? tr("common.creating") : tr("org.invite")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
