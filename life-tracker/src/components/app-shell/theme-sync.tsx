"use client";

import { useEffect } from "react";

// Радикс-порталы (Dialog, Popover, DropdownMenu) рендерятся в <body>, вне .dark-обёртки,
// поэтому тема на внутреннем div до них не доходит. Дублируем класс на <html>,
// чтобы всплывающие окна тоже брали тёмные токены. Основной UI остаётся с классом
// на app-shell (серверный рендер) — без «вспышки» светлой темы.
export function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return null;
}
