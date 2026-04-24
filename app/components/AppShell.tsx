"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MessageBubble from "./MessageBubble";
import TaskProgressPanel from "./TaskProgressPanel";
import FilesView from "./FilesView";
import WorkflowView from "./WorkflowView";
import MonitorView from "./MonitorView";
import AuditView from "./AuditView";
import SettingsModal from "./SettingsModal";
import ChocksDanceVideo from "./ChocksDanceVideo";
import ArtifactPanel from "./ArtifactPanel";
import CommandPalette from "./CommandPalette";
import WelcomeScreen from "./WelcomeScreen";
import ToastViewport from "./ToastViewport";
import DoutorKittyDashboard from "./DoutorKittyDashboard";
import { CoordinationView } from "./CoordinationView";
import SkillsView from "./SkillsView";
import MemoryAdminView from "./MemoryAdminView";
import MemoryGraphView from "./MemoryGraphView";
import EasterEggManager from "./EasterEggManager";
import Downbar from "./Downbar";
import { CommandAutocomplete, useSlashCommands } from "./CommandAutocomplete";
import UrubuChaosEngine from "./UrubuChaosEngine";
import AgentRoomView from "./AgentRoomView";
import TokenCounter from "./TokenCounter";
import type { Artifact } from "../lib/artifactDetection";
import { detectArtifacts } from "../lib/artifactDetection";
import { Attachment, Message, requestJson } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useChat } from "../hooks/useChat";
import { CommandPaletteItem, useCommandPalette } from "../hooks/useCommandPalette";
import { getWorkspaceFromPathname, getWorkspaceRoute, WorkspaceId } from "../lib/workspaces";
import { useAudioRecord } from "../hooks/useAudioRecord";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { isAudioInputEnabled, isAudioReplyTtsEnabled, isRealtimeVoiceEnabled, isRealtimeFallbackEnabled } from "../lib/audio-flags";
import "../styles/realtime-v2.css";

const MAX_ATTACHMENT_BYTES = 300 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".html",
  ".xml",
  ".yml",
  ".yaml",
  ".py",
  ".sql",
  ".sh",
  ".ps1",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];

function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove: (index: number) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="attachment-list">
      {attachments.map((attachment, index) => {
        const isImage = (attachment.content || "").startsWith("data:image/");
        return (
          <div key={`${attachment.name}-${index}`} className={`attachment-chip ${isImage ? "has-preview" : ""}`}>
            {isImage && (
              <div className="attachment-preview">
                <img src={attachment.content} alt={attachment.name} />
              </div>
            )}
            <div className="attachment-details">
              <span className="attachment-name">{attachment.name}</span>
            </div>
            <button className="attachment-remove" type="button" onClick={() => onRemove(index)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function AppShell({
  initialWorkspace = "conversations",
}: {
  initialWorkspace?: WorkspaceId;
}) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const activeWorkspace = getWorkspaceFromPathname(pathname) || initialWorkspace;
  const chatEnabled = !isLoading && !!user;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Load Doutora Kitty interpretation when workspace changes
  useEffect(() => {
    if (activeWorkspace === "doutora-kitty" && chatEnabled) {
      const fetchInterpretation = async () => {
        try {
          setKittyIsLoading(true);
          const data = await requestJson("/doutora-kitty/interpretation");
          setKittyInterpretation(data);
        } catch (error) {
          console.error("Error fetching Doutora Kitty interpretation:", error);
        } finally {
          setKittyIsLoading(false);
        }
      };

      fetchInterpretation();
    }
  }, [activeWorkspace, chatEnabled]);



  const [collapsed, setCollapsed] = useState(true);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);

  useEffect(() => {
    // Apenas para desktop (dispositivos com mouse)
    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (!isDesktop) return;

    let timeout: NodeJS.Timeout;
    if (isHoveringSidebar) {
      setCollapsed(false);
      // Se estiver em modo mobile/tablet (barra oculta por left: -280px), abre o menu mobile
      if (window.innerWidth <= 1024) {
        setIsMobileMenuOpen(true);
      }
    } else {
      timeout = setTimeout(() => {
        setCollapsed(true);
        if (window.innerWidth <= 1024) {
          setIsMobileMenuOpen(false);
        }
      }, 300);
    }
    return () => clearTimeout(timeout);
  }, [isHoveringSidebar]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentFeedback, setAttachmentFeedback] = useState("");
  const [attachmentError, setAttachmentError] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [selectedArtifacts, setSelectedArtifacts] = useState<Artifact[]>([]);
  const [kittyInterpretation, setKittyInterpretation] = useState(null);
  const [kittyIsLoading, setKittyIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile menu state

  const allCommands = useSlashCommands();
  const filteredCommands = prompt.startsWith("/")
    ? allCommands.filter((cmd) => cmd.name.includes(prompt.slice(1).toLowerCase()))
    : [];

  const {
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
    loadConversations,
  } = useChat(chatEnabled);

  const { playTTS, stopTTS, isPlaying: isPlayingTTS } = useAudioPlayer();

  const { isRecording, isProcessing: isProcessingAudio, startRecording, stopRecording, cancelRecording } = useAudioRecord({
    chatId: activeChat?.id,
    onTranscription: (text) => {
      stopTTS(); // Barge-in behavior: Mute previous TTS when new voice message starts being processed or sent
      sendMessage(text, attachments, {
        onFinish: (finalText) => {
          if (finalText && isAudioReplyTtsEnabled()) {
             playTTS(finalText, activeChat?.id);
          }
        }
      });
      resetComposer();
    },
    onError: (err) => {
      setAttachmentFeedback(err);
      setAttachmentError(true);
    }
  });

  // ── V2 Realtime — modo de voz de baixa latência (opcional) ─────────────────
  // false = V1 (record → transcription → chat → TTS)    [default, preservado]
  // true  = V2 (WebRTC Realtime, diretamente via OpenAI)
  const [realtimeMode, setRealtimeMode] = useState(false);
  const [realtimeLiveTranscript, setRealtimeLiveTranscript] = useState("");
  const [realtimeLiveAssistant, setRealtimeLiveAssistant] = useState("");
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  const realtimeSession = useRealtimeSession({
    chatId: activeChat?.id || "",
    agentId: "chocks",
    token,
    onPartialTranscript: (text) => setRealtimeLiveTranscript(text),
    onPartialAssistantText: (text) => setRealtimeLiveAssistant(text),
    onTurnPersisted: ({ userTranscript, assistantText }) => {
      // Limpa legendas ao vivo após persistência oficial
      setRealtimeLiveTranscript("");
      setRealtimeLiveAssistant("");
      // Recarregar conversa para mostrar novas mensagens
      loadConversations();
    },
    onFallback: (reason) => {
      if (isRealtimeFallbackEnabled()) {
        setRealtimeMode(false);
        setRealtimeToast(`Voz avançada indisponível: ${reason}. Usando modo padrão.`);
        setTimeout(() => setRealtimeToast(null), 5000);
      }
    },
    onError: (err) => {
      setRealtimeToast(`Erro na sessão de voz: ${err}`);
      setTimeout(() => setRealtimeToast(null), 4000);
    },
  });

  const handleToggleRealtimeMode = () => {
    if (!isRealtimeVoiceEnabled()) return;
    if (realtimeMode) {
      realtimeSession.disconnect();
      setRealtimeMode(false);
      setRealtimeLiveTranscript("");
      setRealtimeLiveAssistant("");
    } else {
      stopTTS(); // mutex: desativar V1 TTS ao ativar V2
      setRealtimeMode(true);
      void realtimeSession.connect();
    }
  };

  // Mutex de voz: V1 desabilitada na UI quando V2 está ativo
  const v1AudioDisabledByV2 = realtimeMode;

  const handleStartRecording = () => {
    stopTTS(); // Barge-in early: As soon as the user starts recording, stop agent voice
    startRecording();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

  const commandPaletteItems = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: "action:new-chat",
        label: "Nova conversa",
        description: "Cria uma nova thread de chat.",
        category: "Chat",
        icon: "+",
      },
      {
        id: "action:attach-file",
        label: "Anexar arquivo",
        description: "Abre o seletor de arquivos da workspace.",
        category: "Files",
        icon: "F",
      },

      ...allCommands.map((command) => ({
        id: `slash:${command.name}`,
        label: `/${command.name}`,
        description: command.description,
        category: "Tools",
        icon: command.icon,
        keywords: [command.name, command.description],
      })),
      { id: "workspace:conversations", label: "Ir para Conversas", description: "Abre a visão principal do chat.", category: "Navigation", icon: "C" },
      { id: "workspace:files", label: "Ir para Arquivos", description: "Abre o navegador de arquivos.", category: "Navigation", icon: "F" },
      { id: "workspace:coordination", label: "Ir para Empresa", description: "Veja as empresas e membros.", category: "Navigation", icon: "A" },
      { id: "workspace:coordinator", label: "Ir para Fluxo de Trabalho", description: "Abre a visão de fluxos de trabalho.", category: "Navigation", icon: "W" },
      { id: "workspace:monitor", label: "Ir para Monitor", description: "Abre métricas e monitoramento.", category: "Navigation", icon: "M" },
      { id: "workspace:audit", label: "Ir para Auditoria", description: "Abre logs e trilha de auditoria.", category: "Navigation", icon: "L" },
      { id: "workspace:skills", label: "Manual de Habilidades", description: "Veja as habilidades nativas e ferramentas.", category: "Navigation", icon: "⚡" },
      { id: "workspace:memory", label: "Ir para Memória", description: "Veja e gerencie memórias extraídas.", category: "Navigation", icon: "🧠" },
      { id: "workspace:memory-graph", label: "Ir para Grafo de Memória", description: "Visão em grafo do conhecimento.", category: "Navigation", icon: "🕸️" },
      { id: "workspace:agent-room", label: "Sala de Convivência", description: "Veja os agentes conversando entre si.", category: "Navigation", icon: "🎭" },
    ],
    [allCommands],
  );

  const {
    open: commandPaletteOpen,
    setOpen: setCommandPaletteOpen,
    query: commandPaletteQuery,
    setQuery: setCommandPaletteQuery,
    selectedIndex: paletteSelectedIndex,
    setSelectedIndex: setPaletteSelectedIndex,
    filteredItems: paletteItems,
    recentItems,
    markUsed,
  } = useCommandPalette(commandPaletteItems);

  useEffect(() => {
    const latestAgentMessage = [...(activeChat?.messages || [])]
      .reverse()
      .find((message) => message.role === "agent");

    if (!latestAgentMessage) {
      setSelectedArtifacts([]);
      return;
    }

    // Detecta TODOS os artifacts da última mensagem
    const allArtifacts = detectArtifacts(latestAgentMessage.content, latestAgentMessage.trace);
    setSelectedArtifacts(allArtifacts.length > 0 ? allArtifacts : []);
  }, [activeChat?.id, activeChat?.messages]);

  if (isLoading || !user) {
    return null;
  }

  const navigateToWorkspace = (workspace: WorkspaceId) => {
    router.push(getWorkspaceRoute(workspace));
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const resetComposer = () => {
    setPrompt("");
    setAttachments([]);
    setAttachmentFeedback("");
    setAttachmentError(false);
    setShowCommandMenu(false);
    setCommandSelectedIndex(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setPrompt(value);

    if (value.startsWith("/")) {
      setShowCommandMenu(true);
      setCommandSelectedIndex(0);
    } else {
      setShowCommandMenu(false);
    }
  };

  const handleCommandSelect = (command: { name: string }) => {
    setPrompt(`/${command.name} `);
    setShowCommandMenu(false);
    setCommandSelectedIndex(0);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSend = () => {
    if (isThinking) {
      cancelMessage();
      return;
    }

    if (prompt.trim() || attachments.length > 0) {
      sendMessage(prompt.trim(), attachments);
      resetComposer();
    }
  };



  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandMenu && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      if (event.key === "ArrowDown") {
        setCommandSelectedIndex(Math.min(commandSelectedIndex + 1, filteredCommands.length - 1));
      } else {
        setCommandSelectedIndex(Math.max(commandSelectedIndex - 1, 0));
      }
      return;
    }

    if (showCommandMenu && event.key === "Enter") {
      event.preventDefault();
      if (filteredCommands[commandSelectedIndex]) {
        handleCommandSelect(filteredCommands[commandSelectedIndex]);
      }
      return;
    }

    if (showCommandMenu && event.key === "Escape") {
      setShowCommandMenu(false);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };
 
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    let imageFound = false;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFound = true;
          if (file.size > MAX_ATTACHMENT_BYTES) {
            setAttachmentFeedback(`Imagem muito grande. Maximo: ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB.`);
            setAttachmentError(true);
            continue;
          }
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            setAttachments((prev) => [...prev, { name: `pasted-image-${Date.now()}.png`, content, mimeType: file.type }]);
            setAttachmentFeedback(`Imagem colada.`);
            setAttachmentError(false);
          };
          reader.readAsDataURL(file);
        }
      }
    }

    if (imageFound) {
      // Prevents the base64 or other garbage from being pasted as text if we've handled it as an image
    }
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      setAttachmentFeedback(`Tipo nao suportado: ${extension}`);
      setAttachmentError(true);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentFeedback(`Arquivo muito grande. Maximo: ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB.`);
      setAttachmentError(true);
      event.target.value = "";
      return;
    }

    try {
      const isImage = [".png", ".jpg", ".jpeg", ".webp"].includes(extension);

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setAttachments((prev) => [...prev, { name: file.name, content, mimeType: file.type }]);
          setAttachmentFeedback(`${file.name} anexada.`);
        };
        reader.readAsDataURL(file);
      } else {
        const content = await file.text();
        setAttachments((prev) => [...prev, { name: file.name, content, mimeType: file.type }]);
        setAttachmentFeedback(`${file.name} anexado.`);
      }
      setAttachmentError(false);
    } catch (error) {
      setAttachmentFeedback(error instanceof Error ? error.message : "Falha ao ler arquivo.");
      setAttachmentError(true);
    } finally {
      event.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const hasMessages = (activeChat?.messages?.length || 0) > 0;
  const latestAgentMessageWithTrace = hasMessages
    ? [...(activeChat?.messages || [])]
      .reverse()
      .find((message: Message) => message.role === "agent" && Array.isArray(message.trace) && message.trace.length > 0)
    : undefined;

  const handleShareChat = async () => {
    if (!activeChat) return;

    const content = activeChat.messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");

    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("Failed to share chat:", error);
    }
  };

  const handleCommandPaletteRun = async (item: CommandPaletteItem) => {
    markUsed(item.id);
    setCommandPaletteOpen(false);

    if (item.id === "action:new-chat") {
      await createNewChat();
      navigateToWorkspace("conversations");
      return;
    }

    if (item.id === "action:attach-file") {
      openFilePicker();
      return;
    }



    if (item.id.startsWith("slash:")) {
      const commandName = item.id.replace("slash:", "");
      setPrompt(`/${commandName} `);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }

    if (item.id.startsWith("workspace:")) {
      navigateToWorkspace(item.id.replace("workspace:", "") as WorkspaceId);
    }
  };

  const lastMessage = activeChat?.messages && activeChat.messages.length > 0 
    ? activeChat.messages[activeChat.messages.length - 1] 
    : null;
  const currentActiveAgentId = lastMessage?.role === "agent" ? lastMessage.agentId : null;
  const isCurrentlyStreaming = !!lastMessage?.streaming || isThinking;

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""} ${isMobileMenuOpen ? "mobile-menu-open" : ""}`}>
      {/* Gatilho invisível para desktop no canto esquerdo */}
      <div 
        className="sidebar-desktop-hover-trigger"
        onMouseEnter={() => setIsHoveringSidebar(true)}
      />

      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileSelection}
        accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
      />

      <Sidebar
        collapsed={collapsed}
        onMouseEnter={() => setIsHoveringSidebar(true)}
        onMouseLeave={() => setIsHoveringSidebar(false)}
        activeWorkspace={activeWorkspace}
        mobileOpen={isMobileMenuOpen} // Added mobileOpen prop
        onMobileClose={() => setIsMobileMenuOpen(false)} // Added close handler
        conversations={conversations}
        activeChatId={activeChat?.id}
        onSelectChat={(chat) => {
          selectChat(chat);
          setIsMobileMenuOpen(false); // Close menu on selection
        }}
        onDuplicateChat={(chatId) => {
          void duplicateChat(chatId);
          navigateToWorkspace("conversations");
          setIsMobileMenuOpen(false);
        }}
        onDeleteChat={deleteChat}
        onRenameChat={(chatId, title) => {
          void renameChat(chatId, title);
        }}
        onNewChat={() => {
          void createNewChat();
          navigateToWorkspace("conversations");
          setIsMobileMenuOpen(false);
        }}
        onSelectWorkspace={(ws) => {
          navigateToWorkspace(ws);
          setIsMobileMenuOpen(false);
        }}
      />

      <Downbar
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={(ws) => {
          navigateToWorkspace(ws);
          setIsMobileMenuOpen(false);
        }}
        onNewChat={() => {
          void createNewChat();
          navigateToWorkspace("conversations");
          setIsMobileMenuOpen(false);
        }}
      />

      <main className="main">
        <Topbar
          title={activeChat?.title || "Nova conversa"}
          hasMessages={hasMessages}
          userName={user?.displayName || "Admin Pimpotasma"}
          userAvatar={user?.avatar}
          isDesktop={typeof window !== 'undefined' && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onNewChat={() => {
            void createNewChat();
            navigateToWorkspace("conversations");
          }}
          onClearChat={() => {
            if (activeChat?.id) {
              void deleteChat(activeChat.id);
            }
          }}
          onShareChat={() => {
            void handleShareChat();
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <div className="content">
          {(activeWorkspace === "files" || activeWorkspace === "code") && <FilesView />}
          {activeWorkspace === "coordinator" && (
            <WorkflowView
              chatId={activeChat?.id}
              chatTitle={activeChat?.title}
              onSelectChat={(id, title) => selectChat({ id, title, messages: [] })}
            />
          )}
          {activeWorkspace === "coordination" && <CoordinationView />}
          {activeWorkspace === "monitor" && <MonitorView />}
          {activeWorkspace === "audit" && <AuditView />}
          {activeWorkspace === "doutora-kitty" && (
            <DoutorKittyDashboard interpretation={kittyInterpretation} isLoading={kittyIsLoading} />
          )}
          {activeWorkspace === "skills" && <SkillsView />}
          { activeWorkspace === "memory" && <MemoryAdminView /> }
          { activeWorkspace === "memory-graph" && <MemoryGraphView /> }
          { activeWorkspace === "agent-room" && <AgentRoomView /> }

          { activeWorkspace === "conversations" &&
            (!hasMessages ? (
              <WelcomeScreen
                prompt={prompt}
                onPromptChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                onOpenFilePicker={openFilePicker}
                onNavigate={navigateToWorkspace}
                onSetPrompt={setPrompt}
                isThinking={isThinking}
                attachments={attachments}
                onRemoveAttachment={removeAttachment}
                attachmentFeedback={attachmentFeedback}
                attachmentError={attachmentError}
                textareaRef={textareaRef}
                onPaste={handlePaste}
                commandMenu={
                  <CommandAutocomplete
                    isOpen={showCommandMenu}
                    selectedIndex={commandSelectedIndex}
                    filteredCommands={filteredCommands}
                    onSelectCommand={handleCommandSelect}
                  />
                }
                isRecording={isRecording}
                isProcessingAudio={isProcessingAudio}
                onStartRecord={isAudioInputEnabled() ? handleStartRecording : undefined}
                onStopRecord={stopRecording}
                onCancelRecord={cancelRecording}
                isPlayingTTS={isPlayingTTS}
                onStopTTS={stopTTS}
              />
            ) : (
              <div className={`view chat-view chat-layout ${selectedArtifacts.length > 0 ? "with-artifact" : ""}`}>
                <div className="messages">
                  <div className="messages-inner">
                    {activeChat?.messages?.map((msg, idx) => (
                      <MessageBubble
                        key={idx}
                        message={msg}
                        conversationId={activeChat.id}
                        onOpenArtifact={(artifact) => {
                          const allArtifacts = detectArtifacts(msg.content, msg.trace);
                          setSelectedArtifacts(allArtifacts.length > 0 ? allArtifacts : [artifact]);
                        }}
                        onPlayAudio={msg.role === "agent" && isAudioReplyTtsEnabled() ? () => playTTS(msg.content, activeChat.id) : undefined}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {selectedArtifacts.length > 0 ? (
                  <ArtifactPanel artifact={selectedArtifacts} onClose={() => setSelectedArtifacts([])} />
                ) : null}

                <div className="chat-composer-wrap">
                  <div className="chat-composer-inner">
                    <TaskProgressPanel
                      trace={latestAgentMessageWithTrace?.trace}
                      streaming={Boolean(latestAgentMessageWithTrace?.streaming || isThinking)}
                      agentId={latestAgentMessageWithTrace?.agentId}
                    />
                    <div className="chat-composer">
                      <TokenCounter 
                        prompt={prompt} 
                        attachments={attachments} 
                        history={activeChat?.messages} 
                        selectedAgentId={currentActiveAgentId || "chocks"}
                        chatId={activeChat?.id}
                      />
                      {/* Legendas ao vivo V2 Realtime */}
                      {realtimeMode && (realtimeLiveTranscript || realtimeLiveAssistant) && (
                        <div className="realtime-live-captions">
                          {realtimeLiveTranscript && (
                            <div className="realtime-caption-bubble user-caption">
                              {realtimeLiveTranscript}
                            </div>
                          )}
                          {realtimeLiveAssistant && (
                            <div className="realtime-caption-bubble assistant-caption">
                              {realtimeLiveAssistant}
                            </div>
                          )}
                        </div>
                      )}
                      <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={handlePromptChange}
                        placeholder="Responder..."
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                      />
                      <CommandAutocomplete
                        isOpen={showCommandMenu}
                        selectedIndex={commandSelectedIndex}
                        filteredCommands={filteredCommands}
                        onSelectCommand={handleCommandSelect}
                      />
                      <AttachmentList attachments={attachments} onRemove={removeAttachment} />
                      {attachmentFeedback && (
                        <div className={`attachment-feedback ${attachmentError ? "error" : ""}`}>{attachmentFeedback}</div>
                      )}
                      <div className="chat-toolbar">
                        <div className="chat-toolbar-left">
                          <button className="toolbar-plus" type="button" onClick={openFilePicker}>
                            +
                          </button>
                          
                          {isAudioInputEnabled() && !v1AudioDisabledByV2 && (
                            <div className="audio-controls-wrap" style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "8px" }}>
                              {isRecording ? (
                                <>
                                  <button className="toolbar-plus" type="button" onClick={stopRecording} style={{ color: "red" }} title="Parar gravação">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                                  </button>
                                  <button className="toolbar-plus" type="button" onClick={cancelRecording} title="Cancelar gravação">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                  </button>
                                  <span className="status">Gravando...</span>
                                </>
                              ) : (
                                <button className="toolbar-plus" type="button" onClick={handleStartRecording} title="Gravar áudio" disabled={isProcessingAudio}>
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Botão V2 Realtime — aparece somente se a flag estiver ativa */}
                          {isRealtimeVoiceEnabled() && (
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginLeft: "8px" }}>
                              <button
                                id="btn-realtime-voice-toggle"
                                className="toolbar-plus"
                                type="button"
                                onClick={handleToggleRealtimeMode}
                                title={realtimeMode ? "Desativar voz em tempo real" : "Ativar voz em tempo real (V2)"}
                                style={{
                                  color: realtimeMode ? "#10b981" : undefined,
                                  outline: realtimeMode ? "1px solid #10b981" : undefined,
                                  borderRadius: "4px",
                                }}
                              >
                                {/* Onda de rádio = voz ao vivo */}
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 10c0-4.4 3.6-8 8-8" />
                                  <path d="M22 10c0-4.4-3.6-8-8-8" />
                                  <path d="M5 13c0-2.8 2.2-5 5-5h4c2.8 0 5 2.2 5 5" />
                                  <circle cx="12" cy="17" r="2" />
                                  <line x1="12" y1="19" x2="12" y2="22" />
                                </svg>
                              </button>
                              {/* Indicador de estado V2 */}
                              {realtimeMode && (
                                <span className={`status-indicator ${realtimeSession.connectionState}`}>
                                  {realtimeSession.connectionState === "listening" && (
                                    <div className="realtime-visualizer">
                                      <div className="realtime-bar realtime-bar-1" />
                                      <div className="realtime-bar realtime-bar-2" />
                                      <div className="realtime-bar realtime-bar-3" />
                                    </div>
                                  )}
                                  {realtimeSession.connectionState === "connecting" && "Conectando..."}
                                  {realtimeSession.connectionState === "connected" && "Pronto"}
                                  {realtimeSession.connectionState === "listening" && "Ouvindo"}
                                  {realtimeSession.connectionState === "speaking" && "Falando..."}
                                  {realtimeSession.connectionState === "error" && "Erro"}
                                  {realtimeSession.connectionState === "fallback" && "V1 Ativo"}
                                </span>
                              )}
                              {/* Barge-in: interromper assistant */}
                              {realtimeMode && realtimeSession.connectionState === "speaking" && (
                                <button
                                  className="toolbar-plus"
                                  type="button"
                                  onClick={realtimeSession.interrupt}
                                  title="Interromper assistant"
                                  style={{ color: "#f59e0b" }}
                                >
                                  ⏹
                                </button>
                              )}
                              {/* Mute/unmute microfone */}
                              {realtimeMode && realtimeSession.isActive && (
                                <button
                                  className="toolbar-plus"
                                  type="button"
                                  onClick={realtimeSession.toggleMute}
                                  title={realtimeSession.isMuted ? "Desmutar" : "Mutar microfone"}
                                  style={{ color: realtimeSession.isMuted ? "#ef4444" : undefined }}
                                >
                                  {realtimeSession.isMuted ? "🔇" : "🎤"}
                                </button>
                              )}
                            </div>
                          )}

                          {isPlayingTTS && !v1AudioDisabledByV2 && (
                            <button className="toolbar-plus" type="button" onClick={stopTTS} style={{ color: "#3b82f6", marginLeft: "8px" }} title="Parar áudio">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                            </button>
                          )}

                          {isProcessingAudio && !v1AudioDisabledByV2 && <div className="status">Transcrevendo áudio...</div>}
                          {isThinking && !isProcessingAudio && !v1AudioDisabledByV2 && <div className="status">Executando etapas...</div>}
                        </div>
                        <div className="chat-toolbar-right">

                          <button className={`toolbar-send ${isThinking ? "cancel" : ""}`} onClick={handleSend}>
                            {isThinking ? "x" : "^"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <CommandPalette
        open={commandPaletteOpen}
        query={commandPaletteQuery}
        selectedIndex={paletteSelectedIndex}
        items={paletteItems}
        recentItems={recentItems}
        onQueryChange={setCommandPaletteQuery}
        onSelectedIndexChange={setPaletteSelectedIndex}
        onClose={() => setCommandPaletteOpen(false)}
        onRun={(item) => {
          void handleCommandPaletteRun(item);
        }}
      />
      <ToastViewport />
      <ChocksDanceVideo hasMessages={hasMessages} />
      <EasterEggManager />
      <UrubuChaosEngine 
        activeAgentId={currentActiveAgentId} 
        isStreaming={isCurrentlyStreaming} 
      />

      {/* Toast de feedback V2 Realtime */}
      {realtimeToast && (
        <div
          role="alert"
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(30,30,40,0.95)",
            color: "#e2e8f0",
            padding: "10px 18px",
            borderRadius: "8px",
            fontSize: "13px",
            zIndex: 9999,
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            maxWidth: "420px",
            textAlign: "center",
          }}
        >
          {realtimeToast}
        </div>
      )}
    </div>
  );
}
