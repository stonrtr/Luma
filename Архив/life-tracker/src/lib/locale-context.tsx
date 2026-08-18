"use client";

import { createContext, useContext } from "react";
import { t as translate } from "@/lib/i18n";

const LocaleCtx = createContext<string>("uk");

export function LocaleProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): string {
  return useContext(LocaleCtx);
}

// Хук перекладу для клієнтських компонентів: const tr = useT(); tr("some.key")
export function useT(): (key: string) => string {
  const locale = useContext(LocaleCtx);
  return (key: string) => translate(locale, key);
}
