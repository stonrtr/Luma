/* =========================================================================
   «Приоритеты» — весь клиент в одном файле.

   Архитектура намеренно простая: единый объект `state`, а любая мутация
   заканчивается вызовом `render()`, который перерисовывает нужный экран
   с нуля. Никакого diffing — DOM пересобирается целиком (для личного
   инструмента этого более чем достаточно и легче держать в голове).
   ========================================================================= */

const TIMEFRAMES = [
  { key: "today", label: "Сегодня" },
  { key: "week",  label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "none",  label: "Без срока" },
];
const TF_LABEL = Object.fromEntries(TIMEFRAMES.map(t => [t.key, t.label]));
const ARCHIVE_AFTER_DAYS = 7;

// Палитра эмодзи для направлений — по темам (не свободный ввод).
const EMOJI_PALETTE = [
  "❤️","💪","🥗","🧘","🩺","😴","🚭","🧠",
  "💰","📈","💳","🏦","🪙","🧾","💵","🎯",
  "📚","🇬🇧","✏️","🎓","🧑‍💻","🔬","🌍","📝",
  "💼","🏢","🚀","📊","🤝","⚙️","🛠️","📌",
  "🏆","🏃","⚽","🏋️","🚴","🏊","⛰️","🧗",
  "🎤","🎭","🗣️","📣","🎙️","🎬","📷","🎨",
  "🎸","🎹","🎮","♟️","🧩","✈️","🏡","🌱",
  "👨‍👩‍👧","🐶","🍳","🧹","🙏","⭐","🔥","💡",
];

const state = {
  view: "board",                     // board | settings | archive
  board: { categories: [], cards: [], goals: [] },
  archive: { categories: [], cards: [] },
  settingsScrollTo: null,            // id направления, к которому проскроллить
};

const app = document.getElementById("app");

/* ----------------------------------------------------------------- иконки */

const ICON = {
  gear: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  back: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  restore: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

/* --------------------------------------------------------------------- API */

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch("/api" + path, opts);
  if (!res.ok) {
    let msg = "Ошибка запроса";
    try { msg = (await res.json()).error || msg; } catch (_) {}
    toast(msg);
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

async function loadBoard() {
  state.board = await api("GET", "/board");
}
async function loadArchive() {
  state.archive = await api("GET", "/archive");
}

/* ---------------------------------------------------------------- helpers */

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node && k !== "list") {
      node[k] = v;
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

let toastTimer = null;
function toast(text) {
  document.querySelector(".toast")?.remove();
  const t = el("div", { class: "toast", text });
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

// SQLite datetime('now') хранит UTC без таймзоны — читаем как UTC.
function parseUTC(s) {
  if (!s) return null;
  return new Date(s.replace(" ", "T") + "Z");
}
function daysLeft(doneAt) {
  const done = parseUTC(doneAt);
  if (!done) return ARCHIVE_AFTER_DAYS;
  const elapsedDays = (Date.now() - done.getTime()) / 86400000;
  return Math.max(0, Math.ceil(ARCHIVE_AFTER_DAYS - elapsedDays));
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/* Сжатие изображения на клиенте до 900px по большей стороне, JPEG 0.82. */
function fileToResizedDataURL(file, maxSide = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не удалось открыть изображение"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSide) {
          height = Math.round(height * maxSide / width); width = maxSide;
        } else if (height >= width && height > maxSide) {
          width = Math.round(width * maxSide / height); height = maxSide;
        }
        const canvas = el("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function checkbox(checked, cls, onToggle) {
  return el("button", {
    class: `${cls}${checked ? (cls === "check" ? " checked" : " done") : ""}`,
    onClick: onToggle,
    title: checked ? "Снять отметку" : "Отметить",
    html: ICON.check,
  });
}

/* ========================================================================= */
/*  ГЛАВНЫЙ РЕНДЕР                                                            */
/* ========================================================================= */

function render() {
  app.innerHTML = "";
  app.append(renderNavbar());
  if (state.view === "board")    app.append(renderBoard(), renderFab());
  if (state.view === "settings") app.append(renderSettings());
  if (state.view === "archive")  app.append(renderArchive());

  if (state.view === "settings" && state.settingsScrollTo != null) {
    const target = document.getElementById("dir-" + state.settingsScrollTo);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    state.settingsScrollTo = null;
  }
}

function renderNavbar() {
  const left = state.view === "board"
    ? el("h1", { class: "navbar__title", text: "Приоритеты" })
    : el("button", {
        class: "nav-btn nav-btn--ghost",
        html: ICON.back + "<span>Доска</span>",
        onClick: () => { state.view = "board"; render(); },
      });

  const actions = el("div", { class: "navbar__actions" });
  if (state.view === "board") {
    actions.append(el("button", {
      class: "nav-btn",
      html: `<span class="icon">${ICON.gear}</span><span>Настройки</span>`,
      onClick: () => { state.view = "settings"; render(); },
    }));
  } else if (state.view === "settings") {
    actions.append(el("button", {
      class: "nav-btn",
      text: "Архив",
      onClick: () => openArchive(),
    }));
  }
  return el("header", { class: "navbar" }, [left, actions]);
}

/* ========================================================================= */
/*  ДОСКА                                                                     */
/* ========================================================================= */

// Ранг срочности направления: 0 — есть задача «сегодня», … 4 — задач нет.
function urgencyRank(catId) {
  const active = state.board.cards.filter(c => c.category_id === catId && !c.done);
  if (active.some(c => c.timeframe === "today")) return 0;
  if (active.some(c => c.timeframe === "week"))  return 1;
  if (active.some(c => c.timeframe === "month")) return 2;
  if (active.some(c => c.timeframe === "none"))  return 3;
  return 4;
}

function orderedCategories() {
  return [...state.board.categories].sort((a, b) => {
    const ra = urgencyRank(a.id), rb = urgencyRank(b.id);
    if (ra !== rb) return ra - rb;             // сначала по срочности
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order; // затем ручной
    return a.id - b.id;
  });
}

function renderBoard() {
  const screen = el("div", { class: "screen" });

  if (state.board.categories.length === 0) {
    screen.append(el("div", { class: "empty-hint",
      text: "Пока нет направлений. Откройте «Настройки» и добавьте первое." }));
    return screen;
  }

  const cats = orderedCategories();
  const scroll = el("div", { class: "board-scroll" });
  const board = el("div", { class: "board" });
  board.style.gridTemplateColumns = `auto repeat(${cats.length}, max-content)`;

  // Строка заголовков.
  board.append(el("div", { class: "board__corner" }));
  cats.forEach(cat => board.append(renderColHead(cat)));

  // Строки сроков × направления.
  for (const tf of TIMEFRAMES) {
    board.append(el("div", { class: "board__rowlabel", text: tf.label }));
    for (const cat of cats) board.append(renderCell(cat, tf.key));
  }

  scroll.append(board);
  screen.append(scroll);
  screen.append(renderDoneTray());
  return screen;
}

function renderColHead(cat) {
  const hasCover = !!cat.background_image;
  const head = el("div", {
    class: "colhead" + (hasCover ? " has-cover" : ""),
    draggable: true,
    dataset: { catId: cat.id },
    title: "Клик — настройки · перетащите на другое направление, чтобы поменять местами",
  });

  if (hasCover) {
    const cover = el("div", { class: "colhead__cover" });
    cover.style.backgroundImage = `url("${cat.background_image}")`;
    head.append(cover);
  }

  const goals = state.board.goals
    .filter(g => g.category_id === cat.id && !g.done)
    .map(g => el("div", { class: "goal-chip" }, [
      el("span", { class: "dart", text: "🎯" }),
      el("span", { text: g.text }),
    ]));

  const inner = el("div", { class: "colhead__inner" }, [
    el("div", { class: "colhead__title" }, [
      el("span", { class: "colhead__emoji", text: cat.emoji || "•" }),
      el("span", { class: "colhead__name", text: cat.name }),
    ]),
    goals.length ? el("div", { class: "colhead__goals" }, goals) : null,
  ]);
  head.append(inner);

  // Клик по заголовку → настройки со скроллом к этому направлению.
  head.addEventListener("click", () => openSettings(cat.id));

  // DnD заголовков: перетащить один на другой → swap sort_order.
  head.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    dragCtx = { type: "cat", id: cat.id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "cat:" + cat.id);
    head.classList.add("dragging");
  });
  head.addEventListener("dragend", () => head.classList.remove("dragging"));
  head.addEventListener("dragover", (e) => {
    if (dragCtx?.type === "cat" && dragCtx.id !== cat.id) {
      e.preventDefault();
      head.classList.add("swap-target");
    }
  });
  head.addEventListener("dragleave", () => head.classList.remove("swap-target"));
  head.addEventListener("drop", (e) => {
    head.classList.remove("swap-target");
    if (dragCtx?.type === "cat" && dragCtx.id !== cat.id) {
      e.preventDefault();
      swapCategories(dragCtx.id, cat.id);
    }
  });

  return head;
}

function renderCell(cat, timeframe) {
  const cards = state.board.cards
    .filter(c => c.category_id === cat.id && c.timeframe === timeframe && !c.done)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const cell = el("div", {
    class: "cell " + (cards.length ? "has-cards" : "is-empty"),
    dataset: { catId: cat.id, timeframe },
  });

  cards.forEach(card => cell.append(renderCard(card)));

  // Ячейка — цель для дропа карточек.
  cell.addEventListener("dragover", (e) => {
    if (dragCtx?.type === "card") { e.preventDefault(); cell.classList.add("drop-hover"); }
  });
  cell.addEventListener("dragleave", () => cell.classList.remove("drop-hover"));
  cell.addEventListener("drop", (e) => {
    cell.classList.remove("drop-hover");
    if (dragCtx?.type === "card") {
      e.preventDefault();
      moveCard(dragCtx.id, cat.id, timeframe);
    }
  });

  return cell;
}

function renderCard(card) {
  const node = el("div", {
    class: "card" + (card.done ? " done" : ""),
    draggable: true,
    dataset: { cardId: card.id },
  });

  const title = el("div", {
    class: "card__title",
    contentEditable: "true",
    spellcheck: false,
    text: card.title,
  });
  title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); title.blur(); }
    if (e.key === "Escape") { title.textContent = card.title; title.blur(); }
  });
  title.addEventListener("blur", () => {
    const val = title.textContent.trim();
    if (val && val !== card.title) {
      api("PATCH", `/cards/${card.id}`, { title: val }).then(loadThenRender);
    } else {
      title.textContent = card.title;
    }
  });
  // Не начинать drag при выделении текста мышью в поле.
  title.addEventListener("mousedown", (e) => e.stopPropagation());
  title.addEventListener("dragstart", (e) => e.preventDefault());

  node.append(
    checkbox(!!card.done, "check", () => toggleCard(card)),
    title,
    el("button", {
      class: "card__del", html: "✕", title: "Удалить задачу",
      onClick: () => deleteCard(card),
    }),
  );

  node.addEventListener("dragstart", (e) => {
    dragCtx = { type: "card", id: card.id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "card:" + card.id);
    node.classList.add("dragging");
  });
  node.addEventListener("dragend", () => node.classList.remove("dragging"));

  return node;
}

function renderDoneTray() {
  const done = state.board.cards
    .filter(c => c.done)
    .sort((a, b) => (parseUTC(b.done_at)?.getTime() || 0) - (parseUTC(a.done_at)?.getTime() || 0));

  const tray = el("div", { class: "done-tray" });
  tray.append(el("h2", { class: "section-title", text: "Выполнено за неделю" }));

  if (done.length === 0) {
    tray.append(el("div", { class: "empty-hint",
      text: "Здесь появятся отмеченные задачи — и через неделю уедут в архив." }));
    return tray;
  }

  const catById = Object.fromEntries(state.board.categories.map(c => [c.id, c]));
  const list = el("div", { class: "tray-list" });
  for (const card of done) {
    const cat = catById[card.category_id];
    const left = daysLeft(card.done_at);
    const meta = left <= 0
      ? "уедет в архив сегодня"
      : `в архив через ${left} ${plural(left, "день", "дня", "дней")}`;
    list.append(el("div", { class: "tray-row" }, [
      el("span", { class: "tray-row__emoji", text: cat?.emoji || "✓" }),
      el("div", { class: "tray-row__body" }, [
        el("div", { class: "tray-row__title", text: card.title }),
        el("div", { class: "tray-row__meta", text: `${cat?.name || ""} · ${meta}` }),
      ]),
      el("div", { class: "tray-row__actions" }, [
        el("button", { class: "icon-btn restore", title: "Вернуть в работу",
          html: ICON.restore, onClick: () => toggleCard(card) }),
        el("button", { class: "icon-btn danger", title: "Удалить навсегда",
          html: ICON.trash, onClick: () => deleteCard(card) }),
      ]),
    ]));
  }
  tray.append(list);
  return tray;
}

function renderFab() {
  return el("button", {
    class: "fab", title: "Добавить задачу", "aria-label": "Добавить задачу",
    html: ICON.plus, onClick: openAddTask,
  });
}

/* --------------------------------------------------- мутации доски (DnD и т.п.) */

let dragCtx = null;

async function toggleCard(card) {
  await api("PATCH", `/cards/${card.id}`, { done: !card.done });
  await loadBoard();
  render();
}
async function deleteCard(card) {
  if (!confirm(`Удалить задачу «${card.title}» навсегда?`)) return;
  await api("DELETE", `/cards/${card.id}`);
  await loadBoard();
  render();
}
async function moveCard(cardId, categoryId, timeframe) {
  const card = state.board.cards.find(c => c.id === cardId);
  if (card && card.category_id === categoryId && card.timeframe === timeframe) return;
  await api("PATCH", `/cards/${cardId}`, { category_id: categoryId, timeframe });
  await loadBoard();
  render();
}
async function swapCategories(aId, bId) {
  const a = state.board.categories.find(c => c.id === aId);
  const b = state.board.categories.find(c => c.id === bId);
  if (!a || !b) return;
  await Promise.all([
    api("PATCH", `/categories/${a.id}`, { sort_order: b.sort_order }),
    api("PATCH", `/categories/${b.id}`, { sort_order: a.sort_order }),
  ]);
  await loadBoard();
  render();
}

async function loadThenRender() {
  await loadBoard();
  render();
}

/* ========================================================================= */
/*  МОДАЛКА «ДОБАВИТЬ ЗАДАЧУ»                                                 */
/* ========================================================================= */

function overlay(child, onClose) {
  const ov = el("div", { class: "overlay" }, [child]);
  ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
  function close() { ov.remove(); document.removeEventListener("keydown", esc); onClose?.(); }
  function esc(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", esc);
  document.body.append(ov);
  return { close };
}

function openAddTask() {
  if (state.board.categories.length === 0) {
    toast("Сначала добавьте направление в настройках");
    return;
  }
  let timeframe = "today";

  const select = el("select", { class: "select" },
    state.board.categories.map(c =>
      el("option", { value: c.id, text: `${c.emoji || ""} ${c.name}`.trim() })));

  const seg = el("div", { class: "segmented" },
    TIMEFRAMES.map(tf => el("button", {
      class: tf.key === timeframe ? "active" : "", text: tf.label,
      onClick: (e) => {
        timeframe = tf.key;
        [...seg.children].forEach(b => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
      },
    })));

  const input = el("input", {
    class: "textinput", type: "text", placeholder: "Например, выпить 2л воды",
  });

  async function submit() {
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    await api("POST", "/cards", {
      title, category_id: Number(select.value), timeframe,
    });
    await loadBoard();
    render();                 // доска под модалкой обновляется
    input.value = "";         // модалка НЕ закрывается — можно кидать дальше
    input.focus();
    toast("Задача добавлена");
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

  const sheet = el("div", { class: "sheet" }, [
    el("div", { class: "sheet__head" }, [
      el("div", { class: "sheet__title", text: "Новая задача" }),
      el("button", { class: "sheet__close", html: "✕", onClick: () => ctl.close() }),
    ]),
    el("div", { class: "field" }, [
      el("label", { class: "field__label", text: "Направление" }), select,
    ]),
    el("div", { class: "field" }, [
      el("label", { class: "field__label", text: "Срок" }), seg,
    ]),
    el("div", { class: "field" }, [
      el("label", { class: "field__label", text: "Задача" }), input,
    ]),
    el("button", { class: "btn-primary", text: "Добавить", onClick: submit }),
  ]);

  const ctl = overlay(sheet);
  setTimeout(() => input.focus(), 50);
}

/* ========================================================================= */
/*  ЭКРАН НАСТРОЕК                                                            */
/* ========================================================================= */

function openSettings(scrollToId = null) {
  state.view = "settings";
  state.settingsScrollTo = scrollToId;
  render();
}

function renderSettings() {
  const screen = el("div", { class: "screen" });
  const wrap = el("div", { class: "settings" });

  if (state.board.categories.length === 0) {
    wrap.append(el("div", { class: "empty-hint",
      text: "Направлений пока нет — добавьте первое кнопкой ниже." }));
  } else {
    const list = el("div", { class: "settings__list" });
    for (const cat of [...state.board.categories].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)) {
      list.append(renderDirCard(cat));
    }
    wrap.append(list);
  }

  wrap.append(el("div", { class: "settings__footer" }, [
    el("button", {
      class: "add-dir-btn", html: ICON.plus + "<span>Добавить направление</span>",
      onClick: addDirection,
    }),
    el("button", { class: "nav-btn nav-btn--ghost", text: "Архив →",
      onClick: openArchive }),
  ]));

  screen.append(wrap);
  return screen;
}

function renderDirCard(cat) {
  const card = el("div", { class: "dir-card", id: "dir-" + cat.id });

  // --- обложка ---
  const cover = el("div", { class: "dir-cover" });
  if (cat.background_image) cover.style.backgroundImage = `url("${cat.background_image}")`;

  const emojiBtn = el("button", {
    class: "dir-emoji-btn", text: cat.emoji || "＋", title: "Выбрать эмодзи",
    onClick: () => openEmojiPicker(cat),
  });

  const nameInput = el("input", {
    class: "dir-name-input", type: "text", value: cat.name, placeholder: "Название",
  });
  const saveName = () => {
    const v = nameInput.value.trim();
    if (v && v !== cat.name) api("PATCH", `/categories/${cat.id}`, { name: v }).then(loadThenRenderSettings);
    else nameInput.value = cat.name;
  };
  nameInput.addEventListener("blur", saveName);
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.blur(); });

  const fileInput = el("input", {
    class: "hidden", type: "file", accept: "image/*",
    onChange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await fileToResizedDataURL(file);
        await api("PATCH", `/categories/${cat.id}`, { background_image: dataUrl });
        await loadBoard(); renderSettingsKeepScroll();
      } catch (err) { toast(err.message || "Не удалось загрузить"); }
    },
  });

  const tools = el("div", { class: "cover-tools" }, [
    el("button", { class: "cover-tool", text: cat.background_image ? "Заменить фон" : "Фон",
      onClick: () => fileInput.click() }),
    cat.background_image ? el("button", { class: "cover-tool danger", text: "Убрать",
      onClick: async () => {
        await api("PATCH", `/categories/${cat.id}`, { background_image: "" });
        await loadBoard(); renderSettingsKeepScroll();
      } }) : null,
  ]);

  cover.append(tools, el("div", { class: "dir-cover__row" }, [emojiBtn, nameInput]), fileInput);

  // --- тело: цели + действия ---
  const goals = state.board.goals
    .filter(g => g.category_id === cat.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const goalsWrap = el("div", { class: "dir-goals" },
    goals.map(g => renderGoalRow(g)));

  const body = el("div", { class: "dir-body" }, [
    goalsWrap,
    el("button", { class: "text-btn add-goal", text: "＋ Добавить цель",
      onClick: () => addGoal(cat.id) }),
    el("div", { class: "dir-actions" }, [
      el("button", { class: "text-btn danger", text: "В архив",
        onClick: () => archiveDirection(cat) }),
    ]),
  ]);

  card.append(cover, body);
  return card;
}

function renderGoalRow(goal) {
  const row = el("div", { class: "goal-row" + (goal.done ? " done" : "") });
  const input = el("input", { class: "goal-input", type: "text", value: goal.text });
  const save = () => {
    const v = input.value.trim();
    if (v && v !== goal.text) api("PATCH", `/goals/${goal.id}`, { text: v }).then(loadThenRenderSettings);
    else input.value = goal.text;
  };
  input.addEventListener("blur", save);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });

  row.append(
    checkbox(!!goal.done, "goal-check", async () => {
      await api("PATCH", `/goals/${goal.id}`, { done: !goal.done });
      await loadBoard(); renderSettingsKeepScroll();
    }),
    input,
    el("button", { class: "goal-del", html: ICON.trash, title: "Удалить цель",
      onClick: async () => {
        if (!confirm(`Удалить цель «${goal.text}»?`)) return;
        await api("DELETE", `/goals/${goal.id}`);
        await loadBoard(); renderSettingsKeepScroll();
      } }),
  );
  return row;
}

async function loadThenRenderSettings() {
  await loadBoard();
  renderSettingsKeepScroll();
}
// Перерисовать настройки, не дёргая скролл к началу.
function renderSettingsKeepScroll() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

async function addDirection() {
  const name = prompt("Название направления")?.trim();
  if (!name) return;
  const cat = await api("POST", "/categories", { name, emoji: "🎯" });
  await loadBoard();
  openSettings(cat.id);
}
async function addGoal(catId) {
  const text = prompt("Формулировка цели")?.trim();
  if (!text) return;
  await api("POST", `/categories/${catId}/goals`, { text });
  await loadBoard();
  renderSettingsKeepScroll();
}
async function archiveDirection(cat) {
  if (!confirm(`Отправить «${cat.name}» в архив? Его можно вернуть.`)) return;
  await api("DELETE", `/categories/${cat.id}`);
  await loadBoard();
  renderSettingsKeepScroll();
}

/* --------------------------------------------------- палитра эмодзи (popup) */

function openEmojiPicker(cat) {
  const grid = el("div", { class: "emoji-grid" },
    EMOJI_PALETTE.map(e => el("button", {
      class: e === cat.emoji ? "active" : "", text: e,
      onClick: async () => {
        ctl.close();
        await api("PATCH", `/categories/${cat.id}`, { emoji: e });
        await loadBoard();
        renderSettingsKeepScroll();
      },
    })));

  const sheet = el("div", { class: "sheet emoji-pop" }, [
    el("div", { class: "sheet__head" }, [
      el("div", { class: "sheet__title", text: "Эмодзи направления" }),
      el("button", { class: "sheet__close", html: "✕", onClick: () => ctl.close() }),
    ]),
    grid,
  ]);
  const ctl = overlay(sheet);
}

/* ========================================================================= */
/*  ЭКРАН АРХИВА                                                              */
/* ========================================================================= */

async function openArchive() {
  await loadArchive();
  state.view = "archive";
  render();
  window.scrollTo(0, 0);
}

function renderArchive() {
  const screen = el("div", { class: "screen" });
  const wrap = el("div", { class: "archive" });

  // --- направления в архиве ---
  const dirs = state.archive.categories;
  const dirBlock = el("div", { class: "arch-block" }, [
    el("h2", { class: "section-title", text: "Направления в архиве" }),
  ]);
  if (dirs.length === 0) {
    dirBlock.append(el("div", { class: "empty-hint", text: "Архив направлений пуст." }));
  } else {
    const list = el("div", { class: "arch-list" });
    for (const cat of dirs) {
      list.append(el("div", { class: "arch-row" }, [
        el("span", { class: "arch-row__emoji", text: cat.emoji || "📦" }),
        el("div", { class: "arch-row__body" }, [
          el("div", { class: "arch-row__title", text: cat.name }),
          el("div", { class: "arch-row__meta", text: "в архиве" }),
        ]),
        el("div", { class: "arch-row__actions" }, [
          el("button", { class: "icon-btn restore", title: "Восстановить",
            html: ICON.restore, onClick: () => restoreDirection(cat) }),
          el("button", { class: "icon-btn danger", title: "Удалить навсегда (со всеми задачами и целями)",
            html: ICON.trash, onClick: () => purgeDirection(cat) }),
        ]),
      ]));
    }
    dirBlock.append(list);
  }

  // --- все выполненные задачи ---
  const cards = state.archive.cards;
  const cardBlock = el("div", { class: "arch-block" }, [
    el("h2", { class: "section-title", text: "Все выполненные задачи" }),
  ]);
  if (cards.length === 0) {
    cardBlock.append(el("div", { class: "empty-hint", text: "Выполненных задач пока нет." }));
  } else {
    const list = el("div", { class: "arch-list" });
    for (const card of cards) {
      const done = parseUTC(card.done_at);
      const when = done ? done.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "";
      list.append(el("div", { class: "arch-row" }, [
        el("span", { class: "arch-row__emoji", text: card.category_emoji || "✓" }),
        el("div", { class: "arch-row__body" }, [
          el("div", { class: "arch-row__title", text: card.title }),
          el("div", { class: "arch-row__meta",
            text: [card.category_name, when && "выполнено " + when].filter(Boolean).join(" · ") }),
        ]),
        el("div", { class: "arch-row__actions" }, [
          el("button", { class: "icon-btn restore", title: "Вернуть в работу",
            html: ICON.restore, onClick: () => restoreCard(card) }),
          el("button", { class: "icon-btn danger", title: "Удалить навсегда",
            html: ICON.trash, onClick: () => purgeCard(card) }),
        ]),
      ]));
    }
    cardBlock.append(list);
  }

  wrap.append(dirBlock, cardBlock);
  screen.append(wrap);
  return screen;
}

async function restoreDirection(cat) {
  await api("POST", `/categories/${cat.id}/restore`);
  await Promise.all([loadArchive(), loadBoard()]);
  render();
}
async function purgeDirection(cat) {
  if (!confirm(`Удалить «${cat.name}» навсегда? Вместе с ним исчезнут все его задачи и цели. Отменить будет нельзя.`)) return;
  await api("DELETE", `/categories/${cat.id}/purge`);
  await Promise.all([loadArchive(), loadBoard()]);
  render();
}
async function restoreCard(card) {
  await api("PATCH", `/cards/${card.id}`, { done: false });
  await Promise.all([loadArchive(), loadBoard()]);
  render();
}
async function purgeCard(card) {
  if (!confirm(`Удалить задачу «${card.title}» навсегда?`)) return;
  await api("DELETE", `/cards/${card.id}`);
  await Promise.all([loadArchive(), loadBoard()]);
  render();
}

/* ========================================================================= */
/*  СТАРТ                                                                     */
/* ========================================================================= */

(async function init() {
  try {
    await loadBoard();
  } catch (_) {
    app.append(el("div", { class: "screen" }, [
      el("div", { class: "empty-hint", text: "Не удалось загрузить доску. Проверьте, что сервер запущен." }),
    ]));
    return;
  }
  render();
})();
