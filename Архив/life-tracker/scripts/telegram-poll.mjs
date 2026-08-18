// Локальный поллинг Telegram: опрашивает getUpdates и передаёт апдейты
// в локальный вебхук приложения. Нужен, чтобы команды бота работали без
// публичного URL / туннеля. Запуск: node scripts/telegram-poll.mjs
import fs from "node:fs";

const env = {};
try {
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
} catch {}

const TOKEN = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const SECRET = env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "";
const APP = env.APP_URL || process.env.APP_URL || "http://localhost:3100";

if (!TOKEN) { console.error("no TELEGRAM_BOT_TOKEN in .env"); process.exit(1); }

let offset = 0;
console.log("[telegram-poll] started, forwarding to", APP);

while (true) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=30&offset=${offset}`);
    const d = await r.json();
    if (d.ok && Array.isArray(d.result)) {
      for (const u of d.result) {
        offset = u.update_id + 1;
        try {
          await fetch(`${APP}/api/telegram/webhook`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET },
            body: JSON.stringify(u),
          });
          console.log("[telegram-poll] delivered update", u.update_id);
        } catch (e) {
          console.error("[telegram-poll] forward error:", e.message);
        }
      }
    }
  } catch (e) {
    console.error("[telegram-poll] poll error:", e.message);
    await new Promise((res) => setTimeout(res, 3000));
  }
}
