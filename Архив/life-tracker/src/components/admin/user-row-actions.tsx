"use client";
import { useT } from "@/lib/locale-context";

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
  const tr = useT();
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
          if (res?.error) toast.error(res.error); else { toast.success(isActive ? tr("urow.deactivated") : tr("urow.activated")); router.refresh(); }
        })}>
          <Power className="size-4" /> {isActive ? tr("urow.deactivate") : tr("urow.activate")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => {
          if (!confirm(tr("org.deleteConfirm"))) return;
          start(async () => {
            const res = await deleteUser(userId);
            if (res?.error) toast.error(res.error); else { toast.success(tr("common.deleted")); router.refresh(); }
          });
        }}>
          <Trash2 className="size-4" /> {tr("common.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
