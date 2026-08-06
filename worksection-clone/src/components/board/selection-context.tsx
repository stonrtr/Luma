"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
};

const SelectionContext = createContext<Ctx | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return <SelectionContext.Provider value={{ selected, toggle, clear }}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  return useContext(SelectionContext);
}
