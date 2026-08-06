import "server-only";
import nodemailer from "nodemailer";

// Почтовый отправитель. Настраивается через env:
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true|false), SMTP_USER, SMTP_PASS, MAIL_FROM
// Если SMTP не сконфигурирован — письмо выводится в консоль сервера (dev-fallback),
// чтобы поток «створення → лист» работал локально без реального провайдера.

type Mail = { to: string; subject: string; text: string; html?: string };

let cached: nodemailer.Transporter | null = null;
function transport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return cached;
}

// Возвращает true, если письмо реально ушло через SMTP; false — если сработал dev-fallback.
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = transport();
  const from = process.env.MAIL_FROM ?? "Worksection <no-reply@worksection.local>";
  if (!t) {
    console.info(`[mail:dev] Лист не надіслано (SMTP не налаштовано). Кому: ${mail.to}\nТема: ${mail.subject}\n${mail.text}`);
    return false;
  }
  await t.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
  return true;
}

// Письмо с доступами для приглашённого сотрудника.
export function inviteEmail(name: string, email: string, password: string): Mail {
  const appUrl = process.env.APP_URL ?? "http://localhost:3100";
  const text =
    `Вітаємо, ${name}!\n\n` +
    `Для вас створено акаунт у робочому просторі.\n\n` +
    `Логін (email): ${email}\n` +
    `Тимчасовий пароль: ${password}\n\n` +
    `Увійти: ${appUrl}\n\n` +
    `Будь ласка, змініть пароль після першого входу.`;
  const html =
    `<p>Вітаємо, <b>${name}</b>!</p>` +
    `<p>Для вас створено акаунт у робочому просторі.</p>` +
    `<p><b>Логін (email):</b> ${email}<br><b>Тимчасовий пароль:</b> <code>${password}</code></p>` +
    `<p><a href="${appUrl}">Увійти в систему</a></p>` +
    `<p style="color:#666">Будь ласка, змініть пароль після першого входу.</p>`;
  return { to: email, subject: "Доступи до робочого простору", text, html };
}
