"use client";
import { useT } from "@/lib/locale-context";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, CheckCheck, Trash2, UserRound, Archive, ChevronDown, RotateCcw } from "lucide-react";
import {
  addCallContact, archiveCallContact, restoreCallContact, addCallTopic, addCallTopics, toggleCallTopic, closeAllCallTopics, deleteCallTopic, renameCallTopic,
} from "@/server/actions/calls";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type OpenTopic = { id: string; text: string };
type ArchivedTopic = { id: string; text: string; closedAt: string };
type Contact = { id: string; name: string; open: OpenTopic[]; doneToday: OpenTopic[]; archived: ArchivedTopic[] };
type ArchivedContact = { id: string; name: string; archivedAt: string; topicCount: number };

const GROUP_THRESHOLD = 8; // при таком числе закрытых тем — группируем архив тем по месяцам

export function CallContactsPanel({ contacts, archivedContacts, locale }: { contacts: Contact[]; archivedContacts: ArchivedContact[]; locale: string }) {
  const router = useRouter();
  const tr = useT();
  const [name, setName] = useState("");
  const [, start] = useTransition();

  function addContact() {
    const n = name.trim();
    if (!n) return;
    setName("");
    start(async () => { await addCallContact({ name: n }); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addContact()} placeholder={tr("calls.addContactPh")} className="h-9 max-w-xs" />
        <button onClick={addContact} className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-[#B7EE7A]/60">
          <Plus className="size-4" /> {tr("calls.addContactBtn")}
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">{tr("calls.noContacts")}</p>
      ) : (
        <div className="sm:columns-2 [column-gap:12px]">
          {contacts.map((c) => (
            <div key={c.id} className="mb-3 break-inside-avoid">
              <ContactCard contact={c} locale={locale} />
            </div>
          ))}
        </div>
      )}

      {archivedContacts.length > 0 && <ArchivedContacts items={archivedContacts} locale={locale} />}
    </div>
  );
}

function ContactCard({ contact, locale }: { contact: Contact; locale: string }) {
  const router = useRouter();
  const tr = useT();
  const [text, setText] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [confirmArch, setConfirmArch] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [, start] = useTransition();

  function addTopic() {
    const t = text.trim();
    if (!t) return;
    setText("");
    start(async () => { await addCallTopic({ contactId: contact.id, text: t }); router.refresh(); });
  }

  // Вставка списком: несколько строк / через «;» → каждая строка становится темой
  function bulkAdd(raw: string): boolean {
    const items = raw.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (items.length <= 1) return false;
    setText("");
    start(async () => { await addCallTopics({ contactId: contact.id, texts: items }); router.refresh(); });
    return true;
  }

  function saveEdit() {
    const id = editId;
    const v = editVal.trim();
    setEditId(null);
    if (!id || !v) return;
    const orig = contact.open.find((o) => o.id === id)?.text;
    if (v === orig) return; // без изменений — не дёргаем сервер
    start(async () => { await renameCallTopic({ id, text: v }); router.refresh(); });
  }

  const open = contact.open.length;
  const archived = contact.archived.length;

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><UserRound className="size-4" /></span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{contact.name}</p>
        {open > 0 && !confirmArch && (
          <button
            onClick={() => start(async () => { await closeAllCallTopics(contact.id); router.refresh(); })}
            className="flex items-center gap-1 rounded-md border border-[#B7EE7A] bg-accent px-2 py-1 text-xs font-medium text-accent-foreground transition-colors hover:bg-[#B7EE7A]/60"
            title={tr("calls.closeAll")}
          >
            <CheckCheck className="size-3.5" /> {tr("calls.closeAll")}
          </button>
        )}
        {/* Архивировать собеседника — обратимо, в два шага (без нативного confirm) */}
        {confirmArch ? (
          <span className="flex items-center gap-1">
            <button
              onClick={() => start(async () => { await archiveCallContact(contact.id); router.refresh(); })}
              className="flex items-center gap-1 rounded-md border border-[#B7EE7A] bg-accent px-2 py-1 text-xs font-medium text-accent-foreground transition-colors hover:bg-[#B7EE7A]/60"
            >
              <Archive className="size-3.5" /> {tr("calls.archiveContactBtn")}
            </button>
            <button onClick={() => setConfirmArch(false)} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" title={tr("common.cancel")}>
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirmArch(true)} className="text-muted-foreground/60 transition-colors hover:text-destructive" title={tr("calls.archiveContact")}>
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <ul className="mb-2 flex-1 space-y-1">
        {contact.open.map((p) => (
          <li key={p.id} className="group flex items-center gap-2 text-sm">
            <button
              onClick={() => start(async () => { await toggleCallTopic(p.id); router.refresh(); })}
              className="flex size-4 shrink-0 items-center justify-center rounded border border-muted-foreground/40 transition-colors hover:border-primary hover:bg-primary/10"
              title={tr("calls.markDone")}
            >
              <Check className="size-3 opacity-0 group-hover:opacity-40" />
            </button>
            {editId === p.id ? (
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } else if (e.key === "Escape") { setEditId(null); } }}
                className="flex-1 rounded border border-ring bg-transparent px-1 py-0.5 text-sm outline-none"
              />
            ) : (
              <span className="flex-1 cursor-text rounded px-1 hover:bg-muted/60" onClick={() => { setEditId(p.id); setEditVal(p.text); }} title={tr("calls.editTopic")}>{p.text}</span>
            )}
            <button onClick={() => start(async () => { await deleteCallTopic(p.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" title={tr("calls.deleteTopic")}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {/* Закрытые сегодня — зачёркнуты, остаются в карточке (в архив уйдут в полночь) */}
        {contact.doneToday.map((p) => (
          <li key={p.id} className="group flex items-center gap-2 text-sm">
            <button
              onClick={() => start(async () => { await toggleCallTopic(p.id); router.refresh(); })}
              className="flex size-4 shrink-0 items-center justify-center rounded border border-primary bg-primary text-primary-foreground"
              title={tr("calls.reopen")}
            >
              <Check className="size-3" />
            </button>
            <span className="flex-1 text-muted-foreground line-through">{p.text}</span>
            <button onClick={() => start(async () => { await deleteCallTopic(p.id); router.refresh(); })} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" title={tr("calls.deleteTopic")}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {open === 0 && contact.doneToday.length === 0 && <li className="text-xs text-muted-foreground">{tr("calls.noTopics")}</li>}
      </ul>

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTopic()}
          onPaste={(e) => { const raw = e.clipboardData.getData("text"); if (/[\n;]/.test(raw) && bulkAdd(raw)) e.preventDefault(); }}
          placeholder={tr("calls.addTopicPh")}
          className="h-8"
        />
        <button onClick={addTopic} className="flex size-8 shrink-0 items-center justify-center rounded-md border hover:bg-muted"><Plus className="size-4" /></button>
      </div>

      {/* Архив тем собеседника: закрытые галочкой, только просмотр */}
      {archived > 0 && (
        <div className="mt-3 border-t pt-2">
          <button
            onClick={() => setShowArchive((v) => !v)}
            className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Archive className="size-3.5" />
            {tr("calls.archiveBtn")}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">{archived}</span>
            <ChevronDown className={cn("ml-auto size-3.5 transition-transform", showArchive && "rotate-180")} />
          </button>
          {showArchive && <ArchiveList items={contact.archived} locale={locale} />}
        </div>
      )}
    </div>
  );
}

// Раздел архивных собеседников — можно вернуть из архива
function ArchivedContacts({ items, locale }: { items: ArchivedContact[]; locale: string }) {
  const router = useRouter();
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="rounded-xl border bg-card/50">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <Archive className="size-4" />
        {tr("calls.archivedContactsHeader")}
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">{items.length}</span>
        <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="divide-y border-t">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <UserRound className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(c.archivedAt, locale)}</span>
              <button
                onClick={() => start(async () => { await restoreCallContact(c.id); router.refresh(); })}
                className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={tr("calls.reopen")}
              >
                <RotateCcw className="size-3.5" /> {tr("calls.reopen")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Список закрытых тем. При множестве — группировка по месяцам. Можно удалить строку.
function ArchiveList({ items, locale }: { items: ArchivedTopic[]; locale: string }) {
  const router = useRouter();
  const tr = useT();
  const [, start] = useTransition();
  const monthFmt = new Intl.DateTimeFormat(locale === "uk" ? "uk" : locale === "en" ? "en" : "ru", { month: "long", year: "numeric" });
  const grouped = items.length > GROUP_THRESHOLD;

  const row = (it: ArchivedTopic) => (
    <li key={it.id} className="group flex items-center gap-2 py-1 text-xs">
      <Check className="size-3 shrink-0 text-accent-foreground" />
      <span className="min-w-0 flex-1 truncate text-muted-foreground line-through">{it.text}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground/70">{formatDate(it.closedAt, locale)}</span>
      <button
        onClick={() => start(async () => { await deleteCallTopic(it.id); router.refresh(); })}
        className="shrink-0 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        title={tr("calls.deleteTopic")}
      >
        <X className="size-3.5" />
      </button>
    </li>
  );

  return (
    <div className="mt-1.5">
      {!grouped ? (
        <ul>{items.map(row)}</ul>
      ) : (
        <div className="space-y-2">
          {groupByMonth(items, monthFmt).map((g) => (
            <div key={g.key}>
              <p className="text-[11px] font-medium capitalize text-muted-foreground">{g.label}</p>
              <ul>{g.items.map(row)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByMonth(items: ArchivedTopic[], fmt: Intl.DateTimeFormat) {
  const map = new Map<string, { key: string; label: string; items: ArchivedTopic[] }>();
  for (const it of items) {
    const d = new Date(it.closedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = map.get(key);
    if (!g) { g = { key, label: fmt.format(d), items: [] }; map.set(key, g); }
    g.items.push(it);
  }
  return [...map.values()];
}
