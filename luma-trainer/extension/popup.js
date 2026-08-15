const $ = (id) => document.getElementById(id);
let ctx = { url: "", title: "", time: undefined };

function setStatus(text, kind) {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + (kind || "");
}

function send(type, extra) {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type, ...extra }, resolve));
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadCaption() {
  const tab = await activeTab();
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "LUMA_GET_CAPTION" });
    ctx = { url: resp?.url || tab.url, title: resp?.title || tab.title, time: resp?.time };
    $("src").textContent = ctx.url ? `Источник: ${ctx.title || ctx.url}` : "";
    return resp || {};
  } catch {
    ctx = { url: tab.url, title: tab.title };
    return {};
  }
}

async function loadLessons() {
  const res = await send("LUMA_LESSONS");
  const sel = $("lesson");
  sel.innerHTML = "";
  if (res && res.ok && Array.isArray(res.data)) {
    for (const l of res.data) {
      const o = document.createElement("option");
      o.value = l.id;
      o.textContent = l.topicName ? `${l.topicName} · ${l.title}` : l.title;
      sel.appendChild(o);
    }
    const create = document.createElement("option");
    create.value = "__new__";
    create.textContent = "➕ Новый урок «Из субтитров»";
    sel.appendChild(create);
  } else {
    setStatus("Не удалось связаться с Luma. Проверьте, что приложение запущено, и адрес в настройках.", "err");
  }
}

$("useCaption").addEventListener("click", async () => {
  const r = await loadCaption();
  if (r.caption) $("phrase").value = r.caption;
  else setStatus("Субтитр не найден на странице.", "err");
});

$("useSelection").addEventListener("click", async () => {
  const r = await loadCaption();
  if (r.selection) $("phrase").value = r.selection;
  else setStatus("Нет выделенного текста.", "err");
});

$("ocr").addEventListener("click", async () => {
  const res = await send("LUMA_CAPTURE");
  if (res && res.ok) {
    const img = $("shot");
    img.src = res.dataUrl;
    img.style.display = "block";
    setStatus("Снимок готов — впишите фразу в поле выше по изображению.", "");
  } else {
    setStatus("Не удалось сделать снимок.", "err");
  }
});

$("send").addEventListener("click", async () => {
  const text = $("phrase").value.trim();
  if (!text) return setStatus("Введите фразу.", "err");
  let lessonId = $("lesson").value;

  if (lessonId === "__new__") {
    const created = await send("LUMA_CREATE_LESSON", { payload: { title: "Из субтитров" } });
    if (!created.ok) return setStatus("Не удалось создать урок.", "err");
    lessonId = created.data.id;
  }

  const payload = {
    lessonId,
    source: { type: "subtitle", url: ctx.url, timestamp: ctx.time },
  };
  // Detect language: Cyrillic → russian side, else english side.
  if (/[Ѐ-ӿ]/.test(text)) payload.russian = text;
  else payload.english = text;

  const res = await send("LUMA_ADD", { payload });
  if (res && res.ok) {
    setStatus("Сохранено! Перевод подгрузится в Luma.", "ok");
    $("phrase").value = "";
  } else {
    setStatus("Ошибка: " + (res?.data?.error || res?.error || "неизвестно"), "err");
  }
});

$("opts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Initial load
(async () => {
  await loadLessons();
  const r = await loadCaption();
  if (r.caption) $("phrase").value = r.caption;
})();
