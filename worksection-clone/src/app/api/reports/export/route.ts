import { getCurrentUser } from "@/server/dal";
import { getTimeReport } from "@/server/queries/reports";

export const dynamic = "force-dynamic";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function row(cells: (string | number)[]): string {
  return cells.map(csvCell).join(";");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const report = await getTimeReport();
  const hours = (m: number) => (m / 60).toFixed(2);

  const lines: string[] = [];
  lines.push(row(["Розділ", "Назва", "Хвилини", "Години", "Вартість"]));
  for (const u of report.byUser) {
    const cost = u.rate != null ? (u.minutes / 60) * u.rate : "";
    lines.push(row(["Люди", u.name, u.minutes, hours(u.minutes), cost === "" ? "" : cost.toFixed(2)]));
  }
  for (const p of report.byProject) {
    lines.push(row(["Проєкти", p.name, p.minutes, hours(p.minutes), p.cost.toFixed(2)]));
  }
  lines.push(row(["Разом", "", report.total, hours(report.total), ""]));

  // BOM для корректной кириллицы в Excel
  const body = "﻿" + lines.join("\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="report-${date}.csv"`,
    },
  });
}
