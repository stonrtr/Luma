"use client";
import { useT } from "@/lib/locale-context";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  const tr = useT();
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {tr("common.back")}
    </button>
  );
}
