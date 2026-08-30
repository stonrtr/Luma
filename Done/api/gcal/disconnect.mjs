// Отключить Google Календарь: стираем сохранённые токены.
import { SECRET, clearState } from "./_lib.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (!SECRET || req.query.key !== SECRET) { res.status(401).json({ ok: false, error: "bad key" }); return; }
  await clearState();
  res.status(200).json({ ok: true });
}
