"use client";
import { useT } from "@/lib/locale-context";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, X, Upload } from "lucide-react";
import { uploadAttachment, deleteAttachment } from "@/server/actions/attachments";

type Attachment = {
  id: string;
  fileName: string;
  sizeBytes: number;
  url: string;
  uploadedBy: { name: string };
};

function formatSize(bytes: number, tr: (k: string) => string) {
  if (bytes < 1024) return `${bytes} ${tr("att.b")}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ${tr("att.kb")}`;
  return `${(bytes / 1024 / 1024).toFixed(1)} ${tr("att.mb")}`;
}

export function Attachments({ taskId, items }: { taskId: string; items: Attachment[] }) {
  const router = useRouter();
  const tr = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState(false);

  function upload(file: File) {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("file", file);
    start(async () => {
      const res = await uploadAttachment(fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(tr("att.fileUploaded"));
        router.refresh();
      }
    });
  }

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Paperclip className="size-4" /> {tr("att.title")} ({items.length})
      </h3>

      <ul className="space-y-1.5">
        {items.map((a) => (
          <li key={a.id} className="group flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-accent-foreground">
              {a.fileName}
            </a>
            <span className="shrink-0 text-xs text-muted-foreground">{formatSize(a.sizeBytes, tr)}</span>
            <button
              onClick={() =>
                start(async () => {
                  await deleteAttachment({ id: a.id, taskId });
                  router.refresh();
                })
              }
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        className={`mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground ${
          dragging ? "border-primary/60 bg-accent/50" : ""
        }`}
      >
        <Upload className="size-4" />
        {pending ? tr("fm.uploading") : tr("att.dropHint")}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
