const app = document.getElementById("app");

const state = {
  view: "home",
  lessons: [],
  stats: null,
  currentLessonId: null,
  currentLessonCards: [],
  editingCardId: null,
  studyQueue: [],
  studyIndex: 0,
  studyChecked: false,
  studyHintCount: 0,
  studyInputValue: "",
  studyStats: { seen: 0, again: 0 },
};

// ---------- api helpers ----------

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    return new Promise(() => {});
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Ошибка ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const getLessons = () => api("/api/lessons");
const getStats = () => api("/api/stats");
const createLesson = (name) =>
  api("/api/lessons", { method: "POST", body: JSON.stringify({ name }) });
const deleteLesson = (id) => api(`/api/lessons/${id}`, { method: "DELETE" });
const getCards = (lessonId) => api(`/api/lessons/${lessonId}/cards`);
const createCard = (lessonId, data) =>
  api(`/api/lessons/${lessonId}/cards`, { method: "POST", body: JSON.stringify(data) });
const updateCard = (id, data) =>
  api(`/api/cards/${id}`, { method: "PATCH", body: JSON.stringify(data) });
const deleteCard = (id) => api(`/api/cards/${id}`, { method: "DELETE" });
const getQueue = (params) => api(`/api/review/queue?${new URLSearchParams(params)}`);
const submitReview = (cardId, quality) =>
  api(`/api/cards/${cardId}/review`, { method: "POST", body: JSON.stringify({ quality }) });
const updateSettings = (data) =>
  api("/api/settings", { method: "PATCH", body: JSON.stringify(data) });
const exportData = () => api("/api/export");
const importData = (data) => api("/api/import", { method: "POST", body: JSON.stringify(data) });
const logout = () => api("/logout", { method: "POST" });

// ---------- rendering ----------

function render() {
  if (state.view === "home") return renderHome();
  if (state.view === "lesson") return renderLesson();
  if (state.view === "study") return renderStudy();
}

async function goHome() {
  state.view = "home";
  render();
  const [lessons, stats] = await Promise.all([getLessons(), getStats()]);
  state.lessons = lessons;
  state.stats = stats;
  render();
}

async function goLesson(lessonId) {
  state.view = "lesson";
  state.currentLessonId = lessonId;
  state.editingCardId = null;
  render();
  state.currentLessonCards = await getCards(lessonId);
  render();
}

async function startStudy(params, label) {
  const queue = await getQueue(params);
  if (queue.length === 0) {
    alert("Нечего изучать сейчас — загляни позже или добавь новые карточки.");
    return;
  }
  state.view = "study";
  state.studyQueue = queue.map(withDirection);
  state.studyIndex = 0;
  state.studyChecked = false;
  state.studyHintCount = 0;
  state.studyInputValue = "";
  state.studyStats = { seen: 0, again: 0 };
  state.studyLabel = label;
  render();
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

// ---------- home ----------

function renderHome() {
  app.innerHTML = "";

  const topBar = el(`<div class="top-bar end"><span class="back-link" id="logout-link">Выйти</span></div>`);
  topBar.querySelector("#logout-link").onclick = async () => {
    await logout();
    window.location.href = "/login";
  };
  app.appendChild(topBar);

  app.appendChild(el(`<div><h1>Vocab Recall</h1><p class="subtitle">Твои английские фразы и слова, которые ты сам добавляешь</p></div>`));

  if (state.stats) {
    const s = state.stats;
    app.appendChild(el(`
      <div class="stats-row">
        <div class="stat"><div class="n">${s.total}</div><div class="l">всего карточек</div></div>
        <div class="stat"><div class="n">${s.due}</div><div class="l">на повторение</div></div>
        <div class="stat"><div class="n">${s.learned}</div><div class="l">выучено</div></div>
      </div>
    `));

    const availableNow = s.available_now;
    const banner = el(`
      <div class="due-banner ${availableNow === 0 ? "empty" : ""}">
        <div>
          <div class="count">${availableNow}</div>
          <div class="label">${availableNow === 0 ? "Нечего изучать прямо сейчас — всё сделано" : "карточек к повторению и изучению"}</div>
        </div>
        <button class="primary" ${availableNow === 0 ? "disabled" : ""} id="btn-review-due">Повторить / учить</button>
      </div>
    `);
    if (availableNow > 0) {
      banner.querySelector("#btn-review-due").onclick = () => startStudy({ scope: "due" }, "Повторение");
    }
    app.appendChild(banner);
  }

  const lessonsBox = el(`<div class="card-box"><h2>Мои уроки</h2></div>`);
  if (state.lessons.length === 0) {
    lessonsBox.appendChild(el(`<div class="empty-state">Пока нет уроков — добавь первый ниже</div>`));
  } else {
    state.lessons.forEach((lesson) => {
      const row = el(`
        <div class="lesson-row">
          <div class="lesson-info">
            <div class="lesson-name">${escapeHtml(lesson.name)}</div>
            <div class="lesson-meta">${lesson.card_count} карточек
              ${lesson.due_count > 0 ? `<span class="badge">${lesson.due_count} к повторению</span>` : ""}
            </div>
          </div>
          <div class="lesson-actions">
            <button data-action="study">Учить</button>
            <button data-action="open">Открыть</button>
            <button data-action="delete" class="ghost danger">✕</button>
          </div>
        </div>
      `);
      row.querySelector('[data-action="open"]').onclick = () => goLesson(lesson.id);
      row.querySelector('[data-action="study"]').onclick = () =>
        startStudy({ scope: "lesson", lesson_id: lesson.id }, lesson.name);
      row.querySelector('[data-action="delete"]').onclick = async () => {
        if (!confirm(`Удалить урок «${lesson.name}» вместе со всеми карточками?`)) return;
        await deleteLesson(lesson.id);
        goHome();
      };
      lessonsBox.appendChild(row);
    });
  }

  const form = el(`
    <form class="new-lesson-form">
      <input type="text" placeholder="Название нового урока" required />
      <button type="submit" class="primary">+ Урок</button>
    </form>
  `);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const name = input.value.trim();
    if (!name) return;
    const lesson = await createLesson(name);
    input.value = "";
    goLesson(lesson.id);
  };
  lessonsBox.appendChild(form);
  app.appendChild(lessonsBox);

  if (state.stats) {
    const s = state.stats;
    const settingsBox = el(`
      <div class="card-box">
        <h2>Настройки</h2>
        <div class="settings-row">
          <label for="new-cards-input">Новых карточек в день</label>
          <input type="number" min="0" id="new-cards-input" value="${s.new_cards_per_day}" />
          <button id="save-settings">Сохранить</button>
        </div>
        <div class="lesson-meta">Показано сегодня: ${s.introduced_today} / ${s.new_cards_per_day} · ждут очереди: ${s.new_waiting}</div>
      </div>
    `);
    settingsBox.querySelector("#save-settings").onclick = async () => {
      const value = Number(settingsBox.querySelector("#new-cards-input").value);
      await updateSettings({ new_cards_per_day: value });
      goHome();
    };
    app.appendChild(settingsBox);
  }

  const backupBox = el(`
    <div class="card-box">
      <h2>Резервная копия</h2>
      <div class="lesson-actions">
        <button id="export-btn">Скачать копию (.json)</button>
        <button id="import-btn">Загрузить из файла</button>
      </div>
      <input type="file" accept="application/json" id="import-file" style="display:none" />
    </div>
  `);
  backupBox.querySelector("#export-btn").onclick = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocab-recall-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const fileInput = backupBox.querySelector("#import-file");
  backupBox.querySelector("#import-btn").onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (err) {
      alert("Файл повреждён или это не JSON-копия");
      return;
    }
    try {
      const result = await importData(parsed);
      alert(`Импортировано уроков: ${result.lessons_imported}, карточек: ${result.cards_imported}`);
      goHome();
    } catch (err) {
      alert(err.message);
    }
  };
  app.appendChild(backupBox);
}

// ---------- lesson ----------

function renderLesson() {
  app.innerHTML = "";
  const lesson = state.lessons.find((l) => l.id === state.currentLessonId);
  const title = lesson ? lesson.name : "Урок";

  const top = el(`
    <div class="top-bar">
      <span class="back-link" id="back">← Все уроки</span>
      <button class="primary" id="study-lesson">Учить этот урок</button>
    </div>
  `);
  top.querySelector("#back").onclick = goHome;
  top.querySelector("#study-lesson").onclick = () =>
    startStudy({ scope: "lesson", lesson_id: state.currentLessonId }, title);
  app.appendChild(top);
  app.appendChild(el(`<h1>${escapeHtml(title)}</h1>`));

  const addForm = el(`
    <form class="add-card-form card-box">
      <div class="row">
        <input type="text" name="phrase" placeholder="Фраза или слово (на английском)" required />
        <input type="text" name="translation" placeholder="Перевод" required />
      </div>
      <input type="text" name="note" placeholder="Заметка (необязательно)" />
      <div class="error-msg" style="display:none"></div>
      <button type="submit" class="primary">+ Добавить карточку</button>
    </form>
  `);
  addForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const errBox = addForm.querySelector(".error-msg");
    errBox.style.display = "none";
    try {
      await createCard(state.currentLessonId, {
        phrase: fd.get("phrase"),
        translation: fd.get("translation"),
        note: fd.get("note"),
      });
      addForm.reset();
      state.currentLessonCards = await getCards(state.currentLessonId);
      renderLesson();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = "block";
    }
  };
  app.appendChild(addForm);

  const listBox = el(`<div class="card-box"><h2>Карточки (${state.currentLessonCards.length})</h2></div>`);
  if (state.currentLessonCards.length === 0) {
    listBox.appendChild(el(`<div class="empty-state">Пока нет карточек в этом уроке</div>`));
  } else {
    state.currentLessonCards.forEach((card) => {
      if (state.editingCardId === card.id) {
        const editForm = el(`
          <form class="edit-card-form">
            <input type="text" name="phrase" value="${escapeAttr(card.phrase)}" required />
            <input type="text" name="translation" value="${escapeAttr(card.translation)}" required />
            <input type="text" name="note" value="${escapeAttr(card.note || "")}" placeholder="Заметка" />
            <div class="error-msg" style="display:none"></div>
            <div class="card-item-actions">
              <button type="submit" class="primary">Сохранить</button>
              <button type="button" class="ghost" data-action="cancel">Отмена</button>
            </div>
          </form>
        `);
        editForm.onsubmit = async (e) => {
          e.preventDefault();
          const fd = new FormData(editForm);
          const errBox = editForm.querySelector(".error-msg");
          try {
            await updateCard(card.id, {
              phrase: fd.get("phrase"),
              translation: fd.get("translation"),
              note: fd.get("note"),
            });
            state.editingCardId = null;
            state.currentLessonCards = await getCards(state.currentLessonId);
            renderLesson();
          } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = "block";
          }
        };
        editForm.querySelector('[data-action="cancel"]').onclick = () => {
          state.editingCardId = null;
          renderLesson();
        };
        listBox.appendChild(editForm);
        return;
      }

      const srsLabel =
        card.repetitions === 0 && !card.first_reviewed_at
          ? "новая"
          : `повторов: ${card.repetitions}, интервал: ${Math.round(card.interval_days)} дн.`;
      const item = el(`
        <div class="card-item">
          <div>
            <div class="card-phrase">${escapeHtml(card.phrase)}</div>
            <div class="card-translation">${escapeHtml(card.translation)}</div>
            ${card.note ? `<div class="card-srs">${escapeHtml(card.note)}</div>` : ""}
            <div class="card-srs">${srsLabel}</div>
          </div>
          <div class="card-item-actions">
            <button data-action="edit" class="ghost">✎</button>
            <button data-action="delete" class="ghost danger">✕</button>
          </div>
        </div>
      `);
      item.querySelector('[data-action="edit"]').onclick = () => {
        state.editingCardId = card.id;
        renderLesson();
      };
      item.querySelector('[data-action="delete"]').onclick = async () => {
        await deleteCard(card.id);
        state.currentLessonCards = await getCards(state.currentLessonId);
        renderLesson();
      };
      listBox.appendChild(item);
    });
  }
  app.appendChild(listBox);
}

// ---------- study ----------

function withDirection(card) {
  return { ...card, _direction: Math.random() < 0.5 ? "phrase" : "translation" };
}

function frontBack(item) {
  if (item._direction === "phrase") {
    return { front: item.phrase, back: item.translation, frontLabel: "EN", backLabel: "перевод" };
  }
  return { front: item.translation, back: item.phrase, frontLabel: "перевод", backLabel: "EN" };
}

function revealableLength(str) {
  return str.replace(/ /g, "").length;
}

function hintDisplay(answer, count) {
  let shown = 0;
  return answer
    .split("")
    .map((ch) => {
      if (ch === " ") return " ";
      if (shown < count) {
        shown++;
        return ch;
      }
      return "•";
    })
    .join("");
}

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function renderStudy() {
  app.innerHTML = "";

  if (state.studyIndex >= state.studyQueue.length) {
    const summary = el(`
      <div class="session-summary">
        <div class="big">🎉</div>
        <h2>Сессия завершена</h2>
        <p class="subtitle">Повторено карточек: ${state.studyStats.seen}, снова забыто: ${state.studyStats.again}</p>
        <button class="primary" id="done">На главную</button>
      </div>
    `);
    summary.querySelector("#done").onclick = goHome;
    app.appendChild(summary);
    return;
  }

  const item = state.studyQueue[state.studyIndex];
  const { front, back, frontLabel, backLabel } = frontBack(item);

  const top = el(`<div class="top-bar"><span class="back-link" id="back">← Прервать</span><span></span></div>`);
  top.querySelector("#back").onclick = goHome;
  app.appendChild(top);

  app.appendChild(
    el(`<div class="study-progress">${state.studyLabel || "Повторение"} · ${state.studyIndex + 1} / ${state.studyQueue.length}</div>`)
  );

  const isMatch = normalize(state.studyInputValue) === normalize(back);
  const flash = el(`
    <div class="flashcard">
      <div class="direction-label">${frontLabel} → ${backLabel}</div>
      <div class="phrase">${escapeHtml(front)}</div>
      ${
        state.studyChecked
          ? `<div class="translation">${escapeHtml(back)}</div>
             ${item.note ? `<div class="note">${escapeHtml(item.note)}</div>` : ""}
             <div class="answer-feedback ${isMatch ? "correct" : "incorrect"}">
               Твой ответ: «${escapeHtml(state.studyInputValue || "—")}» ${isMatch ? "✓" : "✗"}
             </div>`
          : ""
      }
    </div>
  `);
  app.appendChild(flash);

  if (!state.studyChecked) {
    const maxHint = revealableLength(back);
    const form = el(`
      <form class="answer-form">
        <input type="text" id="answer-input" placeholder="Введи ${backLabel === "EN" ? "фразу на английском" : "перевод"}" autocomplete="off" />
        <div class="hint-line">${state.studyHintCount > 0 ? hintDisplay(back, state.studyHintCount) : ""}</div>
        <div class="answer-actions">
          <button type="button" id="hint-btn" ${state.studyHintCount >= maxHint ? "disabled" : ""}>Подсказка</button>
          <button type="submit" class="primary">Проверить</button>
        </div>
      </form>
    `);
    const input = form.querySelector("#answer-input");
    input.value = state.studyInputValue;
    input.oninput = () => {
      state.studyInputValue = input.value;
    };
    form.querySelector("#hint-btn").onclick = () => {
      state.studyInputValue = input.value;
      state.studyHintCount = Math.min(state.studyHintCount + 1, maxHint);
      renderStudy();
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      state.studyInputValue = input.value;
      state.studyChecked = true;
      renderStudy();
    };
    app.appendChild(form);
    input.focus();
  } else {
    const grades = el(`
      <div class="grade-buttons">
        <button class="grade-again" data-q="0">Не помню</button>
        <button class="grade-hard" data-q="3">Трудно</button>
        <button class="grade-good" data-q="4">Помню</button>
        <button class="grade-easy" data-q="5">Легко</button>
      </div>
    `);
    grades.querySelectorAll("button").forEach((btn) => {
      btn.onclick = async () => {
        const quality = Number(btn.dataset.q);
        grades.querySelectorAll("button").forEach((b) => (b.disabled = true));
        await submitReview(item.id, quality);
        state.studyStats.seen += 1;
        if (quality === 0) {
          state.studyStats.again += 1;
          state.studyQueue.push(withDirection(item));
        }
        state.studyIndex += 1;
        state.studyChecked = false;
        state.studyHintCount = 0;
        state.studyInputValue = "";
        renderStudy();
      };
    });
    app.appendChild(grades);
  }
}

goHome();
