"use client";

import Link from "next/link";
import type { StudySet } from "@/lib/types";

export default function SetCard({ set }: { set: StudySet }) {
  return (
    <Link
      href={`/${set.id}`}
      className="surface block rounded-2xl border border-line-c p-4 hover:border-assembly transition-colors"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-canvas-c px-2.5 py-1 text-xs font-bold text-body-c">
          {set.terms.length} terms
        </span>
        {set.subject && (
          <span className="text-xs text-muted-c">{set.subject}</span>
        )}
      </div>
      <h3 className="mt-3 font-bold text-heading-c line-clamp-2 min-h-[48px]">
        {set.title}
      </h3>
      <div className="mt-4 flex items-center gap-2">
        <span
          className="grid h-6 w-6 place-items-center rounded-full text-white text-[11px] font-bold"
          style={{ background: "#4255ff" }}
        >
          {set.authorName[0]?.toUpperCase()}
        </span>
        <span className="text-xs text-muted-c truncate">{set.authorName}</span>
      </div>
    </Link>
  );
}

export function SetCardMini({ set }: { set: StudySet }) {
  return (
    <Link
      href={`/${set.id}`}
      className="surface flex items-center justify-between gap-3 rounded-xl border border-line-c p-3 hover:border-assembly transition-colors"
    >
      <div className="min-w-0">
        <div className="font-bold text-heading-c truncate">{set.title}</div>
        <div className="text-xs text-muted-c">
          {set.terms.length} terms · {set.authorName}
        </div>
      </div>
      <span className="rounded-full bg-canvas-c px-2.5 py-1 text-xs font-bold text-body-c shrink-0">
        Flashcards
      </span>
    </Link>
  );
}
