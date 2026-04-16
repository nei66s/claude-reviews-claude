"use client";

import Image from "next/image";
import { Chat } from "../lib/api";
import { useMemo, useState } from "react";
import { WorkspaceId } from "../lib/workspaces";
import ChubakaHungerBar from "./ChubakaHungerBar";

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
  hungerLevel?: number;
  onFeedChubaka?: () => void;
  isSleeping?: boolean;
  onSleep?: () => void;
  onWakeUp?: () => void;
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
  onSelectWorkspace,
  hungerLevel = 0,
  onFeedChubaka,
  isSleeping = false,
  onSleep,
  onWakeUp
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return conversations;
    return conversations.filter((chat) => chat.title.toLowerCase().includes(normalizedQuery));
  }, [conversations, searchQuery]);

  const workspaces: { id: WorkspaceId; label: string; icon: React.ReactNode; color: string; emoji: string }[] = [
    { id: "conversations", label: "Conversas", color: "#10b981", emoji: "💬", icon: (
      <svg viewBox="0 0 24 24"><path d="M7 8h10"></path><path d="M7 12h7"></path><path d="M7 16h5"></path><rect x="4" y="5" width="16" height="14" rx="4"></rect></svg>
    )},
    { id: "code", label: "Ferramentas", color: "#f43f5e", emoji: "🔌", icon: (
      <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path><polyline points="3 12 12 12 12 18"></polyline><line x1="9" y1="6" x2="9" y2="10"></line><line x1="15" y1="6" x2="15" y2="10"></line></svg>
    )},
    { id: "files", label: "Arquivos", color: "#f59e0b", emoji: "📁", icon: (
      <svg viewBox="0 0 24 24"><path d="M4 7h6l2 2h8v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M4 7a2 2 0 0 1 2-2h4l2 2"></path></svg>
    )},
    { id: "coordinator", label: "Fluxo de Trabalho", color: "#3b82f6", emoji: "⚙️", icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>
    )},
    { id: "monitor", label: "Monitor", color: "#8b5cf6", emoji: "📊", icon: (
      <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
    )},
    { id: "audit", label: "Auditoria", color: "#14b8a6", emoji: "📜", icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10"></path><path d="M7 12h10"></path><path d="M7 16h10"></path></svg>
    )},
    { id: "coordination", label: "Coordenação", color: "#ec4899", emoji: "🎯", icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="2.5"></circle><circle cx="6" cy="16" r="2"></circle><circle cx="18" cy="16" r="2"></circle><path d="M12 9.5v2.5"></path><path d="M10 12h-3.5"></path><path d="M14 12h3.5"></path></svg>
    )},
    { id: "doutora-kitty", label: "Doutora Kitty", color: "#ec4899", emoji: "🩺", icon: (
      <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"></path><path d="M12 6v12"></path><path d="M6 12h12"></path></svg>
    )}
  ];

  return (
    <aside className="sidebar-v2">
      {/* Brand */}
      <div className="sidebar-v2-brand">
        <div className="sidebar-v2-brand-left">
          <div className="sidebar-v2-avatar">
            <Image
              src="/chocks-avatar-face.jpg"
              alt="Chocks"
              width={36}
              height={36}
              priority
              sizes="36px"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "52% 45%" }}
            />
          </div>
          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <span className="sidebar-v2-brand-name">Chocks</span>
              <span style={{ fontSize: "9px", color: "var(--muted-soft)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold" }}>by Pimpotasma</span>
            </div>
          )}
        </div>
        <button className="sidebar-v2-collapse-btn" onClick={onToggle} title={collapsed ? "Expandir" : "Recolher"}>
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ transform: collapsed ? "scaleX(-1)" : "none" }}>
            <rect x="3.5" y="5" width="17" height="14" rx="2.4"></rect>
            <path d="M9 5v14"></path>
            <path d="M14 9l3 3-3 3"></path>
          </svg>
        </button>
      </div>

      {/* Workspaces */}
      <div className="sidebar-v2-nav">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            className={`sidebar-v2-nav-item ${activeWorkspace === ws.id ? 'active' : ''}`}
            onClick={() => onSelectWorkspace(ws.id)}
            title={ws.label}
            style={{ "--ws-color": ws.color } as React.CSSProperties}
          >
            <div className="sidebar-v2-nav-icon">{ws.icon}</div>
            {!collapsed && <span className="sidebar-v2-nav-label">{ws.label}</span>}
            {!collapsed && activeWorkspace === ws.id && (
              <span className="sidebar-v2-nav-active-dot" />
            )}
          </button>
        ))}
      </div>

      {/* New Chat + Search */}
      <div className="sidebar-v2-actions">
        <button
          type="button"
          className="sidebar-v2-new-chat"
          onClick={onNewChat}
          title="Nova conversa"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14"></path>
            <path d="M5 12h14"></path>
          </svg>
          {!collapsed && <span>Nova conversa</span>}
        </button>
        {!collapsed && (
          <input
            type="text"
            className="sidebar-v2-search"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        )}
      </div>

      {/* Conversations */}
      <div className="sidebar-v2-conversations">
        {!collapsed && (
          <div className="sidebar-v2-section-label">Recentes</div>
        )}
        <div className="sidebar-v2-conv-list">
          {filteredConversations.length === 0 ? (
            !collapsed && <div className="sidebar-v2-empty">Nenhuma conversa</div>
          ) : (
            filteredConversations.map((chat) => (
              <div
                key={chat.id}
                className={`sidebar-v2-conv-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectChat(chat);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="sidebar-v2-conv-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <div className="sidebar-v2-conv-title">
                  {chat.title}
                </div>
                {!collapsed && (
                  <div className="sidebar-v2-conv-actions">
                    <button
                      type="button"
                      title="Renomear"
                      onClick={(event) => {
                        event.stopPropagation();
                        const nextTitle = window.prompt("Novo nome da conversa:", chat.title);
                        if (nextTitle?.trim()) {
                          onRenameChat(chat.id, nextTitle);
                        }
                      }}
                      className="sidebar-v2-conv-action-btn"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Duplicar"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicateChat(chat.id);
                      }}
                      className="sidebar-v2-conv-action-btn"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                        <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Apagar"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      className="sidebar-v2-conv-action-btn danger"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                        <path d="M3 6h18"></path>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Profile Footer */}
      <div className="sidebar-v2-footer">
        {/* Chubaka Hunger Bar */}
        {!collapsed && (
          <div style={{ marginBottom: "12px" }}>
            <ChubakaHungerBar 
              hungerLevel={hungerLevel} 
              onFeed={onFeedChubaka}
              compact={true}
              isSleeping={isSleeping}
              onSleep={onSleep}
              onWakeUp={onWakeUp}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
