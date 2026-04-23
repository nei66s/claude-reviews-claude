"use client";

import { useEffect, useState } from "react";

export type ToastTone = "success" | "error" | "info" | "danger";

export type ToastMessage = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

const TOAST_EVENT = "chocks:toast";

export function showToast(input: Omit<ToastMessage, "id">) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<Omit<ToastMessage, "id">>(TOAST_EVENT, {
      detail: input,
    }),
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastMessage, "id">>).detail;
      if (!detail?.title) return;

      const toast: ToastMessage = {
        ...detail,
        id: crypto.randomUUID(),
      };

      setToasts((current) => [...current, toast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 3200);
    };

    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  };

  return {
    toasts,
    dismissToast,
  };
}
