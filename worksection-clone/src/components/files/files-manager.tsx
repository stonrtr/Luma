"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LinkIcon, Upload, X, FileText, Share2, Check } from "lucide-react";
import { addFileLink, uploadFileDoc, deleteFile, shareFile } from "@/server/actions/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type OwnFile = { id: string; name: string; url: string; kind: string; note: string | null; shares: { user: { id: string; name: string } }[] };
type SharedFile = { id: string; name: string; url: string; kind: string; owner: { name: string } };
type UserOpt = { id: string; name: string };

export function FilesManager({ own, shared, users }: { own: OwnFile[]; shared: SharedFile[]; users: UserOpt[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  function addLink() {
    if (!name.trim() || !url.trim()) { toast.error("Вкажіть назву та посилання"); return; }
    start(async () => {
      const res = await addFileLink({ name, url });
      if (res?.error) toast.error(res.error);
      else { setName(""); setUrl(""); toast.success("Додано"); router.refresh(); }
    });
  }
  function upload(file: File) {
    const fd = new FormData(); fd.set("file", file);
    start(async () => {
      const res = await uploadFileDoc(fd);
      if (res?.error) toast.error(res.error);
      else { toast.success("Завантажено"); router.refresh(); }
    });
  }

  return (
    <div className="space-y-8">
      {/* Добавление */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Назва</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Бренд-бук" className="h-8" />
          </div>
          <div className="flex-[2] space-y-1">
            <label className="text-xs text-muted-foreground">Посилання</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} placeholder="https://…" className="h-8" />
          </div>
          <Button size="sm" onClick={addLink}><LinkIcon className="size-4" /> Додати</Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Завантажити</Button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
      </div>

      {/* Мои файлы */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Мої файли</h2>
        <div className="space-y-1.5">
          {own.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              {f.kind === "LINK" ? <LinkIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
              <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:text-primary">{f.name}</a>
              {f.shares.length > 0 && <span className="text-xs text-muted-foreground">спільний: {f.shares.map((s) => s.user.name).join(", ")}</span>}
              <Popover>
                <PopoverTrigger className="text-muted-foreground hover:text-foreground" title="Поділитися"><Share2 className="size-4" /></PopoverTrigger>
                <PopoverContent className="w-56" align="end">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Поділитися з</p>
                  <div className="space-y-1">
                    {users.map((u) => {
                      const on = f.shares.some((s) => s.user.id === u.id);
                      return (
                        <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted">
                          <Checkbox checked={on} onCheckedChange={(c) => start(async () => { await shareFile({ fileId: f.id, userId: u.id, on: !!c }); router.refresh(); })} />
                          <span className="text-sm">{u.name}</span>
                          {on && <Check className="ml-auto size-3 text-emerald-500" />}
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <button onClick={() => start(async () => { await deleteFile(f.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><X className="size-3.5" /></button>
            </div>
          ))}
          {own.length === 0 && <p className="text-sm text-muted-foreground">Файлів поки немає.</p>}
        </div>
      </div>

      {/* Доступные мне */}
      {shared.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Доступні мені</h2>
          <div className="space-y-1.5">
            {shared.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                {f.kind === "LINK" ? <LinkIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
                <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:text-primary">{f.name}</a>
                <span className="text-xs text-muted-foreground">від {f.owner.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
