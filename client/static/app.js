const state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  view: "loading", // auth | acceptInvite | board
  viewMode: "kanban", // kanban | calendar
  authError: "",
  team: [],
  viewingUserId: null,
  tasks: [],
  archivedTasks: [],
  archiveOpen: false,
  calls: [],
  weekStart: null,
  draggingTaskId: null,
  modalTask: null, // null = closed, {} = new, {...} = edit
  modalCall: null,
  inviteToken: null,
  inviteInfo: null,
  inviteError: "",
  collapsedColumns: new Set(JSON.parse(localStorage.getItem("collapsedColumns") || "[]")),
  googleConnected: false,
  googleConfigured: false,
};

function svgIcon(inner, { filled = false } = {}) {
  const common = filled
    ? 'viewBox="0 0 24 24" fill="currentColor" stroke="none"'
    : 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg ${common}>${inner}</svg>`;
}

const STATUS_ORDER = ["ideas", "todo", "doing", "paused", "done"];
const STATUS_LABELS = { ideas: "Ідея", todo: "Зробити", doing: "В роботі", paused: "На паузі", done: "Виконано" };
const STATUS_ICONS = {
  ideas: svgIcon(`<path d="M12 3a6 6 0 0 0-3 11.2c.6.4 1 1.1 1 1.8v.5h4v-.5c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/><path d="M10 21h4"/>`),
  todo: svgIcon(`<circle cx="12" cy="12" r="7.5"/>`),
  doing: svgIcon(`<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.3 4.3l1.8 1.8M17.9 17.9l1.8 1.8M2.5 12h2.6M18.9 12h2.6M4.3 19.7l1.8-1.8M17.9 6.1l1.8-1.8"/>`),
  paused: svgIcon(`<rect x="8" y="6" width="3" height="12" rx="1"/><rect x="13" y="6" width="3" height="12" rx="1"/>`, { filled: true }),
  done: svgIcon(`<path d="M4 12.5l5 5L20 6"/>`),
};

const WEEK_COLUMN_ORDER = ["overdue", "today", "tomorrow", "week", "twoweeks"];
const WEEK_COLUMN_LABELS = {
  overdue: "Прострочені", today: "Сьогодні", tomorrow: "Завтра", week: "На тиждень", twoweeks: "На 2 тижні",
};
const WEEK_COLUMN_ICONS = {
  overdue: svgIcon(`<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.7v.01"/>`),
  today: svgIcon(`<circle cx="12" cy="12" r="5"/>`, { filled: true }),
  tomorrow: svgIcon(`<path d="M4.5 12h15M13 6l6 6-6 6"/>`),
  week: svgIcon(`<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`),
  twoweeks: svgIcon(`<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M3.5 15h17"/>`),
};
// Representative due_date assigned when a card is dropped into a column (no drop target for "overdue")
const WEEK_COLUMN_DROP_DATE = {
  today: () => todayStr(),
  tomorrow: () => addDays(todayStr(), 1),
  week: () => addDays(todayStr(), 2),
  twoweeks: () => addDays(todayStr(), 8),
};

const WEEKDAY_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];
const CALENDAR_HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08:00 - 20:00

const PRIORITY_ORDER = [5, 4, 3, 2, 1];
const PRIORITY_LABELS = { 5: "5 · Критичний", 4: "4 · Високий", 3: "3 · Середній", 2: "2 · Низький", 1: "1 · Немає" };
const PRIORITY_COLORS = { 5: "#dc2626", 4: "#c2185b", 3: "#f97316", 2: "#16a34a", 1: "#9ca3af" };

const PLANNED_MINUTES_ORDER = [5, 15, 30, 60, 90, 120, 180];
const PLANNED_MINUTES_LABELS = {
  5: "5хв", 15: "15хв", 30: "30хв", 60: "1 година", 90: "1,5 години", 120: "2 години", 180: "3 години",
};
const app = document.getElementById("app");

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

function setToken(token, user) {
  state.token = token;
  state.user = user;
  if (token) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- date helpers ----------

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function mondayOf(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay(); // 0 = sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

function todayStr() {
  return formatDate(new Date());
}

function formatDayLabel(dateStr) {
  const d = parseDate(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

// ---------- routing / bootstrap ----------

async function boot() {
  const params = new URLSearchParams(location.search);
  const inviteToken = params.get("invite");
  if (inviteToken) {
    state.inviteToken = inviteToken;
    state.view = "acceptInvite";
    try {
      const data = await api(`/api/invites/${inviteToken}`);
      state.inviteInfo = data.invite;
    } catch (e) {
      state.inviteError = e.message;
    }
    return render();
  }

  if (!state.token) {
    state.view = "auth";
    return render();
  }
  try {
    const data = await api("/api/auth/me");
    state.user = data.user;
    state.viewingUserId = data.user.id;
    state.weekStart = mondayOf(todayStr());
    if (data.user.is_admin) {
      const teamData = await api("/api/team");
      state.team = teamData.team;
    }
    state.view = "board";
    await loadBoard();
    await loadCalls();
    await loadGoogleStatus();
  } catch (e) {
    setToken(null, null);
    state.view = "auth";
  }

  const googleStatus = params.get("google_status");
  if (googleStatus) {
    history.replaceState(null, "", location.pathname);
    if (googleStatus === "connected") {
      alert("Google Calendar під'єднано.");
    } else {
      alert("Не вдалося під'єднати Google Calendar. Спробуйте ще раз.");
    }
  }

  render();
}

async function loadGoogleStatus() {
  try {
    const data = await api("/api/google/status");
    state.googleConnected = data.connected;
    state.googleConfigured = data.configured;
  } catch (e) {
    state.googleConnected = false;
  }
}

async function loadBoard() {
  const data = await api(`/api/board?user_id=${state.viewingUserId}`);
  state.tasks = data.tasks;
}

async function loadArchived() {
  const data = await api(`/api/board/archived?user_id=${state.viewingUserId}`);
  state.archivedTasks = data.tasks;
}

async function loadCalls() {
  const weekEnd = addDays(state.weekStart, 6);
  const data = await api(`/api/calls?user_id=${state.viewingUserId}&week_start=${state.weekStart}&week_end=${weekEnd}`);
  state.calls = data.calls;
}

async function switchViewingUser(userId) {
  state.viewingUserId = userId;
  state.archiveOpen = false;
  await loadBoard();
  await loadCalls();
  render();
}

// ---------- render dispatch ----------

function render() {
  app.innerHTML = "";
  if (state.view === "loading") {
    app.appendChild(el(`<div class="center-screen">Завантаження…</div>`));
    return;
  }
  if (state.view === "auth") {
    app.appendChild(renderAuth());
    return;
  }
  if (state.view === "acceptInvite") {
    app.appendChild(renderAcceptInvite());
    return;
  }
  app.appendChild(renderTopbar());
  app.appendChild(
    state.viewMode === "calendar" ? renderCalendar() :
    state.viewMode === "week" ? renderWeekBoard() :
    renderBoard()
  );
  if (state.modalTask !== null) {
    app.appendChild(renderTaskModal());
  }
  if (state.modalCall !== null) {
    app.appendChild(renderCallModal());
  }
}

// ---------- auth view ----------

function renderAuth() {
  const wrap = el(`
    <div class="center-screen">
      <div class="auth-card">
        <h1>top superfoods</h1>
        <p class="sub">Увійдіть у свій акаунт</p>
        ${state.authError ? `<div class="error-box">${escapeHtml(state.authError)}</div>` : ""}
        <form id="auth-form">
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" placeholder="you@team.com" required />
          </div>
          <div class="field">
            <label>Пароль</label>
            <input name="password" type="password" placeholder="Пароль" required />
          </div>
          <button class="btn" type="submit" style="width:100%">Увійти</button>
        </form>
        <div class="switch-line">
          Немає акаунта? Зверніться до адміністратора команди — він надішле запрошення на вашу пошту.
        </div>
      </div>
    </div>
  `);

  wrap.querySelector("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setToken(data.token, data.user);
      state.authError = "";
      await boot();
      return;
    } catch (err) {
      state.authError = err.message;
      render();
    }
  });

  return wrap;
}

// ---------- accept invite view ----------

function renderAcceptInvite() {
  if (!state.inviteInfo) {
    return el(`
      <div class="center-screen">
        <div class="auth-card">
          <h1>top superfoods</h1>
          <div class="error-box">${escapeHtml(state.inviteError || "Запрошення недійсне або вже використане")}</div>
          <div class="switch-line"><a href="/">На головну</a></div>
        </div>
      </div>
    `);
  }

  const info = state.inviteInfo;
  const wrap = el(`
    <div class="center-screen">
      <div class="auth-card">
        <h1>top superfoods</h1>
        <p class="sub">${escapeHtml(info.inviter_name)} запросив(ла) вас до команди</p>
        ${state.authError ? `<div class="error-box">${escapeHtml(state.authError)}</div>` : ""}
        <form id="accept-form">
          <div class="field">
            <label>Ім'я</label>
            <input value="${escapeHtml(info.name)}" disabled />
          </div>
          <div class="field">
            <label>Email</label>
            <input value="${escapeHtml(info.email)}" disabled />
          </div>
          <div class="field">
            <label>Пароль</label>
            <input name="password" type="password" placeholder="Мінімум 8 символів, 1 велика літера, 1 спецсимвол" required minlength="8" />
          </div>
          <div class="field">
            <label>Повторіть пароль</label>
            <input name="password_confirm" type="password" placeholder="Ще раз той самий пароль" required minlength="8" />
          </div>
          <button class="btn" type="submit" style="width:100%">Створити акаунт і увійти</button>
        </form>
      </div>
    </div>
  `);

  wrap.querySelector("#accept-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());

    const passwordRules = /^(?=.*[A-ZА-ЯІЇЄ])(?=.*[^A-Za-zА-Яа-яІіЇїЄє0-9]).{8,}$/;
    if (!passwordRules.test(payload.password)) {
      state.authError = "Пароль має містити мінімум 8 символів, 1 велику літеру і 1 спецсимвол";
      render();
      return;
    }
    if (payload.password !== payload.password_confirm) {
      state.authError = "Паролі не збігаються";
      render();
      return;
    }

    try {
      const data = await api(`/api/invites/${state.inviteToken}/accept`, {
        method: "POST",
        body: JSON.stringify({ password: payload.password }),
      });
      setToken(data.token, data.user);
      state.authError = "";
      history.replaceState(null, "", "/");
      await boot();
    } catch (err) {
      state.authError = err.message;
      render();
    }
  });

  return wrap;
}

// ---------- topbar ----------

function renderTopbar() {
  const viewingSelf = state.viewingUserId === state.user.id;
  const bar = el(`
    <div class="topbar">
      <div class="brand" id="brand">🥑 top superfoods</div>
      <div class="topbar-center">
        ${state.user.is_admin ? `<div class="team-switcher" id="team-switcher"></div>` : ""}
        <div class="view-toggle">
          <button class="toggle-btn ${state.viewMode === "kanban" ? "active" : ""}" id="mode-kanban">Канбан</button>
          <button class="toggle-btn ${state.viewMode === "week" ? "active" : ""}" id="mode-week">Тиждень</button>
          <button class="toggle-btn ${state.viewMode === "calendar" ? "active" : ""}" id="mode-calendar">Календар</button>
        </div>
      </div>
      <div class="user-info">
        ${state.googleConnected
          ? `<button class="btn secondary google-btn connected" id="google-btn" title="Від'єднати Google Calendar">📅 Google ✓</button>`
          : `<button class="btn secondary google-btn" id="google-btn" title="Під'єднати Google Calendar">📅 Google Calendar</button>`}
        ${state.user.is_admin ? `<button class="btn secondary" id="invite-btn">+ Запросити</button>` : ""}
        <span>${escapeHtml(state.user.name)}${viewingSelf ? "" : ` · перегляд: ${escapeHtml(nameForUser(state.viewingUserId))}`}</span>
        <button class="btn secondary" id="logout-btn">Вийти</button>
      </div>
    </div>
  `);

  bar.querySelector("#brand").addEventListener("click", async () => {
    state.viewMode = "kanban";
    await switchViewingUser(state.user.id);
  });
  bar.querySelector("#mode-kanban").addEventListener("click", () => {
    state.viewMode = "kanban";
    render();
  });
  bar.querySelector("#mode-week").addEventListener("click", () => {
    state.viewMode = "week";
    render();
  });
  bar.querySelector("#mode-calendar").addEventListener("click", () => {
    state.viewMode = "calendar";
    render();
  });
  const inviteBtn = bar.querySelector("#invite-btn");
  if (inviteBtn) inviteBtn.addEventListener("click", () => openInviteModal());
  bar.querySelector("#google-btn").addEventListener("click", async () => {
    if (state.googleConnected) {
      if (!confirm("Від'єднати Google Calendar?")) return;
      await api("/api/google/disconnect", { method: "POST" });
      state.googleConnected = false;
      render();
    } else {
      window.location.href = `/api/google/connect?token=${encodeURIComponent(state.token)}`;
    }
  });
  bar.querySelector("#logout-btn").addEventListener("click", () => {
    setToken(null, null);
    state.view = "auth";
    render();
  });

  const switcher = bar.querySelector("#team-switcher");
  if (switcher) {
    const people = [{ id: state.user.id, name: state.user.name }, ...state.team];
    for (const p of people) {
      const chip = el(`<span class="member-chip switcher-chip ${p.id === state.viewingUserId ? "active" : ""}">${escapeHtml(p.name)}</span>`);
      chip.addEventListener("click", () => switchViewingUser(p.id));
      switcher.appendChild(chip);
    }
  }

  return bar;
}

function nameForUser(userId) {
  if (userId === state.user.id) return state.user.name;
  const m = state.team.find((t) => t.id === userId);
  return m ? m.name : "?";
}

// ---------- invite modal ----------

function openInviteModal() {
  const backdrop = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <button type="button" class="modal-close" id="modal-close-x" title="Закрити">×</button>
        <h3>Запросити учасника</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-top:-10px">
          Введіть ім'я та email — учаснику надішлють лист із запрошенням створити пароль.
        </p>
        <div class="error-box" style="display:none"></div>
        <form>
          <div class="field">
            <label>Ім'я</label>
            <input name="name" required placeholder="Іван Іваненко" />
          </div>
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" required placeholder="colleague@topsuperfoods.com" />
          </div>
          <div class="modal-actions">
            <div class="right">
              <button type="button" class="btn secondary" id="cancel">Скасувати</button>
              <button type="submit" class="btn">Запросити</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.querySelector("#cancel").addEventListener("click", () => backdrop.remove());
  backdrop.querySelector("#modal-close-x").addEventListener("click", () => backdrop.remove());
  backdrop.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const errBox = backdrop.querySelector(".error-box");
    try {
      await api("/api/invites", { method: "POST", body: JSON.stringify(payload) });
      backdrop.remove();
      alert("Запрошення надіслано на пошту.");
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = "block";
    }
  });
  app.appendChild(backdrop);
}

// ---------- kanban board ----------

function renderBoard() {
  const viewingSelf = state.viewingUserId === state.user.id;
  const wrap = el(`
    <div class="page">
      <div class="page-header">
        <h2>${viewingSelf ? "Моя дошка" : `Дошка: ${escapeHtml(nameForUser(state.viewingUserId))}`}</h2>
      </div>
      <div class="board-actions">
        <button class="btn" id="add-task-btn">+ Додати задачу</button>
        <button class="btn secondary" id="archive-btn">Архів (${state.archivedTasks.length || "…"})</button>
      </div>
      <div class="archive-panel" id="archive-panel" style="display:none"></div>
      <div class="board-columns"></div>
    </div>
  `);

  wrap.querySelector("#add-task-btn").addEventListener("click", () => {
    state.modalTask = { status: "ideas", owner_id: state.viewingUserId };
    render();
  });

  const archiveBtn = wrap.querySelector("#archive-btn");
  const archivePanel = wrap.querySelector("#archive-panel");
  archiveBtn.addEventListener("click", async () => {
    state.archiveOpen = !state.archiveOpen;
    if (state.archiveOpen) {
      await loadArchived();
    }
    render();
  });
  if (state.archiveOpen) {
    archivePanel.style.display = "block";
    archivePanel.appendChild(renderArchivePanel());
  }

  const columns = wrap.querySelector(".board-columns");
  for (const status of STATUS_ORDER) {
    columns.appendChild(renderColumn(status));
  }
  return wrap;
}

function renderArchivePanel() {
  const box = el(`<div class="archive-box"></div>`);
  if (state.archivedTasks.length === 0) {
    box.appendChild(el(`<p class="archive-empty">Немає архівованих завдань. Завдання зі статусом «Виконано» потрапляють сюди через ${7} днів.</p>`));
    return box;
  }
  for (const t of state.archivedTasks) {
    const item = el(`
      <div class="archive-item">
        <span>${escapeHtml(t.title)}</span>
        <span class="archive-meta">виконано ${escapeHtml((t.done_at || "").slice(0, 10))}<button class="icon-btn" data-id="${t.id}">Відновити</button></span>
      </div>
    `);
    item.querySelector("button").addEventListener("click", async () => {
      await api(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ status: "todo" }) });
      await loadBoard();
      await loadArchived();
      render();
    });
    box.appendChild(item);
  }
  return box;
}

function isOverdue(task) {
  if (!task.due_date || task.status === "done") return false;
  return task.due_date < todayStr();
}

function overdueDays(task) {
  if (!isOverdue(task)) return 0;
  const diffMs = parseDate(todayStr()) - parseDate(task.due_date);
  return Math.round(diffMs / 86400000);
}

function initials(name) {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}

function formatShortDate(dateStr) {
  const d = parseDate(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderColumn(status) {
  const tasks = state.tasks
    .filter((t) => t.status === status)
    .sort((a, b) => a.position - b.position);

  const isCollapsed = state.collapsedColumns.has(status);

  const col = el(`
    <div class="column ${isCollapsed ? "collapsed" : ""}">
      <div class="column-head">
        <div class="column-head-left">
          <button class="collapse-btn" title="Згорнути/розгорнути">${isCollapsed ? "›" : "⌄"}</button>
          <span class="column-icon">${STATUS_ICONS[status] || ""}</span>
          <span class="column-label">${STATUS_LABELS[status]}</span>
        </div>
        <div class="column-head-right">
          <span class="count">${tasks.length}</span>
          <button class="column-head-add" title="Нове завдання">+</button>
        </div>
      </div>
      <div class="column-body" data-status="${status}"></div>
    </div>
  `);

  const body = col.querySelector(".column-body");
  for (const task of tasks) {
    body.appendChild(renderTaskCard(task));
  }

  col.querySelector(".collapse-btn").addEventListener("click", () => {
    if (state.collapsedColumns.has(status)) {
      state.collapsedColumns.delete(status);
    } else {
      state.collapsedColumns.add(status);
    }
    localStorage.setItem("collapsedColumns", JSON.stringify([...state.collapsedColumns]));
    render();
  });

  col.querySelector(".column-head-add").addEventListener("click", () => {
    state.modalTask = { status, owner_id: state.viewingUserId };
    render();
  });

  body.addEventListener("dragover", (e) => {
    e.preventDefault();
    body.classList.add("drag-over");
  });
  body.addEventListener("dragleave", () => body.classList.remove("drag-over"));
  body.addEventListener("drop", async (e) => {
    e.preventDefault();
    body.classList.remove("drag-over");
    const taskId = state.draggingTaskId;
    if (taskId == null) return;
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = body.dataset.status;
    const siblingCount = state.tasks.filter((t) => t.status === newStatus && t.id !== taskId).length;
    task.status = newStatus;
    task.position = siblingCount;
    render();
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, position: siblingCount }),
      });
    } catch (err) {
      alert("Не вдалося оновити завдання: " + err.message);
      await loadBoard();
      render();
    }
  });

  return col;
}

function renderTaskCard(task) {
  const ownerName = nameForUser(task.owner_id);
  const overdue = isOverdue(task);
  const days = overdueDays(task);
  const priority = task.priority || 3;
  const card = el(`
    <div class="task-card" draggable="true">
      <div class="task-card-top">
        <span class="priority-badge" style="background:${PRIORITY_COLORS[priority] || PRIORITY_COLORS[3]}" title="${escapeHtml(PRIORITY_LABELS[priority] || "")}">${priority}</span>
        <h4>${escapeHtml(task.title)}</h4>
        <span class="avatar-mini" title="${escapeHtml(ownerName)}">${escapeHtml(initials(ownerName))}</span>
      </div>
      <div class="meta">
        ${task.planned_minutes ? `<span class="planned">${escapeHtml(PLANNED_MINUTES_LABELS[task.planned_minutes] || "")}</span>` : ""}
        ${task.due_date ? `<span class="due ${overdue ? "overdue" : ""}" title="${overdue ? escapeHtml(`Протерміновано на ${days} дн.`) : ""}">${escapeHtml(formatShortDate(task.due_date))}</span>` : ""}
      </div>
    </div>
  `);
  card.addEventListener("dragstart", () => {
    state.draggingTaskId = task.id;
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    state.draggingTaskId = null;
  });
  card.addEventListener("click", () => {
    state.modalTask = { ...task };
    render();
  });
  return card;
}

// ---------- week board ----------

function weekBucketForTask(task) {
  if (task.status === "ideas" || task.status === "done" || !task.due_date) return null;
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const twoWeekEnd = addDays(today, 14);
  if (task.due_date < today) return "overdue";
  if (task.due_date === today) return "today";
  if (task.due_date === tomorrow) return "tomorrow";
  if (task.due_date <= weekEnd) return "week";
  if (task.due_date <= twoWeekEnd) return "twoweeks";
  return null;
}

function renderWeekBoard() {
  const viewingSelf = state.viewingUserId === state.user.id;
  const wrap = el(`
    <div class="page">
      <div class="page-header">
        <h2>${viewingSelf ? "Мій тиждень" : `Тиждень: ${escapeHtml(nameForUser(state.viewingUserId))}`}</h2>
      </div>
      <div class="board-actions">
        <button class="btn" id="add-task-btn">+ Додати задачу</button>
      </div>
      <div class="board-columns"></div>
    </div>
  `);

  wrap.querySelector("#add-task-btn").addEventListener("click", () => {
    state.modalTask = { status: "todo", due_date: todayStr(), owner_id: state.viewingUserId };
    render();
  });

  const columns = wrap.querySelector(".board-columns");
  for (const bucket of WEEK_COLUMN_ORDER) {
    columns.appendChild(renderWeekColumn(bucket));
  }
  return wrap;
}

function renderWeekColumn(bucket) {
  const tasks = state.tasks
    .filter((t) => weekBucketForTask(t) === bucket)
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));

  const isCollapsed = state.collapsedColumns.has(`week_${bucket}`);

  const col = el(`
    <div class="column ${isCollapsed ? "collapsed" : ""}">
      <div class="column-head">
        <div class="column-head-left">
          <button class="collapse-btn" title="Згорнути/розгорнути">${isCollapsed ? "›" : "⌄"}</button>
          <span class="column-icon">${WEEK_COLUMN_ICONS[bucket] || ""}</span>
          <span class="column-label">${WEEK_COLUMN_LABELS[bucket]}</span>
        </div>
        <div class="column-head-right">
          <span class="count">${tasks.length}</span>
          <button class="column-head-add" title="Нове завдання">+</button>
        </div>
      </div>
      <div class="column-body" data-bucket="${bucket}"></div>
    </div>
  `);

  const body = col.querySelector(".column-body");
  for (const task of tasks) {
    body.appendChild(renderTaskCard(task));
  }

  col.querySelector(".collapse-btn").addEventListener("click", () => {
    const key = `week_${bucket}`;
    if (state.collapsedColumns.has(key)) {
      state.collapsedColumns.delete(key);
    } else {
      state.collapsedColumns.add(key);
    }
    localStorage.setItem("collapsedColumns", JSON.stringify([...state.collapsedColumns]));
    render();
  });

  col.querySelector(".column-head-add").addEventListener("click", () => {
    const dropDate = WEEK_COLUMN_DROP_DATE[bucket] ? WEEK_COLUMN_DROP_DATE[bucket]() : todayStr();
    state.modalTask = { status: "todo", due_date: dropDate, owner_id: state.viewingUserId };
    render();
  });

  const dropDate = WEEK_COLUMN_DROP_DATE[bucket];
  if (dropDate) {
    body.addEventListener("dragover", (e) => {
      e.preventDefault();
      body.classList.add("drag-over");
    });
    body.addEventListener("dragleave", () => body.classList.remove("drag-over"));
    body.addEventListener("drop", async (e) => {
      e.preventDefault();
      body.classList.remove("drag-over");
      const taskId = state.draggingTaskId;
      if (taskId == null) return;
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;
      const newDate = dropDate();
      task.due_date = newDate;
      render();
      try {
        await api(`/api/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify({ due_date: newDate }),
        });
      } catch (err) {
        alert("Не вдалося оновити завдання: " + err.message);
        await loadBoard();
        render();
      }
    });
  }

  return col;
}

// ---------- day availability (mini calendar) ----------

const AVAIL_START_HOUR = 9;
const AVAIL_END_HOUR = 20;

function timeToPercentRange(hhmm, startHour, endHour) {
  const [h, m] = hhmm.split(":").map(Number);
  const minutesFromStart = (h - startHour) * 60 + m;
  const total = (endHour - startHour) * 60;
  return Math.min(100, Math.max(0, (minutesFromStart / total) * 100));
}

function renderAvailabilityTrack(container, busy, startTimeInput) {
  const totalMinutes = (AVAIL_END_HOUR - AVAIL_START_HOUR) * 60;
  container.innerHTML = `
    <div class="avail-label">Зайнятість на цей день — оберіть вільний час:</div>
    <div class="avail-track"></div>
  `;
  const track = container.querySelector(".avail-track");

  for (let h = AVAIL_START_HOUR; h <= AVAIL_END_HOUR; h++) {
    const top = ((h - AVAIL_START_HOUR) * 60 / totalMinutes) * 100;
    track.appendChild(el(`<div class="avail-hour-line" style="top:${top}%"><span>${String(h).padStart(2, "0")}:00</span></div>`));
  }

  for (const b of busy) {
    const top = timeToPercentRange(b.start_time, AVAIL_START_HOUR, AVAIL_END_HOUR);
    const bottom = timeToPercentRange(b.end_time, AVAIL_START_HOUR, AVAIL_END_HOUR);
    track.appendChild(el(`
      <div class="avail-busy-block" style="top:${top}%;height:${Math.max(bottom - top, 2)}%" title="${escapeHtml(b.title)} (${b.start_time}–${b.end_time})">
        <span>${escapeHtml(b.title)}</span>
      </div>
    `));
  }

  function drawMarker() {
    const existing = track.querySelector(".avail-selected-marker");
    if (existing) existing.remove();
    if (startTimeInput.value) {
      const top = timeToPercentRange(startTimeInput.value, AVAIL_START_HOUR, AVAIL_END_HOUR);
      track.appendChild(el(`<div class="avail-selected-marker" style="top:${top}%"></div>`));
    }
  }
  drawMarker();

  track.addEventListener("click", (e) => {
    if (e.target.closest(".avail-busy-block")) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    let minutes = Math.round((ratio * totalMinutes) / 15) * 15;
    minutes = Math.min(totalMinutes, Math.max(0, minutes));
    const hour = AVAIL_START_HOUR + Math.floor(minutes / 60);
    const min = minutes % 60;
    startTimeInput.value = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    drawMarker();
  });
}

// ---------- task modal ----------

function renderTaskModal() {
  const task = state.modalTask;
  const isNew = !task.id;
  const currentOwner = task.owner_id != null ? task.owner_id : state.viewingUserId;
  const assigneeOptions = [{ id: state.user.id, name: state.user.name }, ...state.team];

  const backdrop = el(`
    <div class="modal-backdrop">
      <div class="modal-flex">
        <div class="modal">
          <button type="button" class="modal-close" id="modal-close-x" title="Закрити">×</button>
          <h3>${isNew ? "Нова задача" : "Завдання"}</h3>
          <div class="error-box" style="display:none"></div>
          <form>
            <div class="field">
              <label>Назва</label>
              <input name="title" required value="${escapeHtml(task.title || "")}" />
            </div>
            <div class="field">
              <label>Опис</label>
              <textarea name="description" rows="3">${escapeHtml(task.description || "")}</textarea>
            </div>
            <div class="field">
              <label>Статус</label>
              <div class="tab-group" data-field="status">
                ${STATUS_ORDER.map((v) => `<button type="button" class="tab-btn ${task.status === v ? "active" : ""}" data-value="${v}">${STATUS_LABELS[v]}</button>`).join("")}
              </div>
              <input type="hidden" name="status" value="${task.status || "ideas"}" />
            </div>
            <div class="field">
              <label>Пріоритет</label>
              <div class="tab-group" data-field="priority">
                ${PRIORITY_ORDER.map((v) => `<button type="button" class="tab-btn priority-tab ${(task.priority || 3) === v ? "active" : ""}" data-value="${v}" style="--tab-color:${PRIORITY_COLORS[v]}">${v}</button>`).join("")}
              </div>
              <input type="hidden" name="priority" value="${task.priority || 3}" />
            </div>
            <div class="row">
              <div class="field">
                <label>Час початку</label>
                <div class="row">
                  <input name="start_date" type="date" value="${task.start_date || ""}" />
                  <input name="start_time" type="time" min="09:00" max="20:00" value="${task.start_time || ""}" />
                </div>
              </div>
              <div class="field">
                <label>Дедлайн</label>
                <input name="due_date" type="date" value="${task.due_date || ""}" />
              </div>
            </div>
            <div class="field">
              <label>План по часу</label>
              <div class="tab-group" data-field="planned_minutes">
                ${PLANNED_MINUTES_ORDER.map((v) => `<button type="button" class="tab-btn ${(task.planned_minutes || 5) === v ? "active" : ""}" data-value="${v}">${PLANNED_MINUTES_LABELS[v]}</button>`).join("")}
              </div>
              <input type="hidden" name="planned_minutes" value="${task.planned_minutes || 5}" />
            </div>
            ${state.user.is_admin ? `
            <div class="field">
              <label>Виконавець</label>
              <select name="user_id">
                ${assigneeOptions.map((a) => `<option value="${a.id}" ${currentOwner === a.id ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("")}
              </select>
            </div>` : ""}
            <div class="modal-actions">
              ${isNew ? "" : `<button type="button" class="btn danger" id="delete-btn">Видалити</button>`}
              <div class="right">
                <button type="button" class="btn secondary" id="cancel">Скасувати</button>
                <button type="submit" class="btn">${isNew ? "Створити" : "Зберегти"}</button>
              </div>
            </div>
          </form>
        </div>
        <div class="gcal-panel" id="gcal-panel" style="display:none">
          <div class="gcal-panel-head">
            <span>${state.googleConnected ? "📅 Google Calendar" : "📅 Зайнятість"}</span>
          </div>
          <div class="gcal-panel-body" id="day-availability"></div>
        </div>
      </div>
    </div>
  `);

  const close = () => {
    state.modalTask = null;
    render();
  };

  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("#cancel").addEventListener("click", close);
  backdrop.querySelector("#modal-close-x").addEventListener("click", close);

  backdrop.querySelectorAll(".tab-group").forEach((group) => {
    const hidden = group.parentElement.querySelector("input[type=hidden]");
    group.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        hidden.value = btn.dataset.value;
      });
    });
  });

  const gcalPanel = backdrop.querySelector("#gcal-panel");
  const availabilityPanel = backdrop.querySelector("#day-availability");
  const startDateInput = backdrop.querySelector("input[name=start_date]");
  const startTimeInput = backdrop.querySelector("input[name=start_time]");

  async function refreshAvailability() {
    const dateVal = startDateInput.value;
    if (!dateVal) {
      gcalPanel.style.display = "none";
      return;
    }
    const assigneeSelect = backdrop.querySelector("select[name=user_id]");
    const ownerId = assigneeSelect ? Number(assigneeSelect.value) : currentOwner;
    gcalPanel.style.display = "block";
    availabilityPanel.innerHTML = `<div class="avail-loading">Завантаження зайнятості…</div>`;
    try {
      if (state.googleConnected) {
        const data = await api(`/api/google/busy?user_id=${ownerId}&date=${dateVal}`);
        gcalPanel.querySelector(".gcal-panel-head span").textContent = "📅 Google Calendar";
        renderAvailabilityTrack(availabilityPanel, data.busy, startTimeInput);
      } else {
        const params = new URLSearchParams({ user_id: ownerId, date: dateVal });
        if (!isNew) params.set("exclude_task_id", task.id);
        const data = await api(`/api/availability?${params.toString()}`);
        gcalPanel.querySelector(".gcal-panel-head span").textContent = "📅 Зайнятість (внутрішня)";
        renderAvailabilityTrack(availabilityPanel, data.busy, startTimeInput);
        availabilityPanel.insertAdjacentHTML(
          "beforeend",
          `<div class="avail-connect-hint">Підключіть Google Calendar у шапці, щоб бачити реальну зайнятість і синхронізувати задачі.</div>`
        );
      }
    } catch (err) {
      availabilityPanel.innerHTML = `<div class="avail-loading">Не вдалося завантажити зайнятість</div>`;
    }
  }

  startDateInput.addEventListener("change", refreshAvailability);
  const assigneeSelectEl = backdrop.querySelector("select[name=user_id]");
  if (assigneeSelectEl) assigneeSelectEl.addEventListener("change", refreshAvailability);
  if (task.start_date) refreshAvailability();

  if (!isNew) {
    backdrop.querySelector("#delete-btn").addEventListener("click", async () => {
      if (!confirm("Видалити завдання?")) return;
      try {
        await api(`/api/tasks/${task.id}`, { method: "DELETE" });
        state.modalTask = null;
        await loadBoard();
        render();
      } catch (err) {
        alert("Помилка видалення: " + err.message);
      }
    });
  }

  backdrop.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    if (!payload.start_date) payload.start_date = null;
    if (!payload.start_time) payload.start_time = null;
    if (!payload.due_date) payload.due_date = null;
    payload.planned_minutes = payload.planned_minutes ? Number(payload.planned_minutes) : null;
    payload.priority = Number(payload.priority);
    if (!state.user.is_admin) payload.user_id = currentOwner;
    else if (payload.user_id) payload.user_id = Number(payload.user_id);

    const errBox = backdrop.querySelector(".error-box");

    if (payload.status !== "ideas" && (!payload.start_date || !payload.due_date)) {
      errBox.textContent = "Для цього статусу потрібно вказати дату початку і дедлайн";
      errBox.style.display = "block";
      return;
    }

    try {
      if (isNew) {
        await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      state.modalTask = null;
      await loadBoard();
      render();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = "block";
    }
  });

  return backdrop;
}

// ---------- calendar view ----------

function renderCalendar() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));
  const weekEnd = days[6];
  const viewingSelf = state.viewingUserId === state.user.id;

  const wrap = el(`
    <div class="page calendar-page">
      <div class="page-header">
        <h2>${viewingSelf ? "Мій календар" : `Календар: ${escapeHtml(nameForUser(state.viewingUserId))}`}</h2>
        <div class="calendar-nav">
          <button class="btn secondary" id="prev-week">←</button>
          <span class="calendar-range">${formatDayLabel(days[0])} – ${formatDayLabel(weekEnd)}</span>
          <button class="btn secondary" id="next-week">→</button>
          <button class="btn" id="add-call-btn">+ Дзвінок</button>
        </div>
      </div>
      <div class="calendar-grid"></div>
    </div>
  `);

  wrap.querySelector("#prev-week").addEventListener("click", async () => {
    state.weekStart = addDays(state.weekStart, -7);
    await loadCalls();
    render();
  });
  wrap.querySelector("#next-week").addEventListener("click", async () => {
    state.weekStart = addDays(state.weekStart, 7);
    await loadCalls();
    render();
  });
  wrap.querySelector("#add-call-btn").addEventListener("click", () => {
    state.modalCall = { call_date: todayStr(), start_time: "10:00", end_time: "11:00" };
    render();
  });

  const grid = wrap.querySelector(".calendar-grid");
  grid.appendChild(el(`<div class="calendar-corner"></div>`));
  days.forEach((dateStr, i) => {
    const isToday = dateStr === todayStr();
    grid.appendChild(el(`
      <div class="calendar-daycol-head ${isToday ? "today" : ""}">
        <span class="wd">${WEEKDAY_LABELS[i]}</span> <span class="dd">${formatDayLabel(dateStr)}</span>
      </div>
    `));
  });

  grid.appendChild(el(`<div class="calendar-hours"></div>`));
  const hoursCol = grid.querySelector(".calendar-hours");
  for (const h of CALENDAR_HOURS) {
    hoursCol.appendChild(el(`<div class="hour-label">${String(h).padStart(2, "0")}:00</div>`));
  }

  const firstHour = CALENDAR_HOURS[0];
  const totalHours = CALENDAR_HOURS.length;

  days.forEach((dateStr) => {
    const dayCol = el(`<div class="calendar-daycol" data-date="${dateStr}"></div>`);

    const dayTasks = state.tasks.filter((t) => t.due_date === dateStr);
    if (dayTasks.length) {
      const taskRow = el(`<div class="calendar-tasks"></div>`);
      for (const t of dayTasks) {
        const chip = el(`<div class="calendar-task-chip ${isOverdue(t) ? "overdue" : ""}">${escapeHtml(t.title)}</div>`);
        chip.addEventListener("click", () => {
          state.modalTask = { ...t };
          render();
        });
        taskRow.appendChild(chip);
      }
      dayCol.appendChild(taskRow);
    }

    const timeArea = el(`<div class="calendar-timearea"></div>`);
    for (let i = 1; i < totalHours; i++) {
      timeArea.appendChild(el(`<div class="hour-line" style="top:${(i / totalHours) * 100}%"></div>`));
    }

    const dayCalls = state.calls.filter((c) => c.call_date === dateStr);
    for (const call of dayCalls) {
      const top = timeToPercent(call.start_time, firstHour, totalHours);
      const bottom = timeToPercent(call.end_time, firstHour, totalHours);
      const block = el(`
        <div class="call-block" style="top:${top}%; height:${Math.max(bottom - top, 3)}%">
          <strong>${escapeHtml(call.title)}</strong>
          <span>${call.start_time}–${call.end_time}</span>
        </div>
      `);
      block.addEventListener("click", () => {
        state.modalCall = { ...call };
        render();
      });
      timeArea.appendChild(block);
    }

    dayCol.appendChild(timeArea);
    grid.appendChild(dayCol);
  });

  return wrap;
}

function timeToPercent(hhmm, firstHour, totalHours) {
  const [h, m] = hhmm.split(":").map(Number);
  const minutesFromStart = (h - firstHour) * 60 + m;
  const totalMinutes = totalHours * 60;
  return Math.min(100, Math.max(0, (minutesFromStart / totalMinutes) * 100));
}

// ---------- call modal ----------

function renderCallModal() {
  const call = state.modalCall;
  const isNew = !call.id;

  const backdrop = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <button type="button" class="modal-close" id="modal-close-x" title="Закрити">×</button>
        <h3>${isNew ? "Новий дзвінок" : "Дзвінок"}</h3>
        <div class="error-box" style="display:none"></div>
        <form>
          <div class="field">
            <label>Назва</label>
            <input name="title" required value="${escapeHtml(call.title || "")}" placeholder="Дзвінок з клієнтом" />
          </div>
          <div class="field">
            <label>Дата</label>
            <input name="call_date" type="date" required value="${call.call_date}" />
          </div>
          <div class="row">
            <div class="field">
              <label>Початок</label>
              <input name="start_time" type="time" required value="${call.start_time}" />
            </div>
            <div class="field">
              <label>Кінець</label>
              <input name="end_time" type="time" required value="${call.end_time}" />
            </div>
          </div>
          <div class="modal-actions">
            ${isNew ? "" : `<button type="button" class="btn danger" id="delete-btn">Видалити</button>`}
            <div class="right">
              <button type="button" class="btn secondary" id="cancel">Скасувати</button>
              <button type="submit" class="btn">${isNew ? "Створити" : "Зберегти"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `);

  const close = () => {
    state.modalCall = null;
    render();
  };

  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector("#cancel").addEventListener("click", close);
  backdrop.querySelector("#modal-close-x").addEventListener("click", close);

  if (!isNew) {
    backdrop.querySelector("#delete-btn").addEventListener("click", async () => {
      if (!confirm("Видалити дзвінок?")) return;
      try {
        await api(`/api/calls/${call.id}`, { method: "DELETE" });
        state.modalCall = null;
        await loadCalls();
        render();
      } catch (err) {
        alert("Помилка видалення: " + err.message);
      }
    });
  }

  backdrop.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const errBox = backdrop.querySelector(".error-box");

    if (payload.end_time <= payload.start_time) {
      errBox.textContent = "Час кінця має бути пізніше часу початку";
      errBox.style.display = "block";
      return;
    }

    try {
      if (isNew) {
        payload.user_id = state.viewingUserId;
        await api("/api/calls", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/api/calls/${call.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      state.modalCall = null;
      await loadCalls();
      render();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = "block";
    }
  });

  return backdrop;
}

boot();
