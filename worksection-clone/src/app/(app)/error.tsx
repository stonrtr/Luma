"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Щось пішло не так</h2>
      <p className="mt-1 text-sm text-muted-foreground">Сталася помилка під час завантаження сторінки. Спробуйте ще раз.</p>
      {error.digest && <p className="mt-1 text-xs text-muted-foreground/70">Код: {error.digest}</p>}
      <Button className="mt-4" onClick={() => retry()}>Спробувати ще раз</Button>
    </div>
  );
}
