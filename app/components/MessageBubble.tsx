"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { Download, FileText, PanelsTopLeft } from "lucide-react";

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
  const sources = extractWebSources(trace);
  if (sources.length === 0) return null;

  return (
    <div className="artifact-sources">
      <div className="artifact-sources-title">Sources</div>
      {sources.map((source, index) => (
        <div key={`${source.url}-${index}`} className="artifact-source-item">
          <a href={source.url} target="_blank" rel="noreferrer">
            [{index + 1}] {source.title}
          </a>
          {source.date ? <div className="artifact-source-snippet">{source.date}</div> : null}
          {source.snippet ? <div className="artifact-source-snippet">{source.snippet}</div> : null}
        </div>
      ))}
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
    name: displayName,
    subtitle: fallbackProfile.subtitle || (safeId === "agente" ? "Agente" : `ID ${safeId}`),
    avatarSrc: fallbackProfile.avatarSrc,
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
}: {
  message: Message;
  conversationId?: string;
  onOpenArtifact?: (artifact: Artifact) => void;
}) {
  const isAgent = message.role === "agent";
  const agentProfile = buildAgentProfile(message.agentId);
  const helperAgentProfile = message.helperAgentId ? buildAgentProfile(message.helperAgentId) : null;
  const memoryNotice = isAgent ? getMemoryCaptureTrace(message.trace) : null;
  const pdfNotice = isAgent ? getPdfTrace(message.trace) : null;
  const primaryArtifact = isAgent ? pickPrimaryArtifact(message.content, message.trace) : null;
  const showWorkingState = isAgent && message.streaming && !message.content.trim();
  
  const messageId = message.id ? String(message.id) : "";

  return (
    <div className={`message ${message.role} ${message.streaming ? "is-streaming" : ""}`}>
      <div className="message-row">
        {isAgent && (
          <div className={`message-badge-group ${helperAgentProfile ? "with-helper" : ""}`}>
            <div className="message-badge message-badge-primary" title={agentProfile.name}>
              <div className="message-badge-inner">
                <AgentFace agent={agentProfile} size={40} />
              </div>
            </div>
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
          {isAgent && (
            <div className="chocks-header">
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
            <div className="agent-working-panel">
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
              <div className="agent-working-copy">
                <div className="agent-working-title">
                  {helperAgentProfile
                    ? `${agentProfile.name} e ${helperAgentProfile.name} estao trabalhando nisso`
                    : `${agentProfile.name} esta trabalhando nisso`}
                </div>
                <div className="agent-working-subtitle">
                  {helperAgentProfile
                    ? `${agentProfile.name} puxou a resposta e ${helperAgentProfile.name} entrou como apoio especialista.`
                    : `Analisando o pedido e montando a resposta.`}
                </div>
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
