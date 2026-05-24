"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error";
}

const ToastContext = createContext<(message: string, tone?: "success" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.tone === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
