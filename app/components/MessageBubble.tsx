"use client";

import Image from "next/image";
import { Message, TraceEntry } from "../lib/api";

function formatToolName(label?: string) {
  const map: Record<string, string> = {
    file_read: "li um arquivo",
    ls_safe: "olhei uma pasta",
    file_write: "editei um arquivo",
    directory_create: "criei uma pasta",
    file_move: "movi um item",
    file_copy: "copiei um item",
    file_delete: "removi um item",
    workflow_get: "consultei o plano",
    workflow_replace: "montei um plano",
    workflow_update_step: "atualizei uma etapa do plano",
    workflow_clear: "limpei o plano",
  };

  return map[label || ""] || `usei ${label || "uma ferramenta"}`;
}

function formatState(state?: TraceEntry["state"]) {
  if (state === "error") return "nao deu certo";
  if (state === "pending") return "em andamento";
  return "concluido";
}

function summarizePayload(entry: TraceEntry) {
  if (!entry.payload || typeof entry.payload !== "object") {
    return null;
  }

  const payload = entry.payload as Record<string, unknown>;
  const output = payload.output;
  const args =
    payload.arguments && typeof payload.arguments === "string"
      ? payload.arguments
      : null;

  if (entry.state === "error") {
    if (output && typeof output === "object" && typeof (output as Record<string, unknown>).error === "string") {
      return String((output as Record<string, unknown>).error);
    }
    return "Encontrei um problema ao executar essa etapa.";
  }

  if (entry.label === "file_read" && args) {
    try {
      const parsed = JSON.parse(args) as Record<string, unknown>;
      if (typeof parsed.path === "string" && parsed.path.trim()) {
        return `Arquivo consultado: ${parsed.path}`;
      }
    } catch {}
  }

  if (entry.label === "ls_safe" && args) {
    try {
      const parsed = JSON.parse(args) as Record<string, unknown>;
      if (typeof parsed.path === "string" && parsed.path.trim()) {
        return `Pasta consultada: ${parsed.path}`;
      }
    } catch {}
  }

  if ((entry.label === "file_write" || entry.label === "directory_create" || entry.label === "file_delete") && args) {
    try {
      const parsed = JSON.parse(args) as Record<string, unknown>;
      if (typeof parsed.path === "string" && parsed.path.trim()) {
        return `Destino: ${parsed.path}`;
      }
    } catch {}
  }

  if ((entry.label === "file_move" || entry.label === "file_copy") && args) {
    try {
      const parsed = JSON.parse(args) as Record<string, unknown>;
      const fromPath = typeof parsed.from_path === "string" ? parsed.from_path : "";
      const toPath = typeof parsed.to_path === "string" ? parsed.to_path : "";
      if (fromPath || toPath) {
        return `De ${fromPath || "origem"} para ${toPath || "destino"}`;
      }
    } catch {}
  }

  return entry.subtitle || "Etapa interna usada para montar a resposta.";
}

function renderReasoningEntry(entry: TraceEntry, index: number) {
  const titleBase = formatToolName(entry.label);
  const summary = summarizePayload(entry);

  return (
    <details key={`${entry.label || entry.type || "trace"}-${index}`} className="reasoning-card">
      <summary className="reasoning-card-summary">
        <div className="reasoning-card-copy">
          <span className="reasoning-card-title">{titleBase}</span>
          {summary && <span className="reasoning-card-subtitle">{summary}</span>}
        </div>
        <span className={`reasoning-state ${entry.state || "complete"}`}>{formatState(entry.state)}</span>
      </summary>
      <div className="reasoning-card-body">
        {entry.subtitle && <div className="reasoning-card-note">{entry.subtitle.replaceAll("tool", "ferramenta")}</div>}
        {entry.payload !== undefined && (
          <pre className="reasoning-card-pre">{JSON.stringify(entry.payload, null, 2)}</pre>
        )}
      </div>
    </details>
  );
}

export default function MessageBubble({ message }: { message: Message }) {
  const isAgent = message.role === "agent";
  const avatarSrc = "/chocks-avatar-face.jpg";
  
  return (
    <div className={`message ${message.role} ${message.streaming ? "is-streaming" : ""}`}>
      <div className="message-row">
        {isAgent && (
          <div className="message-badge">
            <Image src={avatarSrc} alt={message.role} width={40} height={40} />
          </div>
        )}
        <div className="bubble">
          {message.content}
          {message.streaming && <span className="streaming-dot">...</span>}
          {isAgent && Array.isArray(message.trace) && message.trace.length > 0 && (
            <details className="reasoning">
              <summary className="reasoning-summary">
                <span>Ver como cheguei nessa resposta</span>
                <span className="reasoning-count">{message.trace.length} etapas</span>
              </summary>
              <div className="reasoning-list">
                {message.trace.map((entry, index) => renderReasoningEntry(entry, index))}
              </div>
            </details>
          )}
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
        </div>
      </div>
    </div>
  );
}
