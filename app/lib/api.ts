export interface TraceEntry {
  type?: string;
  label?: string;
  state?: "pending" | "complete" | "error";
  subtitle?: string;
  payload?: unknown;
}

export interface Attachment {
  name: string;
  content?: string;
  mimeType?: string;
}

export interface Message {
  id?: string; // ID da mensagem para feedback
  role: "user" | "agent" | "system";
  content: string;
  streaming?: boolean;
  trace?: TraceEntry[];
  attachments?: Attachment[];
  timestamp?: string;
  feedback?: "like" | "dislike" | null;
  agentId?: string;
  helperAgentId?: string;
  handoffLabel?: string;
  collaborationLabel?: string;
  /** Como a mensagem foi originada */
  inputMethod?: "text" | "voice" | "realtime_voice";
  /** Qual canal de transporte foi utilizado */
  transport?: "standard" | "realtime";
  /** ID de idempotência de turno (apenas para voz Realtime) */
  correlationId?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

function buildErrorMessage(response: Response, body: string) {
  const contentType = response.headers.get("content-type") || "";
  const trimmedBody = body.trim();

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(trimmedBody);
      if (typeof parsed?.error === "string" && parsed.error.trim()) {
        return parsed.error;
      }
      if (typeof parsed?.message === "string" && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      // Fall through to generic handling when backend returns invalid JSON.
    }
  }

  if (contentType.includes("text/html") || trimmedBody.startsWith("<!DOCTYPE html")) {
    return `API request failed with ${response.status} ${response.statusText}. The response looks like HTML, which often means the request hit the Next app (or an intermediate proxy) instead of the Chokito API. Check that the Chokito backend is running and that /api is correctly routed to it.`;
  }

  if (trimmedBody) {
    return trimmedBody;
  }

  return `${response.status} ${response.statusText}`;
}

export async function request(path: string, options: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `/api${path}`;
  
  const token = typeof window !== "undefined" ? localStorage.getItem("chocks_token") : null;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(buildErrorMessage(response, errorText));
  }

  return response;
}

export async function requestJson(path: string, options: RequestInit = {}) {
  const response = await request(path, options);
  return response.json();
}
