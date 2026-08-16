"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { createUser } from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function NewUserDialog() {
  const router = useRouter();
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("MEMBER");
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const title = String(formData.get("title") ?? "");
    const rateRaw = String(formData.get("rate") ?? "").trim();
    if (!name || !email || password.length < 6) {
      toast.error(tr("admin.fill"));
      return;
    }
    start(async () => {
      const res = await createUser({
        name,
        email,
        password,
        title,
        role: role as "ADMIN" | "MEMBER" | "CLIENT",
        hourlyRate: rateRaw ? parseFloat(rateRaw) : null,
      });
      if (res?.error) toast.error(res.error);
      else {
        toast.success(tr("admin.userCreated"));
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" /> {tr("admin.newUser")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr("admin.newUser")}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">{tr("admin.nameLabel")}</Label>
              <Input id="name" name="name" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">{tr("admin.position")}</Label>
              <Input id="title" name="title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="password">{tr("admin.password")}</Label>
              <Input id="password" name="password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">{tr("admin.rate")}</Label>
              <Input id="rate" name="rate" inputMode="decimal" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{tr("admin.role")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{tr("admin.roleAdmin")}</SelectItem>
                <SelectItem value="MEMBER">{tr("admin.roleMember")}</SelectItem>
                <SelectItem value="CLIENT">{tr("admin.roleClient")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? tr("common.creating") : tr("admin.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
