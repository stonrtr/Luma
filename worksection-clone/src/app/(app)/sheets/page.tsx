import { redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { canManageUser } from "@/server/authz";
import { getOrCreatePersonalSpreadsheet, getAccessibleSheetOwners } from "@/server/queries/spreadsheets";
import { SpreadsheetEditor } from "@/components/sheets/spreadsheet-editor";

export const dynamic = "force-dynamic";

// Одна таблица на пользователя. Руководитель/админ переключается на таблицу подчинённого (?u=<id>).
// Переключатель встроен оверлеем в ряд вкладок ленты (внутри редактора).
export default async function SheetsPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const user = await requireUser();
  if (user.role === "CLIENT") redirect("/");

  const { u } = await searchParams;
  let targetId = user.id;
  let targetName: string | undefined;
  if (u && u !== user.id) {
    if (await canManageUser(user, u)) {
      targetId = u;
      const t = await import("@/server/db").then((m) => m.db.user.findUnique({ where: { id: u }, select: { name: true } }));
      targetName = t?.name;
    } else {
      redirect("/sheets");
    }
  }

  const [sheet, owners] = await Promise.all([
    getOrCreatePersonalSpreadsheet(targetId, targetName ?? user.name),
    getAccessibleSheetOwners(user),
  ]);

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0">
      <SpreadsheetEditor
        key={sheet.id}
        id={sheet.id}
        initialData={sheet.data}
        owners={owners}
        currentId={targetId}
        selfId={user.id}
      />
    </div>
  );
}
