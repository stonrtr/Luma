"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { createCall } from "@/server/actions/calls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewCallDialog({ users, canAssignOthers, selfId }: { users: { id: string; name: string }[]; canAssignOthers: boolean; selfId: string }) {
  const router = useRouter();
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [userId, setUserId] = useState(selfId);
  const [pending, start] = useTransition();

  function submit() {
    if (!title.trim() || !date || !time) { toast.error(tr("call.fill")); return; }
    start(async () => {
      const res = await createCall({ title: title.trim(), date, time, durationMin: parseInt(duration) || 30, userId });
      if (res?.error) toast.error(res.error);
      else { toast.success(tr("call.added")); setOpen(false); setTitle(""); setDate(""); setTime(""); router.refresh(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Phone className="size-4" /> {tr("call.call")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{tr("call.new")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{tr("call.nameLabel")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("call.namePh")} autoFocus /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>{tr("call.date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tr("call.time")}</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tr("call.minutes")}</Label><Input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" /></div>
          </div>
          {canAssignOthers && (
            <div className="space-y-2">
              <Label>{tr("call.participant")}</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={submit} disabled={pending}>{pending ? "…" : tr("admin.create")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
