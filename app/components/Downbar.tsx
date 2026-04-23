"use client";

import React from 'react';
import { WorkspaceId } from '../lib/workspaces';

interface DownbarProps {
  activeWorkspace: WorkspaceId;
  onSelectWorkspace: (id: WorkspaceId) => void;
  onNewChat: () => void;
}

export default function Downbar({
  activeWorkspace,
  onSelectWorkspace,
  onNewChat,
}: DownbarProps) {
  const workspaces: { id: WorkspaceId; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "conversations", label: "Chat", color: "#10b981", icon: (
      <svg viewBox="0 0 24 24"><path d="M7 8h10"></path><path d="M7 12h7"></path><path d="M7 16h5"></path><rect x="4" y="5" width="16" height="14" rx="4"></rect></svg>
    )},
    { id: "skills", label: "Skills", color: "#8b5cf6", icon: (
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
    )},
    { id: "files", label: "Arquivos", color: "#f59e0b", icon: (
      <svg viewBox="0 0 24 24"><path d="M4 7h6l2 2h8v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path><path d="M4 7a2 2 0 0 1 2-2h4l2 2"></path></svg>
    )},
    { id: "coordinator", label: "Workflow", color: "#3b82f6", icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>
    )},
    { id: "monitor", label: "Monitor", color: "#8b5cf6", icon: (
      <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
    )},
    { id: "audit", label: "Audit", color: "#14b8a6", icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10"></path><path d="M7 12h10"></path><path d="M7 16h10"></path></svg>
    )},
    { id: "coordination", label: "Empresa", color: "#ec4899", icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="2.5"></circle><circle cx="6" cy="16" r="2"></circle><circle cx="18" cy="16" r="2"></circle><path d="M12 9.5v2.5"></path><path d="M10 12h-3.5"></path><path d="M14 12h3.5"></path></svg>
    )},
    { id: "doutora-kitty", label: "Kitty", color: "#ec4899", icon: (
      <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"></path><path d="M12 6v12"></path><path d="M6 12h12"></path></svg>
    )},
    { id: "memory", label: "Memória", color: "#f97316", icon: (
      <svg viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 5 4 6 4 9h8c0-3 4-4 4-9a8 8 0 0 0-8-8z"></path><path d="M9 22h6"></path></svg>
    )},
    { id: "memory-graph", label: "Grafo", color: "#3b82f6", icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="18" r="3"></circle><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M9 9l6 6"></path><path d="M15 9l-6 6"></path></svg>
    )},
    { id: "agent-room", label: "Sala", color: "#f43f5e", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
    )},
  ];

  return (
    <nav className="downbar">
      <div className="downbar-inner">
        <div className="downbar-scroll">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              className={`downbar-item ${activeWorkspace === ws.id ? 'active' : ''}`}
              onClick={() => onSelectWorkspace(ws.id)}
              style={{ "--ws-color": ws.color } as React.CSSProperties}
            >
              <div className="downbar-icon">{ws.icon}</div>
              <span className="downbar-label">{ws.label}</span>
            </button>
          ))}
        </div>
        
        <button 
          className="downbar-item downbar-plus"
          onClick={onNewChat}
          title="Nova conversa"
        >
          <div className="downbar-icon-plus">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
          </div>
          <span className="downbar-label">Novo</span>
        </button>
      </div>
    </nav>
  );
}
