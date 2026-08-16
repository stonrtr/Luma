"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Users } from "lucide-react";

// Компактный переключатель «чью таблицу смотрим» — живёт оверлеем в ряду вкладок ленты Univer.
// Виден только руководителям/админам. Свой пункт помечен «(моя)». Выбор ведёт на /sheets?u=<id>.
export function SheetOwnerPicker({
  owners, currentId, selfId,
}: {
  owners: { id: string; name: string }[];
  currentId: string;
  selfId: string;
}) {
  const router = useRouter();
  return (
    <span className="relative inline-flex items-center" title="Таблиця співробітника">
      <Users className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
      <select
        value={currentId}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id === selfId ? "/sheets" : `/sheets?u=${id}`);
        }}
        className="h-7 max-w-[220px] cursor-pointer appearance-none rounded-md border bg-card py-0 pl-7 pr-6 text-sm font-medium text-foreground shadow-sm outline-none hover:border-ring focus:border-ring"
      >
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}{o.id === selfId ? " (моя)" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-muted-foreground" />
    </span>
  );
}
