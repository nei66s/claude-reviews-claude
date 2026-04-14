"use client";

import { X } from "lucide-react";

import { useToast } from "../hooks/useToast";

export default function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card ${toast.tone}`}>
          <div className="toast-copy">
            <div className="toast-title">{toast.title}</div>
            {toast.description ? <div className="toast-description">{toast.description}</div> : null}
          </div>
          <button
            type="button"
            className="toast-dismiss"
            onClick={() => dismissToast(toast.id)}
            aria-label="Fechar notificação"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
