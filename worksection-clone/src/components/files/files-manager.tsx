"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LinkIcon, Upload, X, FileText, Share2, Check, Copy, Users, FolderInput } from "lucide-react";
import { addFileLink, uploadFileDoc, deleteFile, shareFile, setDriveFolder } from "@/server/actions/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { driveEmbedUrl } from "@/lib/drive";

type OwnFile = { id: string; name: string; url: string; kind: string; note: string | null; shares: { user: { id: string; name: string } }[] };
type TeamFile = { id: string; name: string; url: string; kind: string; owner: { name: string } };
type SharedFile = { id: string; name: string; url: string; kind: string; owner: { name: string } };
type UserOpt = { id: string; name: string };

function useCopy() {
  return (url: string) => {
    const abs = url.startsWith("http") ? url : (typeof window !== "undefined" ? window.location.origin : "") + url;
    navigator.clipboard.writeText(abs).then(() => toast.success("Посилання скопійовано")).catch(() => toast.error("Не вдалося скопіювати"));
  };
}

function FileIcon({ kind }: { kind: string }) {
  return kind === "LINK" ? <LinkIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />;
}

export function FilesManager({
  team, own, shared, users, driveFolderUrl, isAdmin,
}: {
  team: TeamFile[]; own: OwnFile[]; shared: SharedFile[]; users: UserOpt[]; driveFolderUrl: string | null; isAdmin: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();
  const copy = useCopy();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isTeam, setIsTeam] = useState(false);
  const [drive, setDrive] = useState(driveFolderUrl ?? "");

  const embed = driveFolderUrl ? driveEmbedUrl(driveFolderUrl) : null;

  function addLink() {
    if (!name.trim() || !url.trim()) { toast.error("Вкажіть назву та посилання"); return; }
    start(async () => {
      const res = await addFileLink({ name, url, isTeam: isTeam && isAdmin });
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
  function saveDrive() {
    start(async () => {
      const res = await setDriveFolder({ url: drive });
      if (res?.error) toast.error(res.error);
      else { toast.success("Папку збережено"); router.refresh(); }
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
        {isAdmin && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={isTeam} onCheckedChange={(c) => setIsTeam(!!c)} />
            <Users className="size-3.5 text-muted-foreground" /> Командний файл (видно всім)
          </label>
        )}
      </div>

      {/* Командные файлы — приоритетнее, сверху */}
      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Users className="size-4 text-primary" /> Командні файли</h2>
        <div className="space-y-1.5">
          {team.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <FileIcon kind={f.kind} />
              <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:text-primary">{f.name}</a>
              <button onClick={() => copy(f.url)} className="text-muted-foreground hover:text-foreground" title="Скопіювати посилання"><Copy className="size-4" /></button>
              {isAdmin && (
                <button onClick={() => start(async () => { await deleteFile(f.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"><X className="size-3.5" /></button>
              )}
            </div>
          ))}
          {team.length === 0 && <p className="text-sm text-muted-foreground">Командних файлів поки немає.</p>}
        </div>
      </div>

      {/* Google Drive папка */}
      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><FolderInput className="size-4 text-primary" /> Файли з Google Drive</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="Посилання на папку Google Drive…" className="h-8 flex-1" />
          <Button size="sm" variant="outline" onClick={saveDrive}>Зберегти папку</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Папка має бути відкрита «усім, хто має посилання» — тоді список файлів підтягнеться та оновлюватиметься автоматично.</p>
        {embed ? (
          <iframe src={embed} className="mt-3 h-96 w-full rounded-lg border bg-white" title="Google Drive" />
        ) : driveFolderUrl ? (
          <p className="mt-3 text-sm text-destructive">Не вдалося розпізнати ID папки з посилання.</p>
        ) : null}
      </div>

      {/* Мои файлы */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Мої файли</h2>
        <div className="space-y-1.5">
          {own.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <FileIcon kind={f.kind} />
              <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:text-primary">{f.name}</a>
              {f.shares.length > 0 && <span className="hidden text-xs text-muted-foreground sm:inline">спільний: {f.shares.map((s) => s.user.name).join(", ")}</span>}
              <button onClick={() => copy(f.url)} className="text-muted-foreground hover:text-foreground" title="Скопіювати посилання"><Copy className="size-4" /></button>
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
                <FileIcon kind={f.kind} />
                <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:text-primary">{f.name}</a>
                <span className="text-xs text-muted-foreground">від {f.owner.name}</span>
                <button onClick={() => copy(f.url)} className="text-muted-foreground hover:text-foreground" title="Скопіювати посилання"><Copy className="size-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
