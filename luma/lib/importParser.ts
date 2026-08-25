// Bulk import parsing (§16.1). One record per line. Supported separators:
//   "en — ru"  (em/en dash), "en;ru", "en<TAB>ru".
// Comma is intentionally NOT a separator (it appears inside sentences).
// A line with no separator becomes a one-sided card; language is auto-detected.

import { detectLanguage, normalize } from "./lang";

export interface ParsedEntry {
  english: string;
  russian: string;
  sourceLanguage: "en" | "ru";
  raw: string;
}

const SEPARATORS = [/\t/, /\s+—\s+/, /\s+–\s+/, /\s*;\s*/];

function splitLine(line: string): [string, string] | null {
  for (const sep of SEPARATORS) {
    const m = line.split(sep);
    if (m.length >= 2) {
      const left = m[0];
      const right = m.slice(1).join(" ");
      if (left.trim() && right.trim()) return [left.trim(), right.trim()];
    }
  }
  return null;
}

export function parseImportLine(rawLine: string): ParsedEntry | null {
  const raw = rawLine.replace(/\r$/, "");
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Split BEFORE collapsing whitespace, so a TAB separator survives (§16.1).
  const pair = splitLine(trimmed);
  if (pair) {
    const [a, b] = pair;
    // Decide which side is English.
    if (detectLanguage(a) === "en") {
      return { english: normalize(a), russian: normalize(b), sourceLanguage: "en", raw };
    }
    return { english: normalize(b), russian: normalize(a), sourceLanguage: "ru", raw };
  }

  // No separator → single-sided card.
  const line = normalize(trimmed);
  const lang = detectLanguage(line);
  if (lang === "en") {
    return { english: line, russian: "", sourceLanguage: "en", raw };
  }
  return { english: "", russian: line, sourceLanguage: "ru", raw };
}

export interface ParseResult {
  entries: ParsedEntry[];
  skipped: number; // blank lines
}

export function parseImport(text: string): ParseResult {
  const lines = (text || "").split("\n");
  const entries: ParsedEntry[] = [];
  let skipped = 0;
  for (const line of lines) {
    const parsed = parseImportLine(line);
    if (parsed) entries.push(parsed);
    else if (line.trim() === "") skipped += 1;
  }
  return { entries, skipped };
}
