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
import PluginsView from "./PluginsView";
import SettingsModal from "./SettingsModal";
import ChocksDanceVideo from "./ChocksDanceVideo";
import ArtifactPanel from "./ArtifactPanel";
import CommandPalette from "./CommandPalette";
import WelcomeScreen from "./WelcomeScreen";
import ToastViewport from "./ToastViewport";
import DoutorKittyDashboard from "./DoutorKittyDashboard";
import MemoryAdminView from "./MemoryAdminView";
import MemoryGraphView from "./MemoryGraphView";
import { CoordinationView } from "./CoordinationView";
import EasterEggManager from "./EasterEggManager";
import { CommandAutocomplete, useSlashCommands } from "./CommandAutocomplete";
import type { Artifact } from "../lib/artifactDetection";
import { detectArtifacts } from "../lib/artifactDetection";
import { Attachment, Message } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useChat } from "../hooks/useChat";
import { CommandPaletteItem, useCommandPalette } from "../hooks/useCommandPalette";
import { getWorkspaceFromPathname, getWorkspaceRoute, WorkspaceId } from "../lib/workspaces";

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
      {attachments.map((attachment, index) => (
        <div key={`${attachment.name}-${index}`} className="attachment-chip">
          <span>{attachment.name}</span>
          <button className="attachment-remove" type="button" onClick={() => onRemove(index)}>
            x
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AppShell({
  initialWorkspace = "conversations",
}: {
  initialWorkspace?: WorkspaceId;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const activeWorkspace = getWorkspaceFromPathname(pathname) || initialWorkspace;
  const chatEnabled = !isLoading && !!user;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
          const response = await fetch("/api/doutora-kitty/interpretation", {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setKittyInterpretation(data);
          }
        } catch (error) {
          console.error("Error fetching Doutora Kitty interpretation:", error);
        } finally {
          setKittyIsLoading(false);
        }
      };

      fetchInterpretation();
    }
  }, [activeWorkspace, chatEnabled]);



  const [collapsed, setCollapsed] = useState(false);
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
  } = useChat(chatEnabled);

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
      { id: "workspace:coordination", label: "Ir para Coordenação", description: "Abre a coordenação de agentes.", category: "Navigation", icon: "A" },
      { id: "workspace:coordinator", label: "Ir para Fluxo de Trabalho", description: "Abre a visão de fluxos de trabalho.", category: "Navigation", icon: "W" },
      { id: "workspace:monitor", label: "Ir para Monitor", description: "Abre métricas e monitoramento.", category: "Navigation", icon: "M" },
      { id: "workspace:audit", label: "Ir para Auditoria", description: "Abre logs e trilha de auditoria.", category: "Navigation", icon: "L" },
      { id: "workspace:code", label: "Ir para Plugins", description: "Abre a área de plugins e código.", category: "Navigation", icon: "P" },
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
      const content = await file.text();
      setAttachments((prev) => [...prev, { name: file.name, content }]);
      setAttachmentFeedback(`${file.name} anexado.`);
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

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileSelection}
        accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
      />

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        conversations={conversations}
        activeChatId={activeChat?.id}
        onSelectChat={selectChat}
        onDuplicateChat={(chatId) => {
          void duplicateChat(chatId);
          navigateToWorkspace("conversations");
        }}
        onDeleteChat={deleteChat}
        onRenameChat={(chatId, title) => {
          void renameChat(chatId, title);
        }}
        onNewChat={() => {
          void createNewChat();
          navigateToWorkspace("conversations");
        }}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={navigateToWorkspace}
      />

      <main className="main">
        <Topbar
          title={activeChat?.title || "Nova conversa"}
          hasMessages={hasMessages}
          userName={user?.displayName || "Admin Pimpotasma"}
          userAvatar={user?.avatar}
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
          {activeWorkspace === "files" && <FilesView />}
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
          {activeWorkspace === "code" && <PluginsView />}
          {activeWorkspace === "memory-admin" && <MemoryAdminView />}
          {activeWorkspace === "memory-graph" && <MemoryGraphView />}
          {activeWorkspace === "doutora-kitty" && (
            <DoutorKittyDashboard interpretation={kittyInterpretation} isLoading={kittyIsLoading} />
          )}

          {activeWorkspace === "conversations" &&
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
                commandMenu={
                  <CommandAutocomplete
                    isOpen={showCommandMenu}
                    selectedIndex={commandSelectedIndex}
                    filteredCommands={filteredCommands}
                    onSelectCommand={handleCommandSelect}
                  />
                }
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
                          // When artifact is clicked, show all artifacts from that message
                          const allArtifacts = detectArtifacts(msg.content, msg.trace);
                          setSelectedArtifacts(allArtifacts.length > 0 ? allArtifacts : [artifact]);
                        }}
                      />
                    ))}
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
                    />
                    <div className="chat-composer">
                      <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={handlePromptChange}
                        placeholder="Responder..."
                        onKeyDown={handleKeyDown}
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
                          <div className="status">{isThinking ? "Executando etapas..." : ""}</div>
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
    </div>
  );
}
