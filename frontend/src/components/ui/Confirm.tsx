import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setOptions(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          role="dialog"
          aria-modal="true"
          aria-label={options.title}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl animate-[fadeInUp_0.25s_ease-out]">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  options.danger ? 'bg-rose-100 text-error' : 'bg-primary-tint text-primary'
                }`}
              >
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-foreground">{options.title}</h2>
                  <button
                    onClick={() => close(false)}
                    className="rounded-full p-1 text-muted transition-colors hover:bg-tag-bg hover:text-foreground"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{options.message}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-tag-bg"
              >
                {options.cancelText ?? 'Cancel'}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors ${
                  options.danger
                    ? 'bg-error hover:bg-error/90 shadow-sm shadow-error/30'
                    : 'bg-primary hover:bg-primary-hover shadow-sm shadow-primary/30'
                }`}
              >
                {options.confirmText ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
