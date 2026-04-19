"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { requestJson } from "../lib/api";
import { WorkspaceId } from "../lib/workspaces";
import { Attachment } from "../lib/api";
import ChocksIdentityCard from "./ChocksIdentityCard";
import PimpotasmaTeamCard from "./PimpotasmaTeamCard";
import { isTauri } from "../lib/desktop";

interface WelcomeScreenProps {
  prompt: string;
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onOpenFilePicker: () => void;
  onNavigate: (ws: WorkspaceId) => void;
  onSetPrompt: (value: string) => void;
  isThinking: boolean;
  attachments: Attachment[];
  onRemoveAttachment: (index: number) => void;
  attachmentFeedback: string;
  attachmentError: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  commandMenu: React.ReactNode;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return { text: "Boa madrugada", emoji: "🌙" };
  if (h < 12) return { text: "Bom dia", emoji: "☀️" };
  if (h < 18) return { text: "Boa tarde", emoji: "🌤️" };
  return { text: "Boa noite", emoji: "🌙" };
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className={`ws-status-dot ${online ? "online" : "offline"}`} />
  );
}

export default function WelcomeScreen({
  prompt,
  onPromptChange,
  onKeyDown,
  onSend,
  onOpenFilePicker,
  onNavigate,
  onSetPrompt,
  isThinking,
  attachments,
  onRemoveAttachment,
  attachmentFeedback,
  attachmentError,
  textareaRef,
  commandMenu,
}: WelcomeScreenProps) {
  const greeting = getGreeting();
  const [agentOnline, setAgentOnline] = useState(false);
  const [toolsCount, setToolsCount] = useState(0);
  const [pluginsCount, setPluginsCount] = useState(0);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [healthData, toolsData, pluginsData] = await Promise.all([
          requestJson("/health").catch(() => null),
          requestJson("/tools/status").catch(() => null),
          requestJson("/plugins/list").catch(() => null),
        ]);
        setAgentOnline(!!healthData);
        if (Array.isArray(toolsData?.tools)) {
          // Contamos quantas tools estão realmente enabled no backend local
          setToolsCount(toolsData.tools.filter((t: { enabled: boolean }) => t.enabled).length);
        }
        if (Array.isArray(pluginsData?.plugins)) {
          setPluginsCount(pluginsData.plugins.filter((p: { enabled: boolean }) => p.enabled).length);
        }
      } catch {
        // silent
      }
    };
    checkStatus();
  }, []);

  const quickActions = [
    { icon: "💬", label: "Conversar", desc: "Chat livre com o agente", action: () => onSetPrompt("") },
    { icon: "📋", label: "Planejar", desc: "Monte um plano de tarefas", action: () => onSetPrompt("/plan ") },
    { icon: "🔍", label: "Pesquisar", desc: "Buscar informações", action: () => onSetPrompt("/search ") },
    { icon: "✨", label: "Criar", desc: "Novos arquivos e projetos", action: () => onSetPrompt("/new ") },
    { icon: "🔧", label: "Corrigir", desc: "Fix bugs e problemas", action: () => onSetPrompt("/fix ") },
    { icon: "💡", label: "Explicar", desc: "Explicar conceito ou código", action: () => onSetPrompt("/explain ") },
    { icon: "🤖", label: "Agentes", desc: "Criar time de agentes", action: () => onSetPrompt("/create-agents ") },
    { icon: "⚙️", label: "Workflow", desc: "Atribuir tarefas ao time", action: () => onSetPrompt("/create-workflow ") },
  ];

  const workspaceCards = [
    { icon: "📁", label: "Arquivos", desc: "Navegar e editar", ws: "files" as WorkspaceId, color: "#f59e0b" },
    { icon: "📊", label: "Monitor", desc: "Métricas do agente", ws: "monitor" as WorkspaceId, color: "#8b5cf6" },
    { icon: "📜", label: "Audit Log", desc: "Trail de operações", ws: "audit" as WorkspaceId, color: "#06b6d4" },
    { icon: "🔌", label: "Plugins", desc: "Ferramentas e extensões", ws: "code" as WorkspaceId, color: "#f43f5e" },
  ];

  return (
    <div className="view welcome-view-v2">
      <div className="welcome-v2-shell">
        {/* Hero Section */}
        <div className="welcome-v2-hero">
          <div className="welcome-v2-avatar-wrap">
            <div className="welcome-v2-avatar">
              <Image
                src="/chocks-avatar-face.jpg"
                alt="Chocks by Pimpotasma"
                width={80}
                height={80}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "52% 45%" }}
              />
            </div>
            <StatusDot online={agentOnline} />
          </div>
          <div className="welcome-v2-hero-text">
            <div className="welcome-v2-greeting">
              <span className="welcome-v2-greeting-emoji">{greeting.emoji}</span>
              {greeting.text}
            </div>
            <h1 className="welcome-v2-title">
              Como posso ajudar<br />
              <span className="welcome-v2-title-accent">hoje?</span>
            </h1>
          </div>
        </div>

        {/* Status Strip */}
        <div className="welcome-v2-status-strip">
          <div className={`welcome-v2-status-pill ${agentOnline ? "online" : "offline"}`}>
            <span className="welcome-v2-status-dot" />
            <span>{agentOnline ? "Agente online" : "Agente offline"}</span>
          </div>
          <div className="welcome-v2-status-pill neutral">
            <span>🛠️</span>
            <span>{toolsCount} tools ativas</span>
          </div>
          <div className="welcome-v2-status-pill neutral">
            <span>🔌</span>
            <span>{pluginsCount} plugins</span>
          </div>
          <div className="welcome-v2-status-pill neutral" style={{ borderColor: "rgba(139, 92, 246, 0.4)", color: "var(--text)" }}>
            <span>⚡</span>
            <span>Powered by <strong>Pimpotasma</strong></span>
          </div>
          <div className="welcome-v2-status-pill neutral hint">
            <span>⌨️</span>
            <span>Ctrl+K</span>
          </div>
        </div>

        {/* Agent Personality Card */}
        <div className="welcome-v2-agent-personality">
          <ChocksIdentityCard />
          <PimpotasmaTeamCard />
        </div>

        {/* Composer */}
        <div className="welcome-v2-composer">
          <div className="welcome-v2-composer-inner">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={onPromptChange}
              onKeyDown={onKeyDown}
              placeholder="Pergunte qualquer coisa ao agente... (use / para comandos rápidos)"
              rows={3}
            />
            {commandMenu}
            {attachments.length > 0 && (
              <div className="attachment-list">
                {attachments.map((att, i) => (
                  <div key={`${att.name}-${i}`} className="attachment-chip">
                    <span>{att.name}</span>
                    <button className="attachment-remove" type="button" onClick={() => onRemoveAttachment(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
            {attachmentFeedback && (
              <div className={`attachment-feedback ${attachmentError ? "error" : ""}`}>{attachmentFeedback}</div>
            )}
            <div className="welcome-v2-composer-bar">
              <div className="welcome-v2-composer-left">
                <button className="welcome-v2-composer-action" type="button" onClick={onOpenFilePicker} title="Anexar arquivo">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>

                {isThinking && <span className="welcome-v2-thinking">Executando...</span>}
              </div>
              <button
                className={`welcome-v2-composer-send ${isThinking ? "cancel" : ""}`}
                type="button"
                onClick={onSend}
              >
                {isThinking ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="welcome-v2-section">
          <div className="welcome-v2-section-label">Ações rápidas</div>
          <div className="welcome-v2-quick-grid">
            {quickActions.map((action) => (
              <button key={action.label} className="welcome-v2-quick-card" onClick={action.action} type="button">
                <span className="welcome-v2-quick-icon">{action.icon}</span>
                <div className="welcome-v2-quick-text">
                  <span className="welcome-v2-quick-label">{action.label}</span>
                  <span className="welcome-v2-quick-desc">{action.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Download Section (Visible only in Browser) */}
        {!isTauri() && (
          <div className="welcome-v2-section download-section">
             <div className="welcome-v2-section-label">Acesso Nativo</div>
             <a 
                href="https://pimpotasma.com.br/download/pimpotasma.exe" 
                className="welcome-v2-download-btn"
                title="Baixar versão nativa para Windows"
              >
                <div className="download-btn-content">
                  <div className="download-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </div>
                  <div className="download-btn-text">
                    <span className="download-btn-title">Baixar App Desktop</span>
                    <span className="download-btn-subtitle">Para Windows (Acesso nativo a arquivos e CMD)</span>
                  </div>
                </div>
              </a>
          </div>
        )}

        {/* Workspace Explore */}
        <div className="welcome-v2-section">
          <div className="welcome-v2-section-label">Explorar</div>
          <div className="welcome-v2-explore-grid">
            {workspaceCards.map((ws) => (
              <button
                key={ws.ws}
                className="welcome-v2-explore-card"
                onClick={() => onNavigate(ws.ws)}
                type="button"
                style={{ "--card-accent": ws.color } as React.CSSProperties}
              >
                <span className="welcome-v2-explore-icon">{ws.icon}</span>
                <span className="welcome-v2-explore-label">{ws.label}</span>
                <span className="welcome-v2-explore-desc">{ws.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
