"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronUp, Download, FileText, Globe, PanelsTopLeft } from "lucide-react";

import { Artifact, extractWebSources, pickPrimaryArtifact } from "../lib/artifactDetection";
import { Message, TraceEntry, requestJson } from "../lib/api";
import { getAgentProfile } from "../lib/familyRouting";
import CodeBlock from "./CodeBlock";
import MessageFeedback from "./MessageFeedback";

type AgentProfile = {
  id: string;
  name: string;
  subtitle?: string;
  avatarSrc?: string;
  fallbackEmoji: string;
};

function getMemoryCaptureTrace(trace: TraceEntry[] | undefined) {
  if (!Array.isArray(trace)) return null;

  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const entry = trace[index];
    if (entry?.label !== "memory_capture" || entry?.state !== "complete") {
      continue;
    }

    const payload =
      entry.payload && typeof entry.payload === "object" ? (entry.payload as Record<string, unknown>) : null;
    const output =
      payload?.output && typeof payload.output === "object" ? (payload.output as Record<string, unknown>) : null;
    const savedPath = typeof output?.path === "string" ? output.path : "";
    const storage = typeof output?.storage === "string" ? output.storage : "";

    return {
      subtitle: entry.subtitle || "Memoria salva no Obsidian.",
      path: savedPath,
      storage,
    };
  }

  return null;
}

function getPdfTrace(trace: TraceEntry[] | undefined) {
  if (!Array.isArray(trace)) return null;

  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const entry = trace[index];
    if (entry?.label !== "pdf_report" || entry?.state !== "complete") {
      continue;
    }

    const payload =
      entry.payload && typeof entry.payload === "object" ? (entry.payload as Record<string, unknown>) : null;
    const output =
      payload?.output && typeof payload.output === "object" ? (payload.output as Record<string, unknown>) : null;
    const savedPath = typeof output?.path === "string" ? output.path : "";
    if (!savedPath) continue;

    return {
      path: savedPath,
      fallback: Boolean(output?.fallback),
      message: typeof output?.message === "string" ? output.message : "PDF gerado com sucesso.",
    };
  }

  return null;
}

function SourcesList({ trace }: { trace?: TraceEntry[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sources = extractWebSources(trace);

  if (sources.length === 0) return null;

  return (
    <div className={`artifact-sources-container ${isExpanded ? "is-expanded" : ""}`}>
      <button
        type="button"
        className="artifact-sources-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Recolher fontes" : "Ver fontes consultadas"}
      >
        <div className="artifact-sources-title-group">
          <Globe size={14} className="artifact-sources-icon" />
          <span className="artifact-sources-title">Fontes Consultadas</span>
          <span className="artifact-sources-count">{sources.length} {sources.length === 1 ? "fonte" : "fontes"}</span>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="artifact-sources-list">
          {sources.map((source, index) => (
            <div key={`${source.url}-${index}`} className="artifact-source-item">
              <div className="artifact-source-index">[{index + 1}]</div>
              <div className="artifact-source-content">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="artifact-source-link"
                >
                  {source.title}
                </a>
                {source.date && (
                  <span className="artifact-source-date">{source.date}</span>
                )}
                {source.snippet && (
                  <div className="artifact-source-snippet">
                    {source.snippet.includes("**") ? (
                      <ReactMarkdown>{source.snippet}</ReactMarkdown>
                    ) : (
                      source.snippet
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildAgentProfile(agentId?: string | null) {
  const safeId = agentId?.trim() || "agente";
  const fallbackProfile = getAgentProfile(safeId);
  const displayName = safeId === "agente" ? "Agente" : fallbackProfile.name || safeId;
  const fallback = fallbackProfile.fallbackEmoji || displayName.slice(0, 1).toUpperCase() || "A";

  return {
    id: safeId,
    name: safeId === "agente" ? "Agente" : displayName,
    subtitle: safeId === "agente" ? "Aguardando..." : (fallbackProfile.subtitle || `ID ${safeId}`),
    avatarSrc: safeId === "agente" ? undefined : fallbackProfile.avatarSrc,
    fallbackEmoji: fallback,
  } satisfies AgentProfile;
}

function AgentFace({ agent, size, className }: { agent: AgentProfile; size: number; className?: string }) {
  if (agent.avatarSrc) {
    return <Image src={agent.avatarSrc} alt={agent.name} width={size} height={size} className={className} />;
  }

  return (
    <span className={`message-badge-fallback ${className || ""}`.trim()}>
      {agent.fallbackEmoji}
    </span>
  );
}

export default function MessageBubble({
  message,
  conversationId,
  onOpenArtifact,
  onPlayAudio,
}: {
  message: Message;
  conversationId?: string;
  onOpenArtifact?: (artifact: Artifact) => void;
  onPlayAudio?: () => void;
}) {
  const funnyActivities = useMemo(() => [
    "Comendo uns cookies delícia...",
    "Tomando um banho de espuma...",
    "Consultando o dicionário de palavras difíceis...",
    "Brincando de esconde-esconde com os dados...",
    "Desenhando a resposta com giz de cera...",
    "Limpando os óculos pra enxergar melhor...",
    "Dando um abraço no servidor...",
    "Apostando corrida com os bits...",
    "Procurando a resposta embaixo do tapete...",
    "Tomando um suquinho de laranja...",
    "Fazendo um aviãozinho de papel com o pedido...",
    "Contando até dez antes de responder...",
    "Pedindo um abraço pra Betinha...",
    "Tirando uma soneca de 5 segundos...",
    "Limpando a bota pra ficar bonito...",
    "Catando as palavras que caíram no chão..."
  ], []);

  const currentActivity = useMemo(() => {
    const seed = (message.id ? String(message.id).length : 0) + (message.content?.length || 0);
    return funnyActivities[seed % funnyActivities.length];
  }, [message.id, message.content, funnyActivities]);

  // 🚀 Resiliência de Identidade: Só mostra quem é o agente se houver conteúdo real
  // ou se o streaming terminou. Evita flicker de trocas de triagem rápidas.
  const isAgent = message.role === "agent";
  const showWorkingState = isAgent && message.streaming && (!message.content || message.content.length < 5);

  const agentProfile = buildAgentProfile(message.agentId);
  const helperAgentProfile = message.helperAgentId ? buildAgentProfile(message.helperAgentId) : null;
  const memoryNotice = isAgent ? getMemoryCaptureTrace(message.trace) : null;
  const pdfNotice = isAgent ? getPdfTrace(message.trace) : null;
  const primaryArtifact = isAgent ? pickPrimaryArtifact(message.content, message.trace) : null;
  const messageId = message.id ? String(message.id) : "";

  return (
    <div className={`message ${message.role} ${agentProfile.id ? `agent-${agentProfile.id}` : ""} ${message.streaming ? "is-streaming" : ""}`}>
      <div className="message-row">
        {isAgent && !showWorkingState && (
          <div className={`message-badge-group ${helperAgentProfile ? "with-helper" : ""}`}>
            {agentProfile.id !== "agente" ? (
              <div className="message-badge message-badge-primary" title={agentProfile.name}>
                <div className="message-badge-inner">
                  <AgentFace agent={agentProfile} size={40} />
                </div>
                {agentProfile.id === "pimpim" && <div className="agent-crown">👑</div>}
              </div>
            ) : (
              <div className="message-badge message-skeleton-badge" />
            )}
            {helperAgentProfile ? (
              <div className="message-badge message-badge-helper" title={`${helperAgentProfile.name} ajudando`}>
                <div className="message-badge-inner">
                  <AgentFace agent={helperAgentProfile} size={40} className="helper" />
                </div>
              </div>
            ) : null}
          </div>
        )}
        <div className="bubble">
          {isAgent && !showWorkingState && (
            <div className="chocks-header" style={{ opacity: agentProfile.id === "agente" ? 0.3 : 1 }}>
              <div className="agent-title-group">
                <span className="chocks-label">{agentProfile.name}</span>
                <span className="chocks-subtitle">{agentProfile.subtitle}</span>
              </div>
              {helperAgentProfile ? (
                <div className="agent-support-inline">
                  <span className="agent-support-label">com apoio de</span>
                  <span className="agent-support-name">{helperAgentProfile.name}</span>
                </div>
              ) : null}
              {messageId && conversationId && (
                <div className="bubble-feedback">
                  <MessageFeedback
                    messageId={messageId}
                    conversationId={conversationId}
                    onPlayAudio={onPlayAudio}
                    initialFeedback={message.feedback ?? null}
                    onSubmitFeedback={async (feedback) => {
                      try {
                        await requestJson("/chat/feedback", {
                          method: "POST",
                          body: JSON.stringify({
                            messageId: messageId,
                            conversationId: conversationId,
                            feedback,
                            feedbackText: null,
                          }),
                        });
                      } catch (error) {
                        console.error("Failed to submit feedback:", error);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {isAgent && message.handoffLabel ? <div className="agent-handoff">{message.handoffLabel}</div> : null}
          {isAgent && message.collaborationLabel ? <div className="agent-collaboration">{message.collaborationLabel}</div> : null}

          {showWorkingState ? (
            <div className="agent-working-panel generic-thinking">
              {agentProfile.id !== "agente" && (
                <div className="agent-working-avatars">
                  <div className="agent-working-avatar primary">
                    <AgentFace agent={agentProfile} size={34} />
                  </div>
                  {helperAgentProfile ? (
                    <div className="agent-working-avatar secondary">
                      <AgentFace agent={helperAgentProfile} size={30} />
                    </div>
                  ) : null}
                </div>
              )}
              <div className="agent-working-copy">
                <div className="agent-working-title">
                  {agentProfile.id === "agente" 
                    ? "Pensando..." 
                    : (helperAgentProfile
                       ? `${agentProfile.name} e ${helperAgentProfile.name} estao trabalhando`
                       : `${agentProfile.name} esta trabalhando`)}
                </div>
                {agentProfile.id !== "agente" && (
                  <div className="agent-working-subtitle">
                    {currentActivity}
                  </div>
                )}
                <div className="agent-working-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          ) : null}

          {memoryNotice && (
            <div className="memory-notice">
              <div className="memory-notice-title">
                {memoryNotice.storage === "database" ? "Memoria registrada no banco" : "Memoria registrada"}
              </div>
              <div className="memory-notice-copy">
                {memoryNotice.subtitle}
                {memoryNotice.path ? ` (${memoryNotice.path})` : ""}
              </div>
            </div>
          )}

          {pdfNotice ? (
            <div className="pdf-download-card">
              <div className="pdf-download-meta">
                <div className="pdf-download-icon">
                  <FileText size={16} />
                </div>
                <div className="pdf-download-copy">
                  <div className="pdf-download-title">PDF pronto para baixar</div>
                  <div className="pdf-download-subtitle">{pdfNotice.message}</div>
                </div>
              </div>
              <a
                className="pdf-download-button"
                href={`/api/files/download?path=${encodeURIComponent(pdfNotice.path)}`}
              >
                <Download size={14} />
                <span>Baixar PDF</span>
              </a>
            </div>
          ) : null}

          {!showWorkingState ? (
            <div className="message-markdown">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const language = className?.replace("language-", "") || "";
                    const code = String(children).replace(/\n$/, "");
                    const isInline = !className && !code.includes("\n");

                    if (isInline) {
                      return (
                        <code {...props}>
                          {children}
                        </code>
                      );
                    }

                    return (
                      <CodeBlock
                        code={code}
                        language={language}
                        onOpenArtifact={onOpenArtifact}
                      />
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : null}

          {primaryArtifact && onOpenArtifact ? (
            <button type="button" className="artifact-trigger" onClick={() => onOpenArtifact(primaryArtifact)}>
              <PanelsTopLeft size={14} />
              <span>Abrir no painel</span>
            </button>
          ) : null}

          {message.streaming && !showWorkingState && <span className="streaming-dot">...</span>}

          {Array.isArray(message.attachments) && message.attachments.length > 0 && (
            <div className="bubble-attachments">
              {message.attachments.map((attachment, index) => (
                <div key={`${attachment.name}-${index}`} className="bubble-attachment">
                  <span>Arquivo</span>
                  <span>{attachment.name}</span>
                </div>
              ))}
            </div>
          )}

          <SourcesList trace={message.trace} />
        </div>
      </div>
    </div>
  );
}
