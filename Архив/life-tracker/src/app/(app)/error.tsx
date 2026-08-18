"use client";
import { useT } from "@/lib/locale-context";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const tr = useT();
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">{tr("err.pageTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tr("err.pageBody")}</p>
      {error.digest && <p className="mt-1 text-xs text-muted-foreground/70">{tr("err.code")}: {error.digest}</p>}
      <Button className="mt-4" onClick={() => retry()}>{tr("err.retryBtn")}</Button>
    </div>
  );
}
