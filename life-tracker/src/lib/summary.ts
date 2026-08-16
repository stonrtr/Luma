// Разбор размеченного шаблона саммари (секции «Ідеї» / «Задачі»).
// Чистые функции — без БД и без "use server", чтобы можно было юнит-тестить.

const IDEA_HEADER = /^\s*(іде[ії]|идеи|ideas)\s*:?\s*$/i;
const TASK_HEADER = /^\s*(задач[іаи]|задачи|tasks|to-?do)\s*:?\s*$/i;

// priority = null, коли не вказано (щоб відрізнити «немає» від явної 5).
export type StructuredTask = { title: string; priority: number | null; dueISO: string | null; dueLabel: string | null; plannedMinutes: number | null };
export type StructuredSummary = { ideas: string[]; tasks: StructuredTask[] };

// Префіл для майстра: неповні задачі імпорту відкриваються з уже відомими полями.
export type SummaryPrefill = { title: string; status: "IDEA" | "TODO"; priority?: number; dueDate?: string; plannedMinutes?: number };

// Запланований час: «2 год», «30 хв», «1 год 30 хв», «1.5 год», «45 хвилин».
// Повертає хвилини або null. Кирилиця не ловиться \b — використовуємо lookahead \P{L}.
export function parsePlannedMinutes(text: string): number | null {
  let total = 0;
  let found = false;
  const s = text.replace(",", ".");
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:годин(?:и|у)?|год|hours?|hrs?|h|час(?:а|ов|ів)?|ч|г)(?=\P{L}|$)/iu);
  if (h) { total += Math.round(parseFloat(h[1]) * 60); found = true; }
  const m = s.match(/(\d+)\s*(?:хвилин(?:и|у)?|хв|мин(?:ут(?:и|у)?)?|min(?:s|utes?)?|m|м)(?=\P{L}|$)/iu);
  if (m) { total += parseInt(m[1], 10); found = true; }
  return found ? total : null;
}

// Дедлайн у форматі «ДД.ММ» / «ДД.ММ.РРРР» → Date о 19:00 (кінець робочого дня).
// Без року → поточний; якщо дата вже минула — наступний рік.
export function parseDueDate(day: number, month: number, year?: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const now = new Date();
  let y = year ?? now.getFullYear();
  if (year && year < 100) y += 2000;
  let d = new Date(y, month - 1, day, 19, 0, 0, 0);
  if (isNaN(d.getTime()) || d.getMonth() !== month - 1) return null; // відсіює 31.02 тощо
  if (!year) {
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (d < startToday) d = new Date(y + 1, month - 1, day, 19, 0, 0, 0);
  }
  return d;
}

// «до» як окреме слово (кирилиця не ловиться \b в JS): початок або пробіл перед ним.
const DUE_RE = /(?:^|\s)до\s+(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/i;

function parseTaskLine(line: string): StructuredTask | null {
  const raw = line.trim();
  if (!raw) return null;
  // дедлайн: «До 21.08» / «до 21.08.2026» / «21.08.26»
  const dm = raw.match(DUE_RE);
  let dueISO: string | null = null;
  let dueLabel: string | null = null;
  let rest = raw;
  let titleCut = raw.length;
  if (dm) {
    const due = parseDueDate(Number(dm[1]), Number(dm[2]), dm[3] ? Number(dm[3]) : undefined);
    if (due) {
      dueISO = due.toISOString();
      const p = (n: number) => String(n).padStart(2, "0");
      dueLabel = `${p(due.getDate())}.${p(due.getMonth() + 1)}.${due.getFullYear()}`;
    }
    titleCut = (dm.index ?? 0) + dm[0].search(/до/i); // назва — до слова «до»
    rest = raw.replace(dm[0], " ");
  }
  // запланований час: «2 год», «30 хв» — прибираємо з rest, щоб цифри не пішли в пріоритет
  let plannedMinutes: number | null = null;
  const pm = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:годин(?:и|у)?|год|hours?|hrs?|h|час(?:а|ов|ів)?|ч|г|хвилин(?:и|у)?|хв|мин(?:ут(?:и|у)?)?|min(?:s|utes?)?)(?=\P{L}|$)/giu);
  if (pm) {
    plannedMinutes = parsePlannedMinutes(pm.join(" "));
    for (const frag of pm) rest = rest.replace(frag, " ");
  }
  // приоритет: останнє окреме число 1–10 (дата й час вже прибрані з rest); null = не вказано
  let priority: number | null = null;
  const nums = rest.match(/\b(\d{1,2})\b/g);
  if (nums) {
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = Number(nums[i]);
      if (n >= 1 && n <= 10) { priority = n; break; }
    }
  }
  // назва: те, що до «до …», без хвостового пріоритету/крапок/дефісів
  let title = raw.slice(0, titleCut).replace(/[\s.]*\b(?:10|[1-9])\b[\s.]*$/u, "").replace(/[.\-–—\s]+$/u, "").trim();
  if (!title) title = raw.replace(/[.\-–—\s]+$/u, "").trim();
  if (!title) return null;
  return { title: title.slice(0, 200), priority, dueISO, dueLabel, plannedMinutes };
}

// null → формат не размечен (нет ни одной секции) → обрабатываем как свободный текст.
export function parseStructuredSummary(summary: string): StructuredSummary | null {
  const lines = summary.split(/\r?\n/);
  const hasSection = lines.some((l) => IDEA_HEADER.test(l) || TASK_HEADER.test(l));
  if (!hasSection) return null;

  const ideas: string[] = [];
  const tasks: StructuredTask[] = [];
  let mode: "ideas" | "tasks" | null = null;
  for (const line of lines) {
    if (IDEA_HEADER.test(line)) { mode = "ideas"; continue; }
    if (TASK_HEADER.test(line)) { mode = "tasks"; continue; }
    const item = line.replace(/^\s*(?:[-*•·▪◦]|\d+[.)])\s+/u, "").trim();
    if (!item || mode === null) continue; // до першої секції (шапка) — ігноруємо
    if (mode === "ideas") ideas.push(item.slice(0, 200));
    else { const t = parseTaskLine(item); if (t) tasks.push(t); }
  }
  if (ideas.length === 0 && tasks.length === 0) return null;
  return { ideas, tasks };
}
