"use client";

import { createPortal } from "react-dom";

import { useEffect, useState } from "react";
import { Info, X, Keyboard, Sparkles } from "lucide-react";

type Help = { title: string; keysH: string; keys: [string, string][]; nuancesH: string; nuances: string[] };

const HELP: Record<string, Help> = {
  ru: {
    title: "Как пользоваться",
    keysH: "Горячие клавиши",
    keys: [
      ["1–7", "переход по вкладкам хедера"],
      ["z", "новая задача"],
      ["x", "заметки"],
      ["Esc", "закрыть окно / панель"],
      ["⌘/Ctrl + Enter", "создать (в формах и комментариях)"],
    ],
    nuancesH: "Как всё устроено",
    nuances: [
      "Приоритет 1–10: чем больше число, тем срочнее. Просроченные задачи подсвечены.",
      "Пуши: утром — план на день, вечером — итог (сколько закрыто + что не успел). Всплывают справа снизу со звуком, оседают в колоколе и дублируются в Telegram.",
      "«Жду коллегу» на задаче снимает с вас вину за просрочку, пока ждёте другого.",
      "«На проверку руководителю» → руководитель принимает или возвращает с обязательной причиной (она прилетает вам).",
      "Чек-лист внутри задачи — разбивайте на шаги «сделано N/5».",
      "Архив: задача со статусом «Завершено» автоматически уходит в архив через 7 дней после закрытия (смотреть — вкладка «Архив» на доске). Проекты со статусом «Завершено» архивируются сразу.",
      "Звонки: заводите собеседников и темы; «Закрыть все» отправляет темы в архив с датой.",
      "Заметки (x) — личный markdown-скретчпад, автосохранение, только для вас.",
      "Рассылки настраиваются в админке «Уведомления»: что, когда, куда и при каких условиях слать.",
    ],
  },
  uk: {
    title: "Як користуватися",
    keysH: "Гарячі клавіші",
    keys: [
      ["1–7", "перехід по вкладках хедера"],
      ["z", "нова задача"],
      ["x", "нотатки"],
      ["Esc", "закрити вікно / панель"],
      ["⌘/Ctrl + Enter", "створити (у формах і коментарях)"],
    ],
    nuancesH: "Як усе влаштовано",
    nuances: [
      "Пріоритет 1–10: що більше число, то терміновіше. Прострочені задачі підсвічені.",
      "Пуші: зранку — план на день, ввечері — підсумок (скільки закрито + що не встигли). Спливають справа знизу зі звуком, лишаються в дзвіночку та дублюються в Telegram.",
      "«Чекаю на колегу» на задачі знімає з вас провину за прострочення, поки чекаєте іншого.",
      "«На перевірку керівнику» → керівник приймає або повертає з обовʼязковою причиною (вона прилітає вам).",
      "Чек-лист усередині задачі — розбивайте на кроки «зроблено N/5».",
      "Архів: задача зі статусом «Завершено» автоматично йде в архів через 7 днів після закриття (дивитися — вкладка «Архів» на дошці). Проєкти зі статусом «Завершено» архівуються одразу.",
      "Дзвінки: заводьте співрозмовників і теми; «Закрити всі» відправляє теми в архів із датою.",
      "Нотатки (x) — особистий markdown-скретчпад, автозбереження, лише для вас.",
      "Розсилки налаштовуються в адмінці «Сповіщення»: що, коли, куди та за яких умов надсилати.",
    ],
  },
  en: {
    title: "How to use",
    keysH: "Keyboard shortcuts",
    keys: [
      ["1–7", "jump between header tabs"],
      ["z", "new task"],
      ["x", "notes"],
      ["Esc", "close dialog / panel"],
      ["⌘/Ctrl + Enter", "create (in forms and comments)"],
    ],
    nuancesH: "How it works",
    nuances: [
      "Priority 1–10: higher number = more urgent. Overdue tasks are highlighted.",
      "Pushes: a morning plan and an evening summary (closed count + what you missed). They pop up bottom-right with sound, stay in the bell, and mirror to Telegram.",
      "“Waiting on someone” on a task clears you of the overdue blame while you wait.",
      "“Send to review” → the manager approves or returns it with a required reason (delivered to you).",
      "Checklist inside a task — break work into steps “done N/5”.",
      "Archive: a task marked Done is auto-archived 7 days after completion (see the “Archive” tab on the board). Projects marked Done are archived immediately.",
      "Calls: add contacts and topics; “Close all” archives topics with a date.",
      "Notes (x) — your private markdown scratchpad, autosaved.",
      "Broadcasts are configured in admin “Notifications”: what, when, where and under which conditions.",
    ],
  },
};

// Иконка «i» в хедере: горячие клавиши + нюансы работы с воркспейсом.
export function HelpDialog({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);
  const c = HELP[locale] ?? HELP.ru;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} title={c.title} aria-label={c.title} className="flex size-8 items-center justify-center rounded-md hover:bg-muted">
        <Info className="size-4 text-muted-foreground" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button aria-label="close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/30" />
          <div role="dialog" aria-modal="true" className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b px-5 py-3.5">
              <span className="text-base font-semibold">{c.title}</span>
              <span className="flex-1" />
              <button onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="close">
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-accent-foreground">
                <Keyboard className="size-4" /> {c.keysH}
              </h3>
              <div className="mb-5 space-y-1.5">
                {c.keys.map(([k, action]) => (
                  <div key={k} className="flex items-center gap-3 text-sm">
                    <kbd className="min-w-[3rem] shrink-0 rounded-md border bg-muted px-2 py-0.5 text-center font-mono text-xs text-foreground">{k}</kbd>
                    <span className="text-muted-foreground">{action}</span>
                  </div>
                ))}
              </div>

              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-accent-foreground">
                <Sparkles className="size-4" /> {c.nuancesH}
              </h3>
              <ul className="space-y-2">
                {c.nuances.map((n, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#B7EE7A]" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        , document.body)}
    </>
  );
}
