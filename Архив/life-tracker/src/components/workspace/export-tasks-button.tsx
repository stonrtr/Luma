"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SummaryExtractor } from "@/components/calls/summary-extractor";
import { GlowRing } from "@/components/ui/glow-ring";
import { t } from "@/lib/i18n";

// Зелёная кнопка на доске: открывает разбор саммари → задачи прямо здесь.
export function ExportTasksButton({ userId, locale = "uk" }: { userId: string; locale?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <GlowRing tier={2} className="shrink-0">
        <DialogTrigger className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-sm font-medium text-[#3D6B26] transition-colors hover:bg-accent dark:text-[#A9D97F]">
          <FileUp className="size-4" /> {t(locale, "task.import")}
        </DialogTrigger>
      </GlowRing>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(locale, "task.importTitle")}</DialogTitle>
        </DialogHeader>
        <SummaryExtractor viewerId={userId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
