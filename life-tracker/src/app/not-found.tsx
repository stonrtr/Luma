import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Сторінку не знайдено</h1>
      <p className="mt-1 text-sm text-muted-foreground">Можливо, її переміщено або видалено.</p>
      <Link href="/" className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80">
        На головну
      </Link>
    </div>
  );
}
