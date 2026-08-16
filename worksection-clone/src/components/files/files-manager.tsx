"use client";
import { useT } from "@/lib/locale-context";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LinkIcon, Upload, X, FileText, Check, Copy, Loader2, Eye } from "lucide-react";
import { addFileLink, uploadFileDoc, deleteFile } from "@/server/actions/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TeamFile = { id: string; name: string; url: string; kind: string; ownerId: string; ownerName: string };

function useCopy() {
  const tr = useT();
  return (url: string) => {
    const abs = url.startsWith("http") ? url : (typeof window !== "undefined" ? window.location.origin : "") + url;
    navigator.clipboard.writeText(abs).then(() => toast.success(tr("fm.linkCopied"))).catch(() => toast.error(tr("fm.copyFailed")));
  };
}

function FileIcon({ kind }: { kind: string }) {
  return kind === "LINK" ? <LinkIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />;
}

// Назва файлу: посилання відкривається зовні, завантажений файл — у попапі предпросмотру.
function FileName({ f, onPreview }: { f: { kind: string; url: string; name: string }; onPreview: () => void }) {
  if (f.kind === "LINK") {
    return <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:text-accent-foreground">{f.name}</a>;
  }
  return <button onClick={onPreview} className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent-foreground">{f.name}</button>;
}

const IMG_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

export function FilesManager({
  files, viewerId, isAdmin,
}: {
  files: TeamFile[]; viewerId: string; isAdmin: boolean;
}) {
  const router = useRouter();
  const tr = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();
  const copy = useCopy();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<{ name: string; ok: boolean | null; error?: string } | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);

  function addLink() {
    if (!name.trim() || !url.trim()) { toast.error(tr("fm.enterNameLink")); return; }
    start(async () => {
      const res = await addFileLink({ name, url });
      if (res?.error) toast.error(res.error);
      else { setName(""); setUrl(""); toast.success(tr("fm.added")); router.refresh(); }
    });
  }
  function upload(file: File) {
    const display = name.trim() || file.name;
    setUploadStatus({ name: display, ok: null });
    const fd = new FormData(); fd.set("file", file);
    if (name.trim()) fd.set("name", name.trim());
    start(async () => {
      const res = await uploadFileDoc(fd);
      if (res?.error) { setUploadStatus({ name: display, ok: false, error: res.error }); toast.error(res.error); }
      else { setUploadStatus({ name: display, ok: true }); setName(""); toast.success(tr("fm.uploaded")); router.refresh(); }
    });
  }

  return (
    <div className="space-y-8">
      {/* Добавление */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[130px] flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">{tr("fm.nameLabel")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("fm.namePh")} className="h-8" />
          </div>
          <div className="min-w-[200px] flex-[2] space-y-1">
            <label className="text-xs text-muted-foreground">{tr("fm.linkLabel")} <span className="text-muted-foreground/70">{tr("fm.orUpload")}</span></label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} placeholder="https://…" className="h-8" />
          </div>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> {tr("fm.uploadFile")}</Button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <Button size="sm" onClick={addLink} disabled={!name.trim() || !url.trim()}>{tr("common.add")}</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{tr("fm.hint")}</p>

        {/* Статус завантаження файлу */}
        {uploadStatus && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-1.5 text-sm">
            {uploadStatus.ok === null ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : uploadStatus.ok ? (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>
            ) : (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive text-white"><X className="size-3" /></span>
            )}
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{uploadStatus.name}</span>
            <span className={"shrink-0 text-xs " + (uploadStatus.ok === null ? "text-muted-foreground" : uploadStatus.ok ? "text-[#3D6B26] dark:text-[#A9D97F]" : "text-destructive")}>
              {uploadStatus.ok === null ? tr("fm.uploading") : uploadStatus.ok ? tr("common.ready") : (uploadStatus.error ?? tr("common.error"))}
            </span>
            {uploadStatus.ok !== null && (
              <button onClick={() => setUploadStatus(null)} className="shrink-0 text-muted-foreground hover:text-foreground" title={tr("fm.hide")}><X className="size-3.5" /></button>
            )}
          </div>
        )}
      </div>

      {/* Файлы команды — общий список */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">{tr("fm.teamFiles")}</h2>
        <div className="space-y-1.5">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <FileIcon kind={f.kind} />
              <FileName f={f} onPreview={() => setPreview({ name: f.name, url: f.url })} />
              <span className="hidden text-xs text-muted-foreground sm:inline">{f.ownerId === viewerId ? tr("fm.you") : f.ownerName}</span>
              {f.kind !== "LINK" && (
                <button onClick={() => setPreview({ name: f.name, url: f.url })} className="text-muted-foreground hover:text-foreground" title={tr("fm.view")}><Eye className="size-4" /></button>
              )}
              <button onClick={() => copy(f.url)} className="text-muted-foreground hover:text-foreground" title={tr("fm.copyLinkT")}><Copy className="size-4" /></button>
              {(f.ownerId === viewerId || isAdmin) && (
                <button onClick={() => start(async () => { await deleteFile(f.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" title={tr("fm.deleteT")}><X className="size-3.5" /></button>
              )}
            </div>
          ))}
          {files.length === 0 && <p className="text-sm text-muted-foreground">{tr("fm.empty")}</p>}
        </div>
      </div>

      {/* Попап предпросмотру файлу */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="w-[96vw] !max-w-[96vw] sm:!max-w-[96vw]">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            IMG_RE.test(preview.url)
              ? <img src={preview.url} alt={preview.name} className="max-h-[86vh] w-full rounded-lg object-contain" />
              : <iframe src={preview.url} title={preview.name} className="h-[86vh] w-full rounded-lg border bg-white" />
          )}
          {preview && (
            <a href={preview.url} target="_blank" rel="noreferrer" className="text-xs text-accent-foreground hover:underline">{tr("fm.openNewTab")}</a>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
