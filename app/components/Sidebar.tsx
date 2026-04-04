"use client";

import Image from "next/image";
import { Chat } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useMemo, useState } from "react";
import { WorkspaceId } from "../lib/workspaces";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  conversations?: Chat[];
  activeChatId?: string;
  onSelectChat: (chat: Chat) => void;
  onDuplicateChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => void;
  onNewChat: () => void;
  activeWorkspace: WorkspaceId;
  onSelectWorkspace: (id: WorkspaceId) => void;
}

export default function Sidebar({ 
  collapsed, 
  onToggle, 
  conversations = [], 
  activeChatId, 
  onSelectChat,
  onDuplicateChat,
  onDeleteChat,
  onRenameChat,
  onNewChat,
  activeWorkspace,
  onSelectWorkspace
}: SidebarProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return conversations;
    return conversations.filter((chat) => chat.title.toLowerCase().includes(normalizedQuery));
  }, [conversations, searchQuery]);

  const getInitials = (name?: string) => {
    if (!name) return "AD";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const workspaces: { id: WorkspaceId; label: string; icon: React.ReactNode }[] = [
    { id: "conversations", label: "Conversas", icon: (
      <svg viewBox="0 0 24 24"><path d="M7 8h10"></path><path d="M7 12h7"></path><path d="M7 16h5"></path><rect x="4" y="5" width="16" height="14" rx="4"></rect></svg>
    )},
    { id: "code", label: "Ferramentas", icon: (
      <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path><polyline points="3 12 12 12 12 18"></polyline><line x1="9" y1="6" x2="9" y2="10"></line><line x1="15" y1="6" x2="15" y2="10"></line></svg>
    )},
    { id: "files", label: "Arquivos", icon: (
      <svg viewBox="0 0 24 24"><path d="M4 7h6l2 2h8v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M4 7a2 2 0 0 1 2-2h4l2 2"></path></svg>
    )},
    { id: "coordinator", label: "Workflow", icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>
    )},
    { id: "monitor", label: "Monitor", icon: (
      <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
    )},
    { id: "swarm", label: "Swarm", icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="2.2"></circle><circle cx="7" cy="16" r="2"></circle><circle cx="17" cy="16" r="2"></circle><path d="M12 9.5v2.8"></path><path d="M12 12.3h-5"></path><path d="M12 12.3h5"></path></svg>
    )},
    { id: "audit", label: "Audit", icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10"></path><path d="M7 12h10"></path><path d="M7 16h10"></path></svg>
    )}
  ];

  return (
    <aside className="sidebar-container">
      <div className="brand-row" style={{ height: "64px", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="brand-badge" style={{ width: "32px", height: "32px", borderRadius: "50%", overflow: "hidden" }}>
            <Image
              src="/chocks-avatar-face.jpg"
              alt="Chocks"
              width={32}
              height={32}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "52% 45%" }}
            />
          </div>
          {!collapsed && <div className="brand-name" style={{ fontWeight: "700" }}>Chocks</div>}
        </div>
        <button className="brand-icon" onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <svg viewBox="0 0 24 24" width="20" height="20" style={{ transform: collapsed ? "scaleX(-1)" : "none" }}>
            <rect x="3.5" y="5" width="17" height="14" rx="2.4"></rect>
            <path d="M9 5v14"></path>
            <path d="M14 9l3 3-3 3"></path>
          </svg>
        </button>
      </div>

      <div className="workspace-list" style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            className={`workspace-item ${activeWorkspace === ws.id ? 'active' : ''}`}
            onClick={() => onSelectWorkspace(ws.id)}
            title={ws.label}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", color: "var(--text-dim)", transition: "all 0.2s", background: "none", border: "none", cursor: "pointer" }}
          >
            <div className="workspace-icon" style={{ width: "20px", height: "20px" }}>{ws.icon}</div>
            {!collapsed && <span style={{ fontSize: "14px", fontWeight: "500" }}>{ws.label}</span>}
          </button>
        ))}
      </div>

      <div className="recent-section" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "16px 12px 8px" }}>
          <button
            type="button"
            className="new-chat-button"
            onClick={onNewChat}
            title="Nova conversa"
            style={{
              width: "100%",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: "10px",
              padding: collapsed ? "10px" : "12px 14px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--text)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14"></path>
              <path d="M5 12h14"></path>
            </svg>
            {!collapsed && <span style={{ fontSize: "14px", fontWeight: "600" }}>Nova conversa</span>}
          </button>
        </div>
        {!collapsed && (
          <div style={{ padding: "0 12px 8px" }}>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        )}
        {!collapsed && (
          <div className="section-header" style={{ padding: "20px 24px 8px", fontSize: "12px", fontWeight: "600", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Recentes
          </div>
        )}
        <div className="recent-list" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 12px 12px" }}>
          {filteredConversations.length === 0 ? (
            !collapsed && <div className="sidebar-empty" style={{ padding: "24px", fontSize: "13px", color: "var(--text-dim)", textAlign: "center" }}>Nenhuma conversa</div>
          ) : (
            filteredConversations.map((chat) => (
              <div
                key={chat.id}
                className={`recent-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectChat(chat);
                  }
                }}
                role="button"
                tabIndex={0}
                style={{ 
                  width: "100%", 
                  padding: "10px 14px", 
                  borderRadius: "10px", 
                  marginBottom: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: "12px",
                  transition: "all 0.2s",
                  border: "none",
                  backgroundColor: activeChatId === chat.id ? "var(--sidebar-item-active)" : "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  color: activeChatId === chat.id ? "var(--accent)" : "var(--text)",
                  textAlign: "left"
                }}
              >
                <div className="recent-item-icon" style={{ width: "16px", height: "16px", flexShrink: 0, opacity: 0.6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div className="recent-item-title" style={{ fontSize: "14px", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {chat.title}
                </div>
                {!collapsed && (
                  <button
                    type="button"
                    aria-label={`Renomear conversa ${chat.title}`}
                    title="Renomear"
                    onClick={(event) => {
                      event.stopPropagation();
                      const nextTitle = window.prompt("Novo nome da conversa:", chat.title);
                      if (nextTitle?.trim()) {
                        onRenameChat(chat.id, nextTitle);
                      }
                    }}
                    className="recent-delete"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-dim)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                    </svg>
                  </button>
                )}
                {!collapsed && (
                  <button
                    type="button"
                    aria-label={`Duplicar conversa ${chat.title}`}
                    title="Duplicar"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDuplicateChat(chat.id);
                    }}
                    className="recent-delete"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-dim)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                )}
                {!collapsed && (
                  <button
                    type="button"
                    aria-label={`Apagar conversa ${chat.title}`}
                    title="Apagar conversa"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onDeleteChat(chat.id);
                      }
                    }}
                    className="recent-delete"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-dim)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M3 6h18"></path>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="profile-footer" style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
        <div className="profile-card" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="profile-badge" style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold", color: "#fff" }}>
            {getInitials(user?.displayName)}
          </div>
          {!collapsed && (
            <div className="profile-info" style={{ minWidth: 0, flex: 1 }}>
              <div className="profile-name" style={{ fontSize: "13px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.displayName || "Admin Chocks"}
              </div>
              <div className="profile-plan" style={{ fontSize: "11px", color: "var(--text-dim)" }}>Plano local</div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .sidebar-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--sidebar);
          backdrop-filter: blur(14px);
          border-right: 1px solid var(--border);
          width: ${collapsed ? "80px" : "280px"};
          flex-shrink: 0;
          transition: width 0.2s;
        }
        .workspace-item:hover, .recent-item:hover {
          background-color: var(--sidebar-item-hover);
          color: var(--text);
        }
        .new-chat-button:hover,
        .new-chat-button:focus-visible {
          background: var(--sidebar-item-hover);
          border-color: rgba(255, 255, 255, 0.16);
          outline: none;
        }
        .workspace-item.active {
          background-color: var(--sidebar-item-active);
          color: var(--accent);
        }
        .recent-item.active .recent-item-title {
          color: var(--accent);
        }
        .recent-delete:hover,
        .recent-delete:focus-visible {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text);
          outline: none;
        }
        .workspace-icon svg {
          width: 100%;
          height: 100%;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
      `}</style>
    </aside>
  );
}
