import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import PingMonitor from "./PingMonitor";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/useTheme";
import { requestJson } from "../lib/api";

interface TopbarProps {
  title?: string;
  hasMessages?: boolean;
  onClearChat: () => void;
  onShareChat: () => void;
  onOpenSettings: () => void;
  onMenuToggle?: () => void;
  userName?: string;
  userAvatar?: string | null;
  isDesktop?: boolean;
}

export default function Topbar({
  title = "Nova conversa",
  hasMessages = false,
  onClearChat,
  onShareChat,
  onOpenSettings,
  onMenuToggle,
  userName,
  userAvatar,
  isDesktop = false,
}: TopbarProps) {
  const router = useRouter();
  const [fullAccess, setFullAccess] = useState(false);
  const [loadingFullAccess, setLoadingFullAccess] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

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

  const getInitials = (name?: string) => {
    if (!name) return "AD";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleProfileClick = () => {
    router.push("/profile");
    setIsMenuOpen(false);
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="topbar-menu-btn" onClick={onMenuToggle} title="Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="topbar-title">{title}</div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <PingMonitor />
      </div>

      <div className="topbar-actions" style={{ gap: '8px' }}>
        {userName && (
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className="topbar-user"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Menu do usuário"
              type="button"
            >
              <div className="topbar-user-badge" style={userAvatar ? {
                backgroundImage: `url('${userAvatar}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : undefined}>
                {!userAvatar && getInitials(userName)}
              </div>
              <div className="topbar-user-name">{userName}</div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, opacity: 0.5 }}>
                <path d="M6 9l6 6 6-6"></path>
              </svg>
            </button>

            {isMenuOpen && (
              <div className="topbar-user-menu">
                <div className="user-menu-header">
                  <div className="user-menu-header-name">{userName}</div>
                  {isDesktop && (
                    <div className="user-menu-header-badge">
                      DESKTOP {typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '(DEV)' : ''}
                    </div>
                  )}
                </div>

                <button className="user-menu-item" onClick={handleProfileClick}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  Meu Perfil
                </button>

                <button className="user-menu-item" onClick={() => { onOpenSettings(); setIsMenuOpen(false); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  Configurações
                </button>

                <div className="user-menu-divider" />

                <button className="user-menu-item" onClick={() => { toggleTheme(); setIsMenuOpen(false); }}>
                  {theme === 'dark' ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                      </svg>
                      Tema Escuro
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                      </svg>
                      Tema Claro
                    </>
                  )}
                </button>

                <button 
                  className={`user-menu-item ${fullAccess ? "active" : ""}`} 
                  onClick={() => { handleToggleFullAccess(); setIsMenuOpen(false); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: fullAccess ? 'var(--cost-danger)' : 'inherit' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d={fullAccess ? "M7 11V7a5 5 0 0 1 9.9-1" : "M7 11V7a5 5 0 0 1 10 0v4"}></path>
                  </svg>
                  Acesso Remoto: {fullAccess ? "LIGADO" : "DESLIGADO"}
                </button>

                {hasMessages && (
                  <>
                    <div className="user-menu-divider" />
                    <button className="user-menu-item" onClick={() => { onShareChat(); setIsMenuOpen(false); }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <path d="M8.6 13.5l6.8 4"></path>
                        <path d="M15.4 6.5l-6.8 4"></path>
                      </svg>
                      Compartilhar
                    </button>
                    <button className="user-menu-item" onClick={() => { onClearChat(); setIsMenuOpen(false); }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 0-2 2H7a2 2 0 0 0-2-2V6"></path>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Limpar Conversa
                    </button>
                  </>
                )}

                <div className="user-menu-divider" />
                <button className="user-menu-item danger" onClick={() => { logout(); setIsMenuOpen(false); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

