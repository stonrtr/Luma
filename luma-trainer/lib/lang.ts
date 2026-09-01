// Language detection & normalization (§15.1, §17.3).

const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[A-Za-z]/;

export function detectLanguage(text: string): "en" | "ru" {
  const cyr = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return cyr > lat ? "ru" : "en";
}

export function hasCyrillic(text: string): boolean {
  return CYRILLIC.test(text);
}

export function hasLatin(text: string): boolean {
  return LATIN.test(text);
}

/** Trim, collapse internal whitespace, strip zero-width chars и эмодзи-флаги.
 * ЗАПРЕТ: эмодзи-флаги стран (в т.ч. флаг России 🇷🇺) никогда не сохраняются в
 * тексте карточек — вырезаем их здесь, т.к. через normalize проходит любой
 * сохраняемый текст (фразы, перевод, Telegram-бот). */
export function normalize(text: string): string {
  return text
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "") // regional indicators → любые флаги
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
