"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import SetCard from "@/components/SetCard";

function SearchInner() {
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const { data, ready } = useStore();

  if (!ready) return <div className="p-10 text-center text-muted-c">Loading…</div>;

  const term = q.trim().toLowerCase();
  const results = term
    ? data.sets.filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.description.toLowerCase().includes(term) ||
          s.subject?.toLowerCase().includes(term) ||
          s.terms.some(
            (t) =>
              t.term.toLowerCase().includes(term) ||
              t.definition.toLowerCase().includes(term)
          )
      )
    : data.sets;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search study sets…"
        className="surface w-full rounded-xl border-2 border-line-c p-4 text-lg text-heading-c outline-none focus:border-assembly"
      />
      <h1 className="mt-6 text-xl font-black text-heading-c">
        {term ? (
          <>
            Results for <span className="text-assembly">“{q}”</span> ({results.length})
          </>
        ) : (
          "Browse all study sets"
        )}
      </h1>
      {results.length === 0 ? (
        <p className="mt-8 text-center text-muted-c">
          No sets found. Try a different search.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((s) => (
            <SetCard key={s.id} set={s} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-c">Loading…</div>}>
      <SearchInner />
    </Suspense>
  );
}
