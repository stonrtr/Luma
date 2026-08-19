"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Pending = { message: string; confirmLabel: string; resolve: (v: boolean) => void } | null;

const Ctx = createContext<(message: string, confirmLabel?: string) => Promise<boolean>>(async () => true);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending>(null);

  const ask = useCallback(
    (message: string, confirmLabel = "Да") =>
      new Promise<boolean>((resolve) => setPending({ message, confirmLabel, resolve })),
    [],
  );

  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <Ctx.Provider value={ask}>
      {children}
      {pending && (
        <div className="scrim" onClick={() => close(false)}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-msg">{pending.message}</div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => close(false)}>
                Отмена
              </button>
              <button className="btn primary" onClick={() => close(true)}>
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
