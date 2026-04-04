import { useEffect, useState } from "react";
import PingMonitor from "./PingMonitor";
import { useAuth } from "../lib/auth";
import { requestJson } from "../lib/api";

interface TopbarProps {
  title?: string;
  hasMessages?: boolean;
  onClearChat: () => void;
  onShareChat: () => void;
  onOpenSettings: () => void;
}

export default function Topbar({
  title = "Nova conversa",
  hasMessages = false,
  onClearChat,
  onShareChat,
  onOpenSettings,
}: TopbarProps) {
  const [fullAccess, setFullAccess] = useState(false);
  const [loadingFullAccess, setLoadingFullAccess] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    const loadStatus = async () => {
      try {
        setLoadingFullAccess(true);
        const data = await requestJson("/tools/status");
        setFullAccess(Boolean(data?.fullAccess));
      } catch (err) {
        console.error("Failed to load full access status:", err);
      } finally {
        setLoadingFullAccess(false);
      }
    };

    void loadStatus();

    const handleFullAccessChange = (event: Event) => {
      const detail = (event as CustomEvent<{ fullAccess?: boolean }>).detail;
      if (typeof detail?.fullAccess === "boolean") {
        setFullAccess(detail.fullAccess);
      }
    };

    window.addEventListener("chocks:full-access-changed", handleFullAccessChange);
    return () => {
      window.removeEventListener("chocks:full-access-changed", handleFullAccessChange);
    };
  }, []);

  const handleToggleFullAccess = async () => {
    const nextValue = !fullAccess;
    setFullAccess(nextValue);

    try {
      const response = await requestJson("/tools/toggle", {
        method: "POST",
        body: JSON.stringify({ name: "full_access", enabled: nextValue }),
      });
      const confirmedValue = Boolean(response?.settings?.fullAccess);
      setFullAccess(confirmedValue);
      window.dispatchEvent(new CustomEvent("chocks:full-access-changed", { detail: { fullAccess: confirmedValue } }));
    } catch (err) {
      console.error("Failed to toggle full access:", err);
      setFullAccess(!nextValue);
    }
  };

  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <PingMonitor />
      <div className="topbar-actions">
        <button
          className={`topbar-icon ${fullAccess ? "danger" : ""}`}
          type="button"
          title={`Acesso ao computador inteiro: ${fullAccess ? "ligado" : "desligado"}`}
          aria-pressed={fullAccess}
          disabled={loadingFullAccess}
          onClick={handleToggleFullAccess}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d={fullAccess ? "M7 11V7a5 5 0 0 1 9.9-1" : "M7 11V7a5 5 0 0 1 10 0v4"}></path>
          </svg>
        </button>
        {hasMessages && (
          <button className="topbar-icon" type="button" title="Compartilhar conversa" onClick={onShareChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <path d="M8.6 13.5l6.8 4"></path>
              <path d="M15.4 6.5l-6.8 4"></path>
            </svg>
          </button>
        )}
        {hasMessages && (
          <button className="topbar-icon" type="button" title="Limpar conversa" onClick={onClearChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 0-2 2H7a2 2 0 0 0-2-2V6"></path>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        )}
        <button className="topbar-icon" type="button" title="Abrir configuracoes" onClick={onOpenSettings}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="3.2"></circle>
            <path d="M6.5 18.5c1.6-2.7 3.5-4 5.5-4s3.9 1.3 5.5 4"></path>
          </svg>
        </button>
        <button className="topbar-icon danger" type="button" title="Sair" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
