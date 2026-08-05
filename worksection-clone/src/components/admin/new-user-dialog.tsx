"use client";

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
      toast.error("Заполните имя, email и пароль (мин. 6 символов)");
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
        toast.success("Пользователь создан");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" /> Новый пользователь
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый пользователь</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input id="name" name="name" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Должность</Label>
              <Input id="title" name="title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" name="password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Ставка, $/ч</Label>
              <Input id="rate" name="rate" inputMode="decimal" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Роль</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Администратор</SelectItem>
                <SelectItem value="MEMBER">Сотрудник</SelectItem>
                <SelectItem value="CLIENT">Клиент</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
