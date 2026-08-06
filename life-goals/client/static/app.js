const TIMEFRAMES = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "none", label: "Без срока" },
];
const EMOJI_PALETTE = [
  "❤️", "💪", "🏃", "🧘", "🥗", "😴", "🩺", "🚴",
  "💰", "📈", "💳", "🏦", "🪙", "📊", "🧾", "💎",
  "🇬🇧", "🗣️", "📚", "✍️", "🎧", "🌍", "📖", "🧠",
  "💼", "👔", "📅", "🖥️", "🤝", "🚀", "🎯", "⏰",
  "🏆", "⚽", "🏀", "🎾", "🏊", "🧗", "⛷️", "🥊",
  "🎤", "🎙️", "📣", "🎬", "🎭", "😃", "🙌", "👏",
  "🎨", "🎮", "🎸", "📷", "✈️", "🍳", "🌱", "🐶",
];

let state = { categories: [], cards: [], goals: [] };
let archiveData = null;

let modalOpen = false;
let modalCategoryId = null;
let modalTimeframe = "today";
let modalDraftText = "";

let settingsOpen = false;
let settingsFocusCategoryId = null;
let settingsScrollTop = 0;

let archiveOpen = false;

let draggedCategoryId = null;
let openEmojiPicker = null; // { el, catId, cleanup }

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Ошибка ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function fileToResizedDataUrl(file, maxDim = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function loadBoard() {
  state = await api("/api/board");
  if (modalCategoryId === null) modalCategoryId = state.categories[0]?.id ?? null;
  render();
}

function goalsFor(categoryId) {
  return state.goals
    .filter((g) => g.category_id === categoryId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function cardsFor(categoryId, timeframe) {
  return state.cards
    .filter((c) => c.category_id === categoryId && c.timeframe === timeframe && !c.done)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function trayCards() {
  return state.cards
    .filter((c) => c.done)
    .sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
}

// urgency tier: 0 = has a task today, 1 = has one this week (but not today), etc.
// vectors with nothing at all sink to the very end. Manual drag order (sort_order)
// only breaks ties within the same tier, so "today" always wins regardless of position.
function categoryTier(cat) {
  for (let i = 0; i < TIMEFRAMES.length; i++) {
    if (cardsFor(cat.id, TIMEFRAMES[i].key).length > 0) return i;
  }
  return TIMEFRAMES.length;
}

function boardOrderedCategories() {
  return [...state.categories].sort((a, b) => {
    const tierDiff = categoryTier(a) - categoryTier(b);
    return tierDiff !== 0 ? tierDiff : a.sort_order - b.sort_order;
  });
}

function el(tag, cls, attrs) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function setGridPos(node, row, col) {
  node.style.gridRow = String(row);
  node.style.gridColumn = String(col);
}

function render() {
  const prevSettingsList = document.querySelector(".settings-list");
  if (prevSettingsList) settingsScrollTop = prevSettingsList.scrollTop;

  const app = document.getElementById("app");
  app.innerHTML = "";

  const toolbar = el("div", "toolbar");
  const h1 = el("h1");
  h1.textContent = "Приоритеты";
  toolbar.append(h1);
  toolbar.append(el("div", "spacer"));
  const settingsBtn = el("button", "btn-toolbar");
  settingsBtn.innerHTML = '<span class="gear-icon">⚙️</span>Настройки';
  settingsBtn.addEventListener("click", () => {
    modalOpen = false;
    settingsOpen = true;
    settingsFocusCategoryId = null;
    render();
  });
  toolbar.append(settingsBtn);
  app.append(toolbar);

  const orderedCategories = boardOrderedCategories();

  const scroll = el("div", "board-scroll");
  const grid = el("div", "grid");
  grid.style.gridTemplateColumns = `160px repeat(${orderedCategories.length}, minmax(240px, 1fr))`;

  const corner = el("div", "corner");
  setGridPos(corner, 1, 1);
  grid.append(corner);
  orderedCategories.forEach((cat, i) => {
    const header = renderCategoryHeader(cat);
    setGridPos(header, 1, i + 2);
    grid.append(header);
  });

  let rowCursor = 2;
  TIMEFRAMES.forEach((tf) => {
    const rowIdx = rowCursor++;
    const label = el("div", "row-label");
    label.textContent = tf.label;
    setGridPos(label, rowIdx, 1);
    grid.append(label);
    orderedCategories.forEach((cat, i) => {
      const cell = renderCell(cat, tf.key);
      setGridPos(cell, rowIdx, i + 2);
      grid.append(cell);
    });
  });

  scroll.append(grid);
  app.append(scroll);

  const tray = renderCompletedTray();
  if (tray) app.append(tray);

  app.append(renderFab());
  if (modalOpen) app.append(renderModal());
  if (settingsOpen) app.append(renderSettingsModal());
  if (archiveOpen) app.append(renderArchiveModal());
}

function renderCategoryHeader(cat) {
  const header = el("div", `cat-header${cat.background_image ? " has-bg" : ""}`, { draggable: "true" });
  if (cat.background_image) header.style.backgroundImage = `url("${cat.background_image}")`;
  header.title = "Открыть настройки направления · перетащите, чтобы изменить порядок";

  header.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    draggedCategoryId = cat.id;
    e.dataTransfer.setData("application/x-category-id", String(cat.id));
    e.dataTransfer.effectAllowed = "move";
    header.classList.add("dragging");
  });
  header.addEventListener("dragend", () => header.classList.remove("dragging"));
  header.addEventListener("dragover", (e) => {
    if (draggedCategoryId === null || draggedCategoryId === cat.id) return;
    e.preventDefault();
    header.classList.add("drag-over");
  });
  header.addEventListener("dragleave", () => header.classList.remove("drag-over"));
  header.addEventListener("drop", (e) => {
    header.classList.remove("drag-over");
    if (draggedCategoryId === null || draggedCategoryId === cat.id) return;
    e.preventDefault();
    e.stopPropagation();
    onSwapCategories(draggedCategoryId, cat.id);
  });

  header.addEventListener("click", () => {
    modalOpen = false;
    settingsOpen = true;
    settingsFocusCategoryId = cat.id;
    render();
  });

  const titleRow = el("div", "cat-title-row");
  const emoji = el("div", "cat-icon");
  emoji.textContent = cat.emoji || "🏷️";
  titleRow.append(emoji);

  const name = el("div", "cat-name-display");
  name.textContent = cat.name;
  titleRow.append(name);
  header.append(titleRow);

  const activeGoals = goalsFor(cat.id).filter((g) => !g.done);
  if (activeGoals.length) {
    const goalWrap = el("div", "cat-goal-display");
    activeGoals.forEach((g) => {
      const line = el("div", "cat-goal-line");
      line.textContent = `🎯 ${g.text}`;
      goalWrap.append(line);
    });
    header.append(goalWrap);
  }

  return header;
}

function renderCell(cat, timeframe) {
  const cards = cardsFor(cat.id, timeframe);
  const cell = el("div", `cell${cards.length ? " has-cards" : ""}`, { "data-cat": cat.id, "data-tf": timeframe });

  cell.addEventListener("dragover", (e) => {
    e.preventDefault();
    cell.classList.add("drag-over");
  });
  cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
  cell.addEventListener("drop", (e) => {
    e.preventDefault();
    cell.classList.remove("drag-over");
    const cardId = Number(e.dataTransfer.getData("text/plain"));
    onDropCard(cardId, cat.id, timeframe);
  });

  cards.forEach((card) => cell.append(renderCard(card)));

  return cell;
}

function renderCard(card) {
  const node = el("div", "card", { draggable: "true", "data-id": card.id });

  node.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", String(card.id));
    node.classList.add("dragging");
  });
  node.addEventListener("dragend", () => node.classList.remove("dragging"));

  const check = el("button", "check-btn");
  check.title = "Отметить выполненным";
  check.addEventListener("click", (e) => {
    e.stopPropagation();
    onToggleDone(card);
  });
  node.append(check);

  const title = el("div", "card-title");
  title.contentEditable = "true";
  title.textContent = card.title;
  title.addEventListener("blur", () => onEditCardTitle(card, title.textContent));
  title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); title.blur(); }
  });
  node.append(title);

  const del = el("button", "icon-btn");
  del.textContent = "×";
  del.title = "Удалить";
  del.addEventListener("click", () => onDeleteCard(card));
  node.append(del);

  return node;
}

// ---------- completed-this-week tray ----------

function renderCompletedTray() {
  const cards = trayCards();
  if (!cards.length) return null;

  const wrap = el("div", "completed-tray");
  const header = el("div", "completed-tray-header");
  const title = el("div", "completed-tray-title");
  title.textContent = "Выполнено за неделю ";
  const count = el("span", "completed-tray-count");
  count.textContent = String(cards.length);
  title.append(count);
  header.append(title);
  const archiveLink = el("button", "completed-tray-archive-link");
  archiveLink.textContent = "Весь архив →";
  archiveLink.addEventListener("click", openArchive);
  header.append(archiveLink);
  wrap.append(header);

  const list = el("div", "completed-tray-list");
  cards.forEach((card) => list.append(renderTrayCard(card)));
  wrap.append(list);

  return wrap;
}

function renderTrayCard(card) {
  const cat = state.categories.find((c) => c.id === card.category_id);
  const row = el("div", "tray-card");

  const check = el("button", "check-btn is-done");
  check.textContent = "✓";
  check.title = "Вернуть в работу";
  check.addEventListener("click", () => onToggleDone(card));
  row.append(check);

  const catTag = el("span", "tray-card-cat");
  catTag.textContent = `${cat?.emoji || ""} ${cat?.name || ""}`.trim();
  row.append(catTag);

  const t = el("span", "tray-card-title");
  t.textContent = card.title;
  row.append(t);

  const del = el("button", "icon-btn");
  del.textContent = "×";
  del.title = "Удалить";
  del.addEventListener("click", () => onDeleteCard(card));
  row.append(del);

  return row;
}

// ---------- add-task FAB + modal ----------

function renderFab() {
  const fab = el("button", "fab-add");
  fab.textContent = "＋";
  fab.title = "Добавить задачу";
  fab.addEventListener("click", () => {
    settingsOpen = false;
    archiveOpen = false;
    modalOpen = true;
    render();
  });
  return fab;
}

function renderModal() {
  const overlay = el("div", "modal-overlay");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  const sheet = el("div", "modal-sheet");

  const header = el("div", "modal-header");
  const title = el("div", "modal-title");
  title.textContent = "Новая задача";
  header.append(title);
  const closeBtn = el("button", "icon-btn");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeModal);
  header.append(closeBtn);
  sheet.append(header);

  const fieldDir = el("div", "modal-field");
  fieldDir.append(makeLabel("Направление"));
  const select = el("select", "modal-select");
  state.categories.forEach((cat) => {
    const opt = el("option");
    opt.value = String(cat.id);
    opt.textContent = `${cat.emoji || ""} ${cat.name}`.trim();
    if (cat.id === modalCategoryId) opt.selected = true;
    select.append(opt);
  });
  select.addEventListener("change", () => {
    modalCategoryId = Number(select.value);
  });
  fieldDir.append(select);
  sheet.append(fieldDir);

  const fieldTf = el("div", "modal-field");
  fieldTf.append(makeLabel("Срок"));
  const segment = el("div", "segment");
  TIMEFRAMES.forEach((tf) => {
    const btn = el("button", `segment-btn${tf.key === modalTimeframe ? " is-active" : ""}`, { type: "button" });
    btn.textContent = tf.label;
    btn.addEventListener("click", () => {
      modalTimeframe = tf.key;
      render();
    });
    segment.append(btn);
  });
  fieldTf.append(segment);
  sheet.append(fieldTf);

  const fieldText = el("div", "modal-field");
  fieldText.append(makeLabel("Задача"));
  const input = el("input", "modal-input", { type: "text", placeholder: "Например, выпить 2л воды" });
  input.value = modalDraftText;
  input.addEventListener("input", () => {
    modalDraftText = input.value;
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submitModal(); }
  });
  fieldText.append(input);
  sheet.append(fieldText);

  const submitBtn = el("button", "modal-submit");
  submitBtn.textContent = "Добавить";
  submitBtn.addEventListener("click", submitModal);
  sheet.append(submitBtn);

  overlay.append(sheet);
  setTimeout(() => input.focus(), 0);
  return overlay;
}

function makeLabel(text) {
  const label = el("label", "modal-label");
  label.textContent = text;
  return label;
}

function closeModal() {
  modalOpen = false;
  render();
}

function submitModal() {
  const title = modalDraftText.trim();
  const categoryId = modalCategoryId ?? state.categories[0]?.id;
  if (!title || !categoryId) return;
  onAddCard(categoryId, modalTimeframe, title);
}

// ---------- settings modal ----------

function renderSettingsModal() {
  const overlay = el("div", "modal-overlay");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSettings();
  });

  const sheet = el("div", "modal-sheet modal-sheet-settings");

  const header = el("div", "modal-header");
  const title = el("div", "modal-title");
  title.textContent = "Направления";
  header.append(title);
  const closeBtn = el("button", "icon-btn");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeSettings);
  header.append(closeBtn);
  sheet.append(header);

  const list = el("div", "settings-list");
  state.categories.forEach((cat) => list.append(renderSettingsRow(cat)));
  sheet.append(list);

  const footer = el("div", "settings-footer");
  const addBtn = el("button", "settings-add-btn", { type: "button" });
  addBtn.innerHTML = '<span class="plus">＋</span>Добавить направление';
  addBtn.addEventListener("click", onAddCategory);
  footer.append(addBtn);

  const archiveBtn = el("button", "settings-archive-btn", { type: "button" });
  archiveBtn.textContent = "🗄 Архив";
  archiveBtn.addEventListener("click", () => {
    settingsOpen = false;
    openArchive();
  });
  footer.append(archiveBtn);
  sheet.append(footer);

  overlay.append(sheet);

  requestAnimationFrame(() => {
    list.scrollTop = settingsScrollTop;
    if (settingsFocusCategoryId !== null) {
      const rowEl = list.querySelector(`[data-settings-cat="${settingsFocusCategoryId}"]`);
      rowEl?.scrollIntoView({ block: "center" });
      settingsFocusCategoryId = null;
    }
  });

  return overlay;
}

function renderSettingsRow(cat) {
  const row = el("div", "settings-row", { "data-settings-cat": cat.id });

  const cover = el("div", `settings-cover${cat.background_image ? " has-image" : ""}`);
  if (cat.background_image) cover.style.backgroundImage = `url("${cat.background_image}")`;

  const delBtn = el("button", "settings-cover-del", { type: "button" });
  delBtn.textContent = "×";
  delBtn.title = "Переместить в архив";
  delBtn.addEventListener("click", () => onDeleteCategory(cat));
  cover.append(delBtn);

  const top = el("div", "settings-cover-top");
  const emojiBtn = el("button", "settings-emoji-btn", { type: "button" });
  emojiBtn.textContent = cat.emoji || "🏷️";
  emojiBtn.title = "Выбрать эмодзи";
  emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleEmojiPicker(cat, emojiBtn);
  });
  top.append(emojiBtn);

  const nameInput = el("input", "settings-name-input", { type: "text", placeholder: "Название" });
  nameInput.value = cat.name;
  nameInput.addEventListener("blur", () => onSettingsFieldChange(cat, "name", nameInput.value));
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.blur(); });
  top.append(nameInput);
  cover.append(top);

  const actions = el("div", "settings-cover-actions");
  const fileLabel = el("label", "settings-cover-btn");
  fileLabel.textContent = cat.background_image ? "Заменить фон" : "Добавить фон";
  const fileInput = el("input", "settings-file-input", { type: "file", accept: "image/*" });
  fileInput.addEventListener("change", () => onBackgroundFileChange(cat, fileInput));
  fileLabel.append(fileInput);
  actions.append(fileLabel);
  if (cat.background_image) {
    const removeBtn = el("button", "settings-cover-btn settings-cover-btn-remove", { type: "button" });
    removeBtn.textContent = "Убрать фон";
    removeBtn.addEventListener("click", () => onClearBackgroundImage(cat));
    actions.append(removeBtn);
  }
  cover.append(actions);
  row.append(cover);

  const goalsWrap = el("div", "settings-goals");
  goalsFor(cat.id).forEach((goal) => goalsWrap.append(renderSettingsGoalRow(goal)));
  const addGoalBtn = el("button", "settings-add-goal-btn", { type: "button" });
  addGoalBtn.innerHTML = '<span class="plus">＋</span>Добавить цель';
  addGoalBtn.addEventListener("click", () => onAddGoal(cat));
  goalsWrap.append(addGoalBtn);
  row.append(goalsWrap);

  return row;
}

function renderSettingsGoalRow(goal) {
  const wrap = el("div", `settings-goal-row${goal.done ? " is-done" : ""}`);

  const check = el("button", "check-btn");
  check.textContent = goal.done ? "✓" : "";
  check.title = goal.done ? "Снять отметку" : "Отметить достигнутой";
  check.addEventListener("click", () => onToggleGoalDone(goal));
  wrap.append(check);

  const input = el("input", "settings-goal-text-input", { type: "text" });
  input.value = goal.text;
  input.addEventListener("blur", () => onGoalTextChange(goal, input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  wrap.append(input);

  const del = el("button", "icon-btn");
  del.textContent = "×";
  del.title = "Удалить цель";
  del.addEventListener("click", () => onDeleteGoal(goal));
  wrap.append(del);

  return wrap;
}

function closeSettings() {
  settingsOpen = false;
  render();
}

// ---------- emoji picker popover ----------

function closeEmojiPicker() {
  if (!openEmojiPicker) return;
  openEmojiPicker.cleanup();
  openEmojiPicker.el.remove();
  openEmojiPicker = null;
}

function toggleEmojiPicker(cat, btnEl) {
  const wasOpenForThisCat = openEmojiPicker && openEmojiPicker.catId === cat.id;
  closeEmojiPicker();
  if (wasOpenForThisCat) return;

  const picker = el("div", "popover emoji-picker");
  EMOJI_PALETTE.forEach((e) => {
    const item = el("button", "emoji-picker-item", { type: "button" });
    item.textContent = e;
    item.addEventListener("click", () => {
      closeEmojiPicker();
      onSettingsFieldChange(cat, "emoji", e);
    });
    picker.append(item);
  });

  picker.style.visibility = "hidden";
  document.body.append(picker);

  requestAnimationFrame(() => {
    const rect = btnEl.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    let top = rect.bottom + 6;
    if (top + pickerRect.height > window.innerHeight - 8) top = rect.top - pickerRect.height - 6;
    let left = rect.left;
    if (left + pickerRect.width > window.innerWidth - 8) left = window.innerWidth - pickerRect.width - 8;
    picker.style.top = `${Math.max(8, top)}px`;
    picker.style.left = `${Math.max(8, left)}px`;
    picker.style.visibility = "visible";
  });

  const onDocClick = (e) => {
    if (!picker.contains(e.target) && e.target !== btnEl) closeEmojiPicker();
  };
  setTimeout(() => document.addEventListener("click", onDocClick), 0);

  openEmojiPicker = {
    el: picker,
    catId: cat.id,
    cleanup: () => document.removeEventListener("click", onDocClick),
  };
}

// ---------- archive modal ----------

async function openArchive() {
  modalOpen = false;
  settingsOpen = false;
  archiveOpen = true;
  render();
  archiveData = await api("/api/archive");
  render();
}

function closeArchive() {
  archiveOpen = false;
  render();
}

function renderArchiveModal() {
  const overlay = el("div", "modal-overlay");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeArchive();
  });

  const sheet = el("div", "modal-sheet modal-sheet-settings");

  const header = el("div", "modal-header");
  const title = el("div", "modal-title");
  title.textContent = "Архив";
  header.append(title);
  const closeBtn = el("button", "icon-btn");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeArchive);
  header.append(closeBtn);
  sheet.append(header);

  const body = el("div", "archive-body");

  if (!archiveData) {
    const loading = el("div", "archive-empty");
    loading.textContent = "Загрузка…";
    body.append(loading);
  } else {
    body.append(makeLabel("Направления"));
    if (!archiveData.categories.length) {
      const empty = el("div", "archive-empty");
      empty.textContent = "Пусто";
      body.append(empty);
    } else {
      archiveData.categories.forEach((cat) => body.append(renderArchiveCategoryRow(cat)));
    }

    const goalsLabel = makeLabel("Выполненные задачи");
    goalsLabel.style.marginTop = "16px";
    body.append(goalsLabel);
    if (!archiveData.cards.length) {
      const empty = el("div", "archive-empty");
      empty.textContent = "Пусто";
      body.append(empty);
    } else {
      archiveData.cards.forEach((card) => body.append(renderArchiveCardRow(card)));
    }
  }

  sheet.append(body);
  overlay.append(sheet);
  return overlay;
}

function renderArchiveCategoryRow(cat) {
  const row = el("div", "archive-row");
  const info = el("div", "archive-row-info");
  info.textContent = `${cat.emoji || "🏷️"} ${cat.name}`;
  row.append(info);

  const actions = el("div", "archive-row-actions");
  const restoreBtn = el("button", "archive-action-btn", { type: "button" });
  restoreBtn.textContent = "Восстановить";
  restoreBtn.addEventListener("click", () => onRestoreCategory(cat));
  actions.append(restoreBtn);

  const purgeBtn = el("button", "archive-action-btn archive-action-btn-danger", { type: "button" });
  purgeBtn.textContent = "Удалить навсегда";
  purgeBtn.addEventListener("click", () => onPurgeCategory(cat));
  actions.append(purgeBtn);

  row.append(actions);
  return row;
}

function renderArchiveCardRow(card) {
  const row = el("div", "archive-row");
  const info = el("div", "archive-row-info");
  const dateStr = card.done_at ? card.done_at.slice(0, 10) : "";
  info.textContent = `${card.category_emoji || ""} ${card.category_name || ""} — ${card.title} (${dateStr})`.trim();
  row.append(info);

  const actions = el("div", "archive-row-actions");
  const restoreBtn = el("button", "archive-action-btn", { type: "button" });
  restoreBtn.textContent = "Вернуть";
  restoreBtn.addEventListener("click", () => onRestoreCard(card));
  actions.append(restoreBtn);

  const purgeBtn = el("button", "archive-action-btn archive-action-btn-danger", { type: "button" });
  purgeBtn.textContent = "Удалить";
  purgeBtn.addEventListener("click", () => onPurgeCard(card));
  actions.append(purgeBtn);

  row.append(actions);
  return row;
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (openEmojiPicker) closeEmojiPicker();
  else if (archiveOpen) closeArchive();
  else if (settingsOpen) closeSettings();
  else if (modalOpen) closeModal();
});

// ---------- actions: categories ----------

async function onAddCategory() {
  const cat = await api("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name: "Новое направление", emoji: "🏷️" }),
  });
  state.categories.push(cat);
  settingsFocusCategoryId = cat.id;
  render();
}

async function onSwapCategories(draggedId, targetId) {
  const dragged = state.categories.find((c) => c.id === draggedId);
  const target = state.categories.find((c) => c.id === targetId);
  if (!dragged || !target) return;
  const draggedOrder = dragged.sort_order;
  const targetOrder = target.sort_order;
  const [updatedDragged, updatedTarget] = await Promise.all([
    api(`/api/categories/${dragged.id}`, { method: "PATCH", body: JSON.stringify({ sort_order: targetOrder }) }),
    api(`/api/categories/${target.id}`, { method: "PATCH", body: JSON.stringify({ sort_order: draggedOrder }) }),
  ]);
  Object.assign(dragged, updatedDragged);
  Object.assign(target, updatedTarget);
  state.categories.sort((a, b) => a.sort_order - b.sort_order);
  render();
}

async function onSettingsFieldChange(cat, field, rawValue) {
  const value = rawValue.trim();
  if (field === "name" && !value) { render(); return; }
  if (value === (cat[field] || "")) return;
  const updated = await api(`/api/categories/${cat.id}`, {
    method: "PATCH",
    body: JSON.stringify({ [field]: value }),
  });
  Object.assign(cat, updated);
  render();
}

async function onBackgroundFileChange(cat, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  let dataUrl;
  try {
    dataUrl = await fileToResizedDataUrl(file);
  } catch {
    alert("Не удалось загрузить изображение");
    return;
  }
  const updated = await api(`/api/categories/${cat.id}`, {
    method: "PATCH",
    body: JSON.stringify({ background_image: dataUrl }),
  });
  Object.assign(cat, updated);
  render();
}

async function onClearBackgroundImage(cat) {
  const updated = await api(`/api/categories/${cat.id}`, {
    method: "PATCH",
    body: JSON.stringify({ background_image: "" }),
  });
  Object.assign(cat, updated);
  render();
}

async function onDeleteCategory(cat) {
  if (!confirm(`Переместить «${cat.name}» в архив? Направление и его карточки можно будет восстановить.`)) return;
  await api(`/api/categories/${cat.id}`, { method: "DELETE" });
  state.categories = state.categories.filter((c) => c.id !== cat.id);
  state.cards = state.cards.filter((c) => c.category_id !== cat.id);
  state.goals = state.goals.filter((g) => g.category_id !== cat.id);
  if (modalCategoryId === cat.id) modalCategoryId = state.categories[0]?.id ?? null;
  render();
}

// ---------- actions: goals ----------

async function onAddGoal(cat) {
  const goal = await api(`/api/categories/${cat.id}/goals`, {
    method: "POST",
    body: JSON.stringify({ text: "Новая цель" }),
  });
  state.goals.push(goal);
  render();
  requestAnimationFrame(() => {
    const rowEl = document.querySelector(`[data-settings-cat="${cat.id}"] .settings-goals`);
    const inputs = rowEl?.querySelectorAll(".settings-goal-text-input");
    const last = inputs?.[inputs.length - 1];
    last?.focus();
    last?.select();
  });
}

async function onGoalTextChange(goal, text) {
  const value = text.trim();
  if (!value) { render(); return; }
  if (value === goal.text) return;
  const updated = await api(`/api/goals/${goal.id}`, {
    method: "PATCH",
    body: JSON.stringify({ text: value }),
  });
  Object.assign(goal, updated);
  render();
}

async function onToggleGoalDone(goal) {
  const updated = await api(`/api/goals/${goal.id}`, {
    method: "PATCH",
    body: JSON.stringify({ done: !goal.done }),
  });
  Object.assign(goal, updated);
  render();
}

async function onDeleteGoal(goal) {
  await api(`/api/goals/${goal.id}`, { method: "DELETE" });
  state.goals = state.goals.filter((g) => g.id !== goal.id);
  render();
}

// ---------- actions: cards ----------

async function onAddCard(categoryId, timeframe, title) {
  const card = await api("/api/cards", {
    method: "POST",
    body: JSON.stringify({ category_id: categoryId, timeframe, title }),
  });
  state.cards.push(card);
  modalDraftText = "";
  render();
}

async function onEditCardTitle(card, text) {
  const title = text.trim();
  if (!title || title === card.title) { render(); return; }
  const updated = await api(`/api/cards/${card.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
  Object.assign(card, updated);
  render();
}

async function onToggleDone(card) {
  const updated = await api(`/api/cards/${card.id}`, {
    method: "PATCH",
    body: JSON.stringify({ done: !card.done }),
  });
  Object.assign(card, updated);
  render();
}

async function onDeleteCard(card) {
  await api(`/api/cards/${card.id}`, { method: "DELETE" });
  state.cards = state.cards.filter((c) => c.id !== card.id);
  render();
}

async function onDropCard(cardId, categoryId, timeframe) {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return;
  if (card.category_id === categoryId && card.timeframe === timeframe) return;
  const updated = await api(`/api/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ category_id: categoryId, timeframe }),
  });
  Object.assign(card, updated);
  render();
}

// ---------- actions: archive ----------

async function onRestoreCategory(cat) {
  const updated = await api(`/api/categories/${cat.id}/restore`, { method: "POST" });
  archiveData.categories = archiveData.categories.filter((c) => c.id !== cat.id);
  state.categories.push(updated);
  state.categories.sort((a, b) => a.sort_order - b.sort_order);
  render();
}

async function onPurgeCategory(cat) {
  if (!confirm(`Удалить «${cat.name}» навсегда? Это действие нельзя отменить.`)) return;
  await api(`/api/categories/${cat.id}/purge`, { method: "DELETE" });
  archiveData.categories = archiveData.categories.filter((c) => c.id !== cat.id);
  render();
}

async function onRestoreCard(card) {
  const updated = await api(`/api/cards/${card.id}`, {
    method: "PATCH",
    body: JSON.stringify({ done: false }),
  });
  archiveData.cards = archiveData.cards.filter((c) => c.id !== card.id);
  const existing = state.cards.find((c) => c.id === updated.id);
  if (existing) Object.assign(existing, updated);
  else state.cards.push(updated);
  render();
}

async function onPurgeCard(card) {
  await api(`/api/cards/${card.id}`, { method: "DELETE" });
  archiveData.cards = archiveData.cards.filter((c) => c.id !== card.id);
  state.cards = state.cards.filter((c) => c.id !== card.id);
  render();
}

loadBoard();
