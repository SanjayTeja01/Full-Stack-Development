"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastItem = { id: number; tone: "success" | "error" | "info"; message: string };
type ToastApi = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };

const ToastContext = React.createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const remove = React.useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const push = React.useCallback(
    (tone: ToastItem["tone"], message: string) => {
      const id = Date.now() + Math.random();
      setItems((all) => [...all.slice(-3), { id, tone, message }]);
      setTimeout(() => remove(id), tone === "error" ? 8000 : 4500);
    },
    [remove],
  );
  const api = React.useMemo<ToastApi>(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m) }),
    [push],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-md border bg-card p-3 text-sm shadow-lg",
              t.tone === "error" ? "border-danger/40" : "border-border",
            )}
          >
            {t.tone === "error" ? <AlertCircle className="mt-0.5 size-4 text-danger" /> : <CheckCircle2 className="mt-0.5 size-4 text-primary" />}
            <p className="flex-1">{t.message}</p>
            <button type="button" aria-label="Dismiss" onClick={() => remove(t.id)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
