"use client";

import Link from "next/link";
import { IcX } from "./icons";

export default function StudyHeader({
  setId,
  title,
  right,
}: {
  setId: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-14 z-30 bg-canvas-c/90 backdrop-blur border-b border-line-c">
      <div className="mx-auto flex h-14 max-w-[1000px] items-center justify-between px-4">
        <div className="font-bold text-heading-c truncate">{title}</div>
        <div className="flex items-center gap-2">
          {right}
          <Link
            href={`/${setId}`}
            className="grid h-9 w-9 place-items-center rounded-full text-heading-c hover:bg-white/60"
            aria-label="Close"
          >
            <IcX />
          </Link>
        </div>
      </div>
    </div>
  );
}
