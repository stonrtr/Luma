"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/locale-context";
import { useRouter } from "next/navigation";
import { Search, CheckSquare, FolderKanban, User } from "lucide-react";
import { globalSearch } from "@/server/actions/search";
import type { SearchResults } from "@/server/queries/search";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const EMPTY: SearchResults = { tasks: [], projects: [], people: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResults>(EMPTY);
  const [pending, start] = useTransition();
  const tr = useT();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⌘K / Ctrl+K — открыть
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) { setQ(""); setRes(EMPTY); }
  }, [open]);

  function onChange(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setRes(EMPTY); return; }
    timer.current = setTimeout(() => {
      start(async () => setRes(await globalSearch(value)));
    }, 180);
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const total = res.tasks.length + res.projects.length + res.people.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        title={`${tr("search.ph")} (⌘K)`}
        aria-label={tr("search.ph")}
      >
        <Search className="size-4" />
        <span className="hidden lg:inline">{tr("search.ph")}</span>
        <kbd className="ml-1 hidden rounded border bg-muted px-1 text-[10px] lg:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" showCloseButton={false}>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => onChange(e.target.value)}
              placeholder={tr("search.ph")}
              className="h-12 border-0 px-0 focus-visible:ring-0"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{tr("search.min")}</p>
            ) : total === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{pending ? tr("search.ph") : tr("search.notFound")}</p>
            ) : (
              <>
                <Group label={tr("search.tasks")} show={res.tasks.length > 0}>
                  {res.tasks.map((t) => (
                    <Row key={t.id} icon={<CheckSquare className="size-4" />} onClick={() => go(`/tasks/${t.id}`)}
                      title={t.title} sub={t.projectName ?? undefined} />
                  ))}
                </Group>
                <Group label={tr("search.projects")} show={res.projects.length > 0}>
                  {res.projects.map((p) => (
                    <Row key={p.id} icon={<FolderKanban className="size-4" style={{ color: p.color }} />} onClick={() => go(`/projects/${p.id}`)} title={p.name} />
                  ))}
                </Group>
                <Group label={tr("search.people")} show={res.people.length > 0}>
                  {res.people.map((u) => (
                    <Row key={u.id} icon={<User className="size-4" />} onClick={() => go(`/team?member=${u.id}`)} title={u.name} sub={u.title ?? undefined} />
                  ))}
                </Group>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="mb-1">
      <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Row({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {sub && <span className="shrink-0 truncate text-xs text-muted-foreground">{sub}</span>}
    </button>
  );
}
