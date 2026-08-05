"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, X } from "lucide-react";
import { addProjectMember, removeProjectMember } from "@/server/actions/members";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { initials } from "@/lib/format";

type Member = { userId: string; name: string; role: string; isSelf: boolean };
type Candidate = { id: string; name: string; title: string | null };

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Менеджер",
  MEMBER: "Участник",
  CLIENT: "Клиент",
};

export function ManageMembers({
  projectId,
  members,
  candidates,
}: {
  projectId: string;
  members: Member[];
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("MEMBER");

  function add() {
    if (!userId) {
      toast.error("Выберите пользователя");
      return;
    }
    start(async () => {
      await addProjectMember({ projectId, userId, role: role as "MANAGER" | "MEMBER" | "CLIENT" });
      setUserId("");
      toast.success("Участник добавлен");
      router.refresh();
    });
  }

  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">
        <Users className="size-3.5" /> Участники
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Участники проекта</DialogTitle>
        </DialogHeader>

        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 rounded-md px-1 py-1.5">
              <Avatar className="size-7">
                <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{m.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
              {!m.isSelf && (
                <button
                  onClick={() =>
                    start(async () => {
                      await removeProjectMember({ projectId, userId: m.userId });
                      router.refresh();
                    })
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {candidates.length > 0 && (
          <div className="flex items-end gap-2 border-t pt-3">
            <div className="flex-1">
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Добавить пользователя" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MANAGER">Менеджер</SelectItem>
                <SelectItem value="MEMBER">Участник</SelectItem>
                <SelectItem value="CLIENT">Клиент</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={add}>Добавить</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
