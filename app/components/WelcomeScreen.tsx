"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { requestJson } from "../lib/api";
import { WorkspaceId } from "../lib/workspaces";
import { Attachment } from "../lib/api";
import ChocksIdentityCard from "./ChocksIdentityCard";
import PimpotasmaTeamCard from "./PimpotasmaTeamCard";
import { isTauri } from "../lib/desktop";
import TokenCounter from "./TokenCounter";

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
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  isRecording?: boolean;
  isProcessingAudio?: boolean;
  onStartRecord?: () => void;
  onStopRecord?: () => void;
  onCancelRecord?: () => void;
  isPlayingTTS?: boolean;
  onStopTTS?: () => void;
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
  onPaste,
  isRecording,
  isProcessingAudio,
  onStartRecord,
  onStopRecord,
  onCancelRecord,
  isPlayingTTS,
  onStopTTS,
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

  const osAutomations = [
    { icon: "🪟", label: "Lançar Aplicativos", desc: "Ex: 'abre o valorant'", action: () => onSetPrompt("abre o ") },
    { icon: "💻", label: "Controle de Janelas", desc: "Ex: 'minimiza tudo'", action: () => onSetPrompt("minimiza tudo") },
    { icon: "☀️", label: "Monitor e Temas", desc: "Ex: 'modo escuro'", action: () => onSetPrompt("ativa o modo escuro") },
    { icon: "📈", label: "Hardware e Energia", desc: "Ex: 'uso de ram'", action: () => onSetPrompt("como ta a memoria ram?") },
    { icon: "🗣️", label: "Voz e Áudio", desc: "Ex: 'fale: olá'", action: () => onSetPrompt("fale: ") },
    { icon: "📸", label: "Mágicas do Sistema", desc: "Ex: 'tira um print'", action: () => onSetPrompt("tira um print") },
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
                src="/chocks-v3.png"
                alt="Chocks by Pimpotasma"
                width={80}
                height={80}
                priority
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <StatusDot online={agentOnline} />
          </div>
          <div className="welcome-v2-hero-text">
            {/* Graffiti de invasão se o Urubu foi o último a falar */}
            {typeof window !== "undefined" && document.body.classList.contains("urubutopia-active") && (
              <>
                <div className="welcome-graffiti">HACKED BY URUBU</div>
                <div className="welcome-graffiti-small">CADE O MEU PIX?</div>
              </>
            )}
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
          <button className="welcome-v2-status-pill neutral interactable" onClick={() => onNavigate("skills")}>
            <span>⚡</span>
            <span>Ver Habilidades e Ferramentas</span>
          </button>
          <div className="welcome-v2-status-pill neutral hint" style={{ marginLeft: "auto" }}>
            <span>⌨️</span>
            <span>Ctrl+K</span>
          </div>
        </div>

        {/* Composer */}
        <div className="welcome-v2-composer">
          <div className="welcome-v2-composer-inner">
            <TokenCounter 
              prompt={prompt} 
              attachments={attachments} 
            />
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={onPromptChange}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder="Pergunte qualquer coisa ao agente... (use / para comandos rápidos)"
              rows={3}
            />
            {commandMenu}
            {attachments.length > 0 && (
              <div className="attachment-list">
                {attachments.map((att, i) => {
                  const isImage = (att.content || "").startsWith("data:image/");
                  return (
                    <div key={`${att.name}-${i}`} className={`attachment-chip ${isImage ? "has-preview" : ""}`}>
                      {isImage && (
                        <div className="attachment-preview">
                          <img src={att.content} alt={att.name} />
                        </div>
                      )}
                      <div className="attachment-details">
                        <span className="attachment-name">{att.name}</span>
                      </div>
                      <button className="attachment-remove" type="button" onClick={() => onRemoveAttachment(i)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  );
                })}
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

                {onStartRecord && (
                  <div className="audio-controls-wrap" style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "12px" }}>
                    {isRecording ? (
                      <>
                        <button className="welcome-v2-composer-action" type="button" onClick={onStopRecord} style={{ color: "red" }} title="Parar gravação">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                        </button>
                        <button className="welcome-v2-composer-action" type="button" onClick={onCancelRecord} title="Cancelar gravação">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                        <span className="welcome-v2-thinking">Gravando...</span>
                      </>
                    ) : (
                      <button className="welcome-v2-composer-action" type="button" onClick={onStartRecord} title="Gravar áudio" disabled={isProcessingAudio}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                          <line x1="12" y1="19" x2="12" y2="23"></line>
                          <line x1="8" y1="23" x2="16" y2="23"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {isPlayingTTS && (
                  <button className="welcome-v2-composer-action" type="button" onClick={onStopTTS} style={{ color: "#3b82f6", marginLeft: "12px" }} title="Parar áudio">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  </button>
                )}

                {isProcessingAudio && <span className="welcome-v2-thinking">Transcrevendo áudio...</span>}
                {isThinking && !isProcessingAudio && <span className="welcome-v2-thinking">Executando...</span>}
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

        {/* Agent Personality Card (Now below composer to save space) */}
        <div className="welcome-v2-agent-personality" style={{ marginBottom: "20px" }}>
          <ChocksIdentityCard />
          <PimpotasmaTeamCard />
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
