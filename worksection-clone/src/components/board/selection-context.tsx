"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
};

export const SelectionContext = createContext<Ctx | null>(null);

// Хук состояния выбора — держится в самой доске, чтобы обработчик drag знал о выделении
export function useSelectionState(): Ctx {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, toggle, clear };
}

export function useSelection() {
  return useContext(SelectionContext);
}
