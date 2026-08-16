"use client";
import { useT } from "@/lib/locale-context";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportExport() {
  const tr = useT();
  return (
    <div className="flex shrink-0 gap-2 print:hidden">
      <Button asChild variant="outline" size="sm">
        <a href="/api/reports/export"><Download className="size-4" /> CSV</a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> {tr("rep.print")}
      </Button>
    </div>
  );
}
