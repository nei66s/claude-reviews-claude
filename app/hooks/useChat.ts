"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Attachment, Chat, Message, requestJson, TraceEntry } from "../lib/api";
import { getAgentProfile, triageAgentFromMessage } from "../lib/familyRouting";

const LOCAL_CHAT_CACHE_KEY = "chocks_conversations_cache_v1";

function readLocalConversations(): Chat[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(LOCAL_CHAT_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalConversations(conversations: Chat[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LOCAL_CHAT_CACHE_KEY, JSON.stringify(conversations));
  } catch {
    // Ignore local cache errors and keep the in-memory flow working.
  }
}

function mergeConversations(primary: Chat[], secondary: Chat[]) {
  const merged = new Map<string, Chat>();

  for (const chat of secondary) {
    if (!chat?.id) continue;
    merged.set(chat.id, chat);
  }

  for (const chat of primary) {
    if (!chat?.id) continue;
    const previous = merged.get(chat.id);
    if (!previous) {
      merged.set(chat.id, chat);
      continue;
    }

    const mergedMessages = Array.from({
      length: Math.max(chat.messages?.length || 0, previous.messages?.length || 0),
    }).map((_, index) => {
      const primaryMessage = chat.messages?.[index];
      const secondaryMessage = previous.messages?.[index];
      if (primaryMessage && secondaryMessage) {
        return { ...secondaryMessage, ...primaryMessage };
      }
      return primaryMessage ?? secondaryMessage;
    });

    merged.set(chat.id, {
      ...previous,
      ...chat,
      messages: mergedMessages.filter(Boolean) as Message[],
    });
  }

  return Array.from(merged.values());
}

function getLastAgentId(chat: Chat | null) {
  const messages = chat?.messages || [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "agent") {
      return message.agentId || "chocks";
    }
  }

  return "chocks";
}

export function useChat(enabled = true) {
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [conversations, setConversations] = useState<Chat[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const sendLockRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const persistConversation = useCallback(async (chat: Chat) => {
    await requestJson("/conversations", {
      method: "POST",
      body: JSON.stringify({ id: chat.id, title: chat.title }),
    });
  }, []);

  const loadConversations = useCallback(async () => {
    if (!enabled) return;

    try {
      const data = await requestJson("/conversations");
      const serverList = Array.isArray(data?.conversations) ? data.conversations : [];
      const list = mergeConversations(serverList, readLocalConversations());
      setConversations(list);
      setActiveChat((prev) => {
        if (!prev) {
          return list.length > 0 ? list[0] : null;
        }

        return list.find((item: Chat) => item.id === prev.id) ?? prev;
      });
    } catch (err) {
      console.error("Failed to load chats:", err);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setConversations([]);
      setActiveChat(null);
      return;
    }

    loadConversations();
  }, [enabled]);

  // Quando a conversa ativa muda, carregar o feedback - sem dependency em loadFeedbackForChat
  useEffect(() => {
    if (!activeChat?.id || !enabled) return;
    
    const loadFeedback = async () => {
      try {
        const data = await requestJson(`/chat/feedback/${encodeURIComponent(activeChat.id)}`);
        const feedbacks = data?.feedbacks || {};
        
        setActiveChat((prev) => {
          if (!prev || prev.id !== activeChat.id) return prev;
          
          const messagesWithFeedback = (prev.messages || []).map((message: Message) => {
            const messageIdStr = message.id ? String(message.id) : undefined;
            const feedbackData = messageIdStr ? feedbacks[messageIdStr] : undefined;
            
            if (feedbackData) {
              return {
                ...message,
                feedback: feedbackData.feedback,
                feedbackText: feedbackData.feedbackText,
              };
            }
            return message;
          });
          
          return {
            ...prev,
            messages: messagesWithFeedback,
          };
        });
      } catch (err) {
        console.debug("Failed to load feedback:", err);
      }
    };
    
    loadFeedback();
  }, [activeChat?.id, enabled]);

  // Sincronizar activeChat com o array de conversations
  useEffect(() => {
    if (!activeChat) return;

    setConversations((prev) => {
      const index = prev.findIndex((chat) => chat.id === activeChat.id);
      if (index === -1) {
        return [activeChat, ...prev];
      }

      const next = [...prev];
      next[index] = activeChat;
      return next;
    });
  }, [activeChat?.id]);

  // Persistir conversas no localStorage
  useEffect(() => {
    if (!enabled) return;
    writeLocalConversations(conversations);
  }, [conversations, enabled]);

  const selectChat = useCallback((chat: Chat) => {
    setActiveChat(chat);
  }, []);

  const createNewChat = useCallback(async () => {
    if (!enabled) return;

    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: "Nova conversa",
      messages: [],
    };

    try {
      setConversations((prev) => [newChat, ...prev]);
      setActiveChat(newChat);
      writeLocalConversations([newChat, ...conversations]);
      await persistConversation(newChat);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  }, [conversations, enabled, persistConversation]);

  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!enabled || !chatId) return;

      const previousConversations = conversations;
      const previousActiveChat = activeChat;
      const nextConversations = conversations.filter((chat) => chat.id !== chatId);
      const nextActiveChat =
        activeChat?.id === chatId ? nextConversations[0] ?? null : activeChat;

      setConversations(nextConversations);
      setActiveChat(nextActiveChat);

      try {
        await requestJson(`/conversations?id=${encodeURIComponent(chatId)}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to delete chat:", err);
        setConversations(previousConversations);
        setActiveChat(previousActiveChat);
        throw err;
      }
    },
    [activeChat, conversations, enabled],
  );

  const renameChat = useCallback(
    async (chatId: string, title: string) => {
      if (!enabled || !chatId || !title.trim()) return;

      const previousConversations = conversations;
      const previousActiveChat = activeChat;
      const nextConversations = conversations.map((chat) =>
        chat.id === chatId ? { ...chat, title: title.trim() } : chat,
      );
      const nextActiveChat =
        activeChat?.id === chatId ? { ...activeChat, title: title.trim() } : activeChat;

      setConversations(nextConversations);
      setActiveChat(nextActiveChat);

      try {
        await requestJson(`/conversations/${encodeURIComponent(chatId)}`, {
          method: "PATCH",
          body: JSON.stringify({ title: title.trim() }),
        });
      } catch (err) {
        console.error("Failed to rename chat:", err);
        setConversations(previousConversations);
        setActiveChat(previousActiveChat);
        throw err;
      }
    },
    [activeChat, conversations, enabled],
  );

  const duplicateChat = useCallback(
    async (chatId: string) => {
      if (!enabled || !chatId) return null;

      try {
        const data = await requestJson(`/conversations/${encodeURIComponent(chatId)}/duplicate`, {
          method: "POST",
        });
        const conversation = data?.conversation as Chat | undefined;
        if (!conversation) return null;

        setConversations((prev) => [conversation, ...prev]);
        setActiveChat(conversation);
        return conversation;
      } catch (err) {
        console.error("Failed to duplicate chat:", err);
        throw err;
      }
    },
    [enabled],
  );

  const cancelMessage = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (content: string, attachments: Attachment[] = []) => {
      if (!enabled) return;
      if (sendLockRef.current) return;

      const trimmedContent = content.trim();
      if (!trimmedContent && attachments.length === 0) return;

      sendLockRef.current = true;

      let chat = activeChat;

      if (!chat) {
        chat = {
          id: crypto.randomUUID(),
          title: "Nova conversa",
          messages: [],
        };

        setConversations((prev) => [chat as Chat, ...prev]);
        setActiveChat(chat);

        try {
          await persistConversation(chat);
        } catch (err) {
          console.error("Failed to create chat before sending:", err);
        }
      }

      const routingSource = [trimmedContent, ...attachments.map((attachment) => attachment.name)].filter(Boolean).join(" ");
      const previousAgentId = getLastAgentId(chat);
      const routing = triageAgentFromMessage(routingSource, previousAgentId);
      const selectedAgent = routing.primaryAgent;
      const helperAgent = routing.helperAgent;
      const userVisibleContent = routing.cleanedInput.trim();
      const visibleUserContent = userVisibleContent || trimmedContent || "[arquivo anexado]";
      const isFirstMessage = (chat.messages?.length || 0) === 0;
      const newTitle = isFirstMessage
        ? (visibleUserContent || attachments[0]?.name || "Nova conversa").substring(0, 30)
        : chat.title;
      const showHandoff = selectedAgent.id !== previousAgentId || (isFirstMessage && selectedAgent.id !== "chocks");

      const userMsg: Message = {
        role: "user",
        content: visibleUserContent,
        attachments: attachments.map((attachment) => ({ name: attachment.name, content: attachment.content })),
      };
      const initialAgentMsg: Message = {
        role: "agent",
        content: "",
        streaming: true,
        agentId: selectedAgent.id,
        helperAgentId: helperAgent?.id,
        handoffLabel: showHandoff ? `${selectedAgent.name} assumiu a conversa` : undefined,
        collaborationLabel: helperAgent ? `${selectedAgent.name} chamou ${helperAgent.name} para ajudar` : undefined,
      };
      const updatedMessages = [...(chat.messages || []), userMsg, initialAgentMsg];
      const optimisticChat: Chat = { ...chat, title: newTitle, messages: updatedMessages };

      setActiveChat(optimisticChat);
      setConversations((prev) => [
        optimisticChat,
        ...prev.filter((item) => item.id !== optimisticChat.id),
      ]);
      setIsThinking(true);
      let fullContent = "";

      try {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const token = localStorage.getItem("chocks_token");
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          signal: abortController.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            chatId: optimisticChat.id,
            selectedAgentId: selectedAgent.id,
            helperAgentId: helperAgent?.id,
            messages: updatedMessages.slice(0, -1).map((message) => {
              if (message.role !== "user" || !Array.isArray(message.attachments) || message.attachments.length === 0) {
                return message;
              }

              const attachmentText = message.attachments
                .map((attachment) => {
                  const nameLine = `Arquivo anexado: ${attachment.name}`;
                  const contentLine = attachment.content ? `\n${attachment.content}` : "";
                  return `${nameLine}${contentLine}`;
                })
                .join("\n\n");

              return {
                ...message,
                content: [message.content, attachmentText].filter(Boolean).join("\n\n").trim(),
              };
            }),
          }),
        });

        if (!response.ok || !response.body) {
          const message = await response.text().catch(() => "");
          throw new Error(message || "Stream failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            buffer += decoder.decode();
          } else {
            buffer += decoder.decode(value, { stream: true });
          }

          const events = buffer.split("\n\n");
          buffer = done ? "" : events.pop() ?? "";

          for (const rawEvent of events) {
            if (!rawEvent.trim()) continue;

            const lines = rawEvent.split("\n");
            const eventLine = lines.find((line) => line.startsWith("event:"));
            const dataLine = lines.find((line) => line.startsWith("data:"));

            if (!eventLine || !dataLine) continue;

            const eventName = eventLine.slice(6).trim();
            const payload = JSON.parse(dataLine.slice(5).trim());

            if (eventName === "text-delta") {
              fullContent += payload.delta || "";
              setActiveChat((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last?.role === "agent") {
                  last.agentId = last.agentId || selectedAgent.id;
                  last.helperAgentId = last.helperAgentId || helperAgent?.id;
                  last.content = fullContent;
                }
                return { ...prev, messages: msgs };
              });
            }

            if (eventName === "trace") {
              setActiveChat((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last?.role === "agent") {
                  last.agentId = last.agentId || selectedAgent.id;
                  last.helperAgentId = last.helperAgentId || helperAgent?.id;
                  last.trace = [...(last.trace || []), payload as TraceEntry];
                }
                return { ...prev, messages: msgs };
              });
            }

            if (eventName === "done") {
              setActiveChat((prev) => {
                if (!prev) return null;
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last?.role === "agent") {
                  last.agentId = last.agentId || selectedAgent.id;
                  last.helperAgentId = last.helperAgentId || helperAgent?.id;
                  last.content = payload.output_text || fullContent;
                  last.streaming = false;
                  if (Array.isArray(payload.trace)) {
                    last.trace = payload.trace as TraceEntry[];
                  }
                }
                return { ...prev, messages: msgs };
              });
            }
          }

          if (done) {
            break;
          }
        }
      } catch (err) {
        console.error("Stream error:", err);
        setActiveChat((prev) => {
          if (!prev) return null;
          const msgs = [...prev.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === "agent") {
            const fallbackAgent = getAgentProfile(selectedAgent.id);
            last.agentId = last.agentId || fallbackAgent.id;
            last.helperAgentId = last.helperAgentId || helperAgent?.id;
            last.handoffLabel = last.handoffLabel || (showHandoff ? `${fallbackAgent.name} assumiu a conversa` : undefined);
            last.collaborationLabel = last.collaborationLabel || (helperAgent ? `${fallbackAgent.name} chamou ${helperAgent.name} para ajudar` : undefined);
            const aborted = err instanceof Error && err.name === "AbortError";
            last.content = aborted
              ? fullContent.trim() || "Resposta interrompida por voce."
              : err instanceof Error && err.message.trim()
                ? err.message
                : "Nao foi possivel enviar a mensagem agora.";
            last.streaming = false;
            last.trace = [
              {
                type: "model",
                label: aborted ? "Resposta interrompida" : "Falha na resposta",
                state: aborted ? "complete" : "error",
                subtitle: aborted ? "O streaming foi cancelado manualmente." : "O streaming foi interrompido com erro.",
                payload: {
                  message:
                    aborted
                      ? "Cancelado pelo usuario"
                      : err instanceof Error && err.message.trim()
                        ? err.message
                        : "Erro desconhecido",
                },
              },
            ];
          }
          return { ...prev, messages: msgs };
        });
      } finally {
        abortControllerRef.current = null;
        setIsThinking(false);
        sendLockRef.current = false;
      }
    },
    [activeChat, enabled, persistConversation],
  );

  return {
    activeChat,
    conversations,
    isThinking,
    cancelMessage,
    sendMessage,
    createNewChat,
    duplicateChat,
    deleteChat,
    renameChat,
    selectChat,
  };
}
