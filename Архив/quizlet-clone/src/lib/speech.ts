// Web Speech API integration — text-to-speech pronunciation for terms.
let voices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  voices = window.speechSynthesis.getVoices();
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function speak(text: string, lang = "en", enabled = true) {
  if (!enabled) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = normalizeLang(lang);
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (match) u.voice = match;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function normalizeLang(lang: string) {
  const map: Record<string, string> = {
    es: "es-ES",
    en: "en-US",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    ja: "ja-JP",
    zh: "zh-CN",
    ko: "ko-KR",
    ru: "ru-RU",
    pt: "pt-BR",
  };
  return map[lang] ?? lang;
}

export function supportsSpeech() {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}
