"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import { IcPlus, IcTrash, IcX } from "@/components/icons";
import type { Term } from "@/lib/types";

const LANGS = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["ja", "Japanese"],
  ["zh", "Chinese"],
  ["ko", "Korean"],
];

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const { getSet, createSet, updateSet, ready } = useStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [termLang, setTermLang] = useState("en");
  const [defLang, setDefLang] = useState("en");
  const [rows, setRows] = useState<Term[]>([
    { id: uid(), term: "", definition: "" },
    { id: uid(), term: "", definition: "" },
    { id: uid(), term: "", definition: "" },
  ]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    if (editId && ready) {
      const s = getSet(editId);
      if (s) {
        setTitle(s.title);
        setDescription(s.description);
        setSubject(s.subject ?? "");
        setTermLang(s.termLang);
        setDefLang(s.defLang);
        setRows(s.terms.length ? s.terms : rows);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, ready]);

  const setRow = (id: string, patch: Partial<Term>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addRow = () => setRows((r) => [...r, { id: uid(), term: "", definition: "" }]);
  const removeRow = (id: string) =>
    setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));

  const doImport = () => {
    // rows separated by newlines, term/def separated by tab or comma or " - "
    const parsed: Term[] = importText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\t|,| - |;/).map((p) => p.trim());
        return { id: uid(), term: parts[0] ?? "", definition: parts.slice(1).join(", ") };
      })
      .filter((t) => t.term);
    if (parsed.length) {
      setRows((r) => [...r.filter((x) => x.term || x.definition), ...parsed]);
    }
    setShowImport(false);
    setImportText("");
  };

  const save = () => {
    const terms = rows.filter((r) => r.term.trim() && r.definition.trim());
    if (!title.trim()) {
      alert("Please give your set a title.");
      return;
    }
    if (terms.length < 1) {
      alert("Add at least one term with a definition.");
      return;
    }
    if (editId) {
      updateSet(editId, { title, description, subject, termLang, defLang, terms });
      router.push(`/${editId}`);
    } else {
      const id = createSet({ title, description, subject, termLang, defLang, terms });
      router.push(`/${id}`);
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-heading-c">
          {editId ? "Edit set" : "Create a new study set"}
        </h1>
        <button className="qbtn qbtn-primary" onClick={save}>
          {editId ? "Save" : "Create"}
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder='Enter a title, like "Biology — Chapter 22: Evolution"'
        className="surface mt-6 w-full rounded-xl border-2 border-line-c p-4 text-lg text-heading-c outline-none focus:border-assembly"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add a description…"
        className="surface mt-3 w-full rounded-xl border-2 border-line-c p-3 text-heading-c outline-none focus:border-assembly"
      />

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="surface rounded-xl border-2 border-line-c p-3 text-heading-c outline-none focus:border-assembly"
        />
        <LangSelect label="Term language" value={termLang} onChange={setTermLang} />
        <LangSelect label="Definition language" value={defLang} onChange={setDefLang} />
      </div>

      <div className="mt-5 flex gap-2">
        <button className="qbtn qbtn-ghost" onClick={() => setShowImport(true)}>
          Import terms
        </button>
      </div>

      {/* rows */}
      <div className="mt-4 space-y-3">
        {rows.map((row, idx) => (
          <div key={row.id} className="surface rounded-2xl border border-line-c p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-muted-c">{idx + 1}</span>
              <button
                className="text-muted-c hover:text-incorrect"
                onClick={() => removeRow(row.id)}
              >
                <IcTrash size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <input
                  value={row.term}
                  onChange={(e) => setRow(row.id, { term: e.target.value })}
                  placeholder="Term"
                  className="w-full border-b-2 border-line-c bg-transparent pb-2 text-heading-c outline-none focus:border-assembly"
                />
                <div className="mt-1 text-xs text-muted-c">TERM</div>
              </div>
              <div>
                <input
                  value={row.definition}
                  onChange={(e) => setRow(row.id, { definition: e.target.value })}
                  placeholder="Definition"
                  className="w-full border-b-2 border-line-c bg-transparent pb-2 text-heading-c outline-none focus:border-assembly"
                />
                <div className="mt-1 text-xs text-muted-c">DEFINITION</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="surface mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-c p-4 font-bold text-heading-c hover:border-assembly hover:text-assembly"
      >
        <IcPlus size={18} /> Add card
      </button>

      <div className="mt-6 flex justify-end">
        <button className="qbtn qbtn-primary" onClick={save}>
          {editId ? "Save changes" : "Create set"}
        </button>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="surface w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-heading-c">Import data</h2>
              <button onClick={() => setShowImport(false)} className="text-muted-c">
                <IcX />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-c">
              Paste one card per line. Separate term and definition with a{" "}
              <b>tab</b>, <b>comma</b>, semicolon, or <b> - </b>.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              placeholder={"ser\tto be\nestar - to be (temporary)\ntener, to have"}
              className="mt-3 w-full rounded-xl border-2 border-line-c bg-transparent p-3 font-mono text-sm text-heading-c outline-none focus:border-assembly"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="qbtn qbtn-ghost" onClick={() => setShowImport(false)}>
                Cancel
              </button>
              <button className="qbtn qbtn-primary" onClick={doImport}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LangSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="surface rounded-xl border-2 border-line-c p-3 text-heading-c outline-none focus:border-assembly"
    >
      {LANGS.map(([code, name]) => (
        <option key={code} value={code}>
          {label.split(" ")[0]}: {name}
        </option>
      ))}
    </select>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-c">Loading…</div>}>
      <CreateInner />
    </Suspense>
  );
}
