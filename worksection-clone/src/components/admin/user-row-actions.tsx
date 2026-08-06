"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Power, Trash2 } from "lucide-react";
import { setUserActive, deleteUser } from "@/server/actions/users";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

export function UserRowActions({ userId, isActive, canManage }: { userId: string; isActive: boolean; canManage: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  if (!canManage) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => start(async () => {
          const res = await setUserActive({ userId, active: !isActive });
          if (res?.error) toast.error(res.error); else { toast.success(isActive ? "Деактивовано" : "Активовано"); router.refresh(); }
        })}>
          <Power className="size-4" /> {isActive ? "Деактивувати" : "Активувати"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => {
          if (!confirm("Видалити співробітника назавжди?")) return;
          start(async () => {
            const res = await deleteUser(userId);
            if (res?.error) toast.error(res.error); else { toast.success("Видалено"); router.refresh(); }
          });
        }}>
          <Trash2 className="size-4" /> Видалити
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
