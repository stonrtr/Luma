"use client";

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

export function OrgAddDialog({ candidates }: { candidates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [managerId, setManagerId] = useState("none");
  const [hours, setHours] = useState("");
  const [created, setCreated] = useState<{ email: string; pass: string } | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setName(""); setEmail(""); setTitle(""); setRole("MEMBER"); setManagerId("none"); setHours(""); setCreated(null);
  }

  function submit() {
    if (!name.trim() || !email.trim()) { toast.error("Вкажіть ім'я та email"); return; }
    start(async () => {
      const res = await inviteMember({
        name: name.trim(), email: email.trim(), title: title.trim(),
        role: role as "ADMIN" | "MEMBER" | "CLIENT",
        managerId: managerId === "none" ? null : managerId,
        weeklyHours: hours.trim() ? parseFloat(hours) : null,
      });
      if (res?.error) toast.error(res.error);
      else { setCreated({ email: email.trim(), pass: res.tempPassword! }); router.refresh(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><UserPlus className="size-4" /> Запросити співробітника</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Запросити співробітника</DialogTitle></DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-sm">Акаунт створено. Передайте співробітнику дані для входу:</p>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p><span className="text-muted-foreground">Email:</span> {created.email}</p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Пароль:</span> <span className="font-mono">{created.pass}</span>
                <button onClick={() => { navigator.clipboard.writeText(`${created.email} / ${created.pass}`); toast.success("Скопійовано"); }} className="text-muted-foreground hover:text-foreground"><Copy className="size-3.5" /></button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => reset()}>Додати ще</Button>
              <Button onClick={() => { setOpen(false); reset(); }}>Готово</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Ім&apos;я та прізвище</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
                <div className="space-y-2"><Label>Посада</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@company.com" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Роль</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Співробітник</SelectItem>
                      <SelectItem value="ADMIN">Адміністратор</SelectItem>
                      <SelectItem value="CLIENT">Клієнт</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Керівник</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Немає</SelectItem>
                      {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Годин/тиждень</Label><Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="40" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending}>{pending ? "Створення…" : "Запросити"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
