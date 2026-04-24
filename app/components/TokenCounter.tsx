import { useState, useEffect } from "react";
import { requestJson, Attachment, Message } from "../lib/api";

interface TokenCounterProps {
  prompt: string;
  attachments?: Attachment[];
  history?: Message[];
  selectedAgentId?: string;
  chatId?: string;
}

export default function TokenCounter({
  prompt,
  attachments = [],
  history = [],
  selectedAgentId = "chocks",
  chatId,
}: TokenCounterProps) {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastPayload, setLastPayload] = useState("");

  useEffect(() => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt && attachments.length === 0) {
      setCount(null);
      setLastPayload("");
      return;
    }

    // Construct a stable string representation of the current input to avoid redundant calls
    const currentPayload = JSON.stringify({
      prompt: trimmedPrompt,
      attachments: attachments.map(a => ({ name: a.name, size: a.content?.length })),
      history: history.map(m => ({ role: m.role, content: m.content })),
      selectedAgentId,
      chatId
    });

    if (currentPayload === lastPayload) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setLastPayload(currentPayload); // Mark as processed/processing
      try {
        // Construct the messages as they would be sent
        // User message with attachments formatted as text for count accuracy
        const attachmentText = attachments
          .map((attachment) => {
            const isImage = (attachment.content || "").startsWith("data:image/");
            const nameLine = `Arquivo anexado: ${attachment.name}${isImage ? " (Imagem)" : ""}`;
            const contentLine = (attachment.content && !isImage) ? `\n${attachment.content}` : "";
            return `${nameLine}${contentLine}`;
          })
          .join("\n\n");
        
        const fullUserContent = [trimmedPrompt, attachmentText].filter(Boolean).join("\n\n").trim();
        
        const messages = [
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: fullUserContent }
        ];

        const data = await requestJson("/chat/tokens/count", {
          method: "POST",
          body: JSON.stringify({
            messages,
            selectedAgentId,
            chatId,
          }),
        });

        if (data?.inputTokens !== undefined) {
          setCount(data.inputTokens);
        }
      } catch (err) {
        console.error("Token counting failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 1000); // Debounce of 1s to avoid excessive API calls

    return () => clearTimeout(timer);
  }, [prompt, attachments, history, selectedAgentId, chatId, lastPayload]);

  if (count === null && !isLoading) return null;

  return (
    <div className={`token-counter ${isLoading ? "loading" : ""}`}>
      <span className="token-icon">🪙</span>
      <span className="token-label">Tokens estimados:</span>
      <span className="token-value">{isLoading ? "..." : count?.toLocaleString()}</span>
      <style jsx>{`
        .token-counter {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--muted);
          padding: 4px 10px;
          border-radius: 100px;
          background: var(--surface-glass);
          border: 1px solid var(--line-soft);
          transition: all 0.2s ease;
          margin-top: 8px;
          width: fit-content;
        }
        .token-counter.loading {
          opacity: 0.7;
          animation: pulse 2s infinite;
        }
        .token-value {
          font-weight: 600;
          color: var(--text);
        }
        .token-icon {
          font-size: 12px;
          filter: grayscale(1) opacity(0.5);
        }
      `}</style>
    </div>
  );
}
