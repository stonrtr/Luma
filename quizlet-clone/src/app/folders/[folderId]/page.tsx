"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import SetCard from "@/components/SetCard";
import { IcFolder, IcPlus, IcX } from "@/components/icons";

export default function FolderDetail() {
  const { folderId } = useParams<{ folderId: string }>();
  const { data, ready, addSetToFolder, removeSetFromFolder } = useStore();
  const [adding, setAdding] = useState(false);

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;
  const folder = data.folders.find((f) => f.id === folderId);
  if (!folder)
    return (
      <div className="p-16 text-center">
        <h1 className="text-2xl font-black text-heading-c">Folder not found</h1>
        <Link href="/folders" className="qbtn qbtn-primary mt-4 inline-flex">
          Back to library
        </Link>
      </div>
    );

  const sets = folder.setIds
    .map((id) => data.sets.find((s) => s.id === id))
    .filter(Boolean) as typeof data.sets;
  const available = data.sets.filter((s) => !folder.setIds.includes(s.id));

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6">
      <div className="flex items-center gap-3">
        <IcFolder size={28} className="text-assembly" />
        <h1 className="text-2xl font-black text-heading-c">{folder.name}</h1>
      </div>
      <p className="mt-1 text-muted-c">{sets.length} sets</p>

      <button className="qbtn qbtn-ghost mt-4" onClick={() => setAdding(true)}>
        <IcPlus size={18} /> Add sets
      </button>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sets.map((s) => (
          <div key={s.id} className="relative">
            <SetCard set={s} />
            <button
              onClick={() => removeSetFromFolder(folder.id, s.id)}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-incorrect shadow"
              title="Remove from folder"
            >
              <IcX size={16} />
            </button>
          </div>
        ))}
        {sets.length === 0 && (
          <p className="col-span-full text-muted-c">This folder is empty.</p>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="surface w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-heading-c">Add sets to folder</h2>
              <button onClick={() => setAdding(false)} className="text-muted-c">
                <IcX />
              </button>
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto">
              {available.length === 0 && (
                <p className="text-muted-c">All your sets are already here.</p>
              )}
              {available.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addSetToFolder(folder.id, s.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-line-c p-3 text-left hover:border-assembly"
                >
                  <span className="font-bold text-heading-c">{s.title}</span>
                  <IcPlus size={18} className="text-assembly" />
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="qbtn qbtn-primary" onClick={() => setAdding(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
