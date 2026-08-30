"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { Modal, Toggle } from "./ui";
import { Sun, Moon, Globe, Bell, Send, CalendarDay } from "./icons";
import { CalendarConnectModal } from "./TaskViews";
import { connectGoogle, disconnectGoogle } from "@/lib/google";

/** Отправка сообщения через Telegram Bot API прямо из браузера (GET, без preflight) */
export async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage?chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(text)}`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    return !!j.ok;
  } catch {
    return false;
  }
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data, updateSettings } = useStore();
  const st = data.settings ?? { theme: "system" as const, lang: "ru" as const, notifications: false };
  const tg = st.telegram ?? { token: "", chatId: "", enabled: false };
  const cap = st.captureBot ?? { token: "", enabled: false, mode: "client" as const, syncKey: "", apiBase: "" };
  const saveCap = (patch: Partial<typeof cap>) =>
    updateSettings({ captureBot: { ...cap, ...patch } });
  const [calOpen, setCalOpen] = useState(false);
  const [tgStatus, setTgStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);
  const gg = st.google ?? { clientId: "", enabled: false };
  const [gStatus, setGStatus] = useState<string | null>(null);
  const saveG = (patch: Partial<typeof gg>) =>
    updateSettings({ google: { clientId: gg.clientId, enabled: gg.enabled, ...patch } });
  const connectG = async () => {
    if (!gg.clientId.trim()) return;
    setGStatus("Подключаю…");
    const ok = await connectGoogle(gg.clientId.trim(), true);
    if (ok) { saveG({ enabled: true }); setGStatus("Подключено. Задачи с датой будут попадать в Google Календарь."); }
    else setGStatus("Не удалось. Проверьте Client ID и что домен добавлен в разрешённые в Google Cloud.");
  };

  const saveTg = (patch: Partial<typeof tg>) =>
    updateSettings({ telegram: { token: tg.token, chatId: tg.chatId, enabled: tg.enabled, ...patch } });

  const testTg = async () => {
    setTgStatus({ ok: true, text: "Отправляю…" });
    const ok = await sendTelegram(tg.token.trim(), tg.chatId.trim(), "✅ Peak: тестовое уведомление");
    setTgStatus(ok
      ? { ok: true, text: "Отправлено — проверьте Telegram" }
      : { ok: false, text: "Не удалось. Проверьте токен и chat ID" });
  };

  const enableNotifs = async (v: boolean) => {
    if (v && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setNotifStatus("Разрешение не выдано — уведомления не будут приходить");
          updateSettings({ notifications: false });
          return;
        }
      } else if (Notification.permission === "denied") {
        setNotifStatus("Уведомления заблокированы в браузере — разрешите их в настройках сайта");
        return;
      }
    }
    setNotifStatus(null);
    updateSettings({ notifications: v });
  };

  return (
    <Modal onClose={onClose} width={560}>
      <div className="modal-scroll">
        <div className="modal-head" style={{ marginBottom: 18 }}>
          <div className="m-titles">
            <div style={{ fontSize: 20, fontWeight: 700 }}>Настройки</div>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* Внешний вид */}
        <div className="set-section">
          <div className="set-section-title">Внешний вид</div>
          <div className="set-row">
            <span className="fic">{st.theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}</span>
            <div className="set-label"><div className="set-title">Тема</div></div>
            <div className="set-seg">
              {([["light", "Светлая"], ["dark", "Тёмная"], ["system", "Системная"]] as const).map(([v, l]) => (
                <button key={v} className={st.theme === v ? "active" : ""}
                  onClick={() => updateSettings({ theme: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="set-row">
            <span className="fic"><Globe size={18} /></span>
            <div className="set-label">
              <div className="set-title">Язык</div>
              <div className="set-sub">English — в разработке (переводим все экраны)</div>
            </div>
            <div className="set-seg">
              <button className={st.lang === "ru" ? "active" : ""} onClick={() => updateSettings({ lang: "ru" })}>Русский</button>
              <button disabled style={{ opacity: 0.45, cursor: "not-allowed" }}>English</button>
            </div>
          </div>
        </div>

        {/* Уведомления */}
        <div className="set-section">
          <div className="set-section-title">Уведомления</div>
          <div className="set-row">
            <span className="fic"><Bell size={18} /></span>
            <div className="set-label">
              <div className="set-title">Браузерные уведомления</div>
              <div className="set-sub">Напоминания о задачах и привычках (пока вкладка открыта)</div>
            </div>
            <Toggle on={st.notifications} onChange={enableNotifs} />
          </div>
          {notifStatus && <div className="set-status err">{notifStatus}</div>}
        </div>

        {/* Telegram */}
        <div className="set-section">
          <div className="set-section-title">Telegram-бот</div>
          <div className="set-row">
            <span className="fic"><Send size={18} /></span>
            <div className="set-label">
              <div className="set-title">Дублировать напоминания в Telegram</div>
              <div className="set-sub">Создайте бота через @BotFather, узнайте chat ID у @userinfobot</div>
            </div>
            <Toggle on={tg.enabled} onChange={(v) => saveTg({ enabled: v })} />
          </div>
          <div className="tg-fields">
            <input className="finput" placeholder="Токен бота (123456:ABC-...)" value={tg.token}
              onChange={(e) => saveTg({ token: e.target.value })} />
            <input className="finput" placeholder="Chat ID (например 123456789)" value={tg.chatId}
              onChange={(e) => saveTg({ chatId: e.target.value })} />
            <div>
              <button className="btn-secondary" disabled={!tg.token.trim() || !tg.chatId.trim()}
                style={{ opacity: !tg.token.trim() || !tg.chatId.trim() ? 0.5 : 1 }}
                onClick={testTg}>Отправить тест</button>
            </div>
            {tgStatus && <div className={`set-status ${tgStatus.ok ? "ok" : "err"}`}>{tgStatus.text}</div>}
          </div>
        </div>

        {/* Идеи из Telegram */}
        <div className="set-section">
          <div className="set-section-title">Идеи из Telegram</div>
          <div className="set-row">
            <span className="fic"><Send size={18} /></span>
            <div className="set-label">
              <div className="set-title">Захват идей через бота</div>
              <div className="set-sub">Пишете боту — текст попадает во «Входящие», бот отвечает мгновенно даже при закрытом приложении. Префикс «!» делает задачу на сегодня.</div>
            </div>
            <Toggle on={cap.enabled} onChange={(v) => saveCap({ enabled: v, mode: "server" })} />
          </div>
          {cap.enabled && (
            <div className="tg-fields">
              <input className="finput" placeholder="Ключ синхронизации (= SYNC_SECRET на сервере)" value={cap.syncKey ?? ""}
                onChange={(e) => saveCap({ syncKey: e.target.value })} />
              <input className="finput" placeholder="База API (пусто = тот же домен, что приложение)" value={cap.apiBase ?? ""}
                onChange={(e) => saveCap({ apiBase: e.target.value })} />
              <div className="set-sub" style={{ paddingLeft: 0 }}>
                Серверная настройка (один раз, см. TELEGRAM-SETUP.md): бесплатный Upstash Redis + переменные
                окружения в Vercel (<b>UPSTASH_REDIS_REST_URL</b>, <b>UPSTASH_REDIS_REST_TOKEN</b>,
                <b> TG_BOT_TOKEN</b>, <b>SYNC_SECRET</b>) + регистрация вебхука Telegram. Сюда впишите тот же
                <b> SYNC_SECRET</b>.
              </div>
            </div>
          )}
        </div>

        {/* Google Календарь — прямая синхронизация */}
        <div className="set-section">
          <div className="set-section-title">Google Календарь</div>
          <div className="set-row">
            <span className="fic"><CalendarDay size={18} /></span>
            <div className="set-label">
              <div className="set-title">Синхронизация задач в Google Календарь</div>
              <div className="set-sub">Задачи с датой автоматически создают события. Нужен OAuth Client ID из Google Cloud (публичный, не секрет).</div>
            </div>
            {gg.enabled
              ? <button className="btn-secondary" onClick={() => { disconnectGoogle(); saveG({ enabled: false }); setGStatus("Отключено."); }}>Отключить</button>
              : <button className="btn-secondary" disabled={!gg.clientId.trim()} style={{ opacity: gg.clientId.trim() ? 1 : 0.5 }} onClick={connectG}>Подключить Google</button>}
          </div>
          <div className="tg-fields">
            <input className="finput" placeholder="OAuth Client ID (…apps.googleusercontent.com)" value={gg.clientId}
              onChange={(e) => saveG({ clientId: e.target.value })} />
            {gStatus && <div className={`set-status ${gStatus.startsWith("Подключено") ? "ok" : gStatus.startsWith("Не удалось") ? "err" : ""}`}>{gStatus}</div>}
          </div>
        </div>

        {/* Импорт .ics (одноразовый снимок) */}
        <div className="set-section">
          <div className="set-section-title">Импорт из файла (.ics)</div>
          <div className="set-row">
            <span className="fic"><CalendarDay size={18} /></span>
            <div className="set-label">
              <div className="set-title">Разовый импорт событий</div>
              <div className="set-sub">Загрузить события из файла .ics{(data.calendarEvents?.length ?? 0) > 0 ? ` · сейчас: ${data.calendarEvents!.length}` : ""}</div>
            </div>
            <button className="btn-secondary" onClick={() => setCalOpen(true)}>Выбрать файл</button>
          </div>
        </div>

      </div>
      <div className="modal-foot">
        <button className="btn-primary" onClick={onClose}>Готово</button>
      </div>
      {calOpen && <CalendarConnectModal onClose={() => setCalOpen(false)} />}
    </Modal>
  );
}
