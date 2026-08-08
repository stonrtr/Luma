"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import SetCard from "@/components/SetCard";
import { IcPlus } from "@/components/icons";

export default function Library() {
  const { data, ready, createFolder } = useStore();
  const [tab, setTab] = useState<"sets" | "folders" | "classes">("sets");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;

  const mine = data.sets.filter((s) => s.authorId === data.user.id);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6">
      <h1 className="text-2xl font-black text-heading-c">Your library</h1>

      <div className="mt-4 flex gap-1 border-b border-line-c">
        {(["sets", "folders", "classes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "px-4 py-3 text-sm font-bold capitalize border-b-[3px] -mb-px " +
              (tab === t
                ? "border-assembly text-heading-c"
                : "border-transparent text-muted-c hover:text-heading-c")
            }
          >
            {t === "sets" ? "Study sets" : t}
          </button>
        ))}
      </div>

      {tab === "sets" && (
        <div className="mt-6">
          {mine.length === 0 ? (
            <Empty label="You haven't created any sets yet." cta />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {mine.map((s) => (
                <SetCard key={s.id} set={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "folders" && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newName.trim()) {
                    createFolder(newName.trim());
                    setNewName("");
                    setCreating(false);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Folder name"
                  className="surface rounded-lg border-2 border-line-c p-2 text-heading-c outline-none focus:border-assembly"
                />
                <button className="qbtn qbtn-primary">Create</button>
              </form>
            ) : (
              <button className="qbtn qbtn-ghost" onClick={() => setCreating(true)}>
                <IcPlus size={18} /> New folder
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.folders.map((f) => (
              <Link
                key={f.id}
                href={`/folders/${f.id}`}
                className="surface flex items-center gap-3 rounded-2xl border border-line-c p-4 hover:border-assembly"
              >
                <span className="text-2xl">📁</span>
                <div>
                  <div className="font-bold text-heading-c">{f.name}</div>
                  <div className="text-xs text-muted-c">{f.setIds.length} sets</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === "classes" && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.classes.map((c) => (
            <div key={c.id} className="surface rounded-2xl border border-line-c p-4">
              <div className="font-bold text-heading-c">{c.name}</div>
              <div className="text-xs text-muted-c">
                {c.school} · {c.memberCount} members · {c.setIds.length} sets
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ label, cta }: { label: string; cta?: boolean }) {
  return (
    <div className="surface rounded-2xl border border-dashed border-line-c p-12 text-center">
      <p className="text-muted-c">{label}</p>
      {cta && (
        <Link href="/create" className="qbtn qbtn-primary mt-4 inline-flex">
          <IcPlus size={18} /> Create a set
        </Link>
      )}
    </div>
  );
}
