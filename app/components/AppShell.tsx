"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import RunnerOverlay from "./RunnerOverlay";
import MessageBubble from "./MessageBubble";
import FilesView from "./FilesView";
import WorkflowView from "./WorkflowView";
import MonitorView from "./MonitorView";
import AuditView from "./AuditView";
import PluginsView from "./PluginsView";
import SettingsModal from "./SettingsModal";
import { Attachment } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useChat } from "../hooks/useChat";
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

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  const [collapsed, setCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentFeedback, setAttachmentFeedback] = useState("");
  const [attachmentError, setAttachmentError] = useState(false);

  const {
    activeChat,
    conversations,
    isThinking,
    sendMessage,
    createNewChat,
    duplicateChat,
    deleteChat,
    renameChat,
    selectChat,
  } = useChat(chatEnabled);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if (isThinking) {
      return;
    }

    if (prompt.trim() || attachments.length > 0) {
      sendMessage(prompt.trim(), attachments);
      resetComposer();
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

  const handleShareChat = async () => {
    if (!activeChat) return;

    const content = activeChat.messages
      .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error("Failed to share chat:", error);
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
            <WorkflowView chatId={activeChat?.id} chatTitle={activeChat?.title} />
          )}
          {activeWorkspace === "monitor" && <MonitorView />}
          {activeWorkspace === "audit" && <AuditView />}
          {activeWorkspace === "swarm" && (
            <div className="view swarm-view">
              <div className="panel-card">
                <div className="panel-card-title">Mapa da FamÃƒÂ­lia</div>
                <div className="panel-card-copy">Aqui vuxÃƒÂª vÃƒÂª todos os agentes trabalhando juntos! Ã°Å¸â€˜Â¦Ã°Å¸Â¤â€“Ã°Å¸Â¤â€“Ã°Å¸Â¦Â¾</div>
              </div>
            </div>
          )}
          {activeWorkspace === "code" && <PluginsView />}

          {activeWorkspace === "conversations" &&
            (!hasMessages ? (
              <div className="view welcome-view">
                <div className="welcome-shell">
                  <div className="welcome-badges">
                    <div className="welcome-badge">Plano local</div>
                    <div className="welcome-badge">Chocks Workspace</div>
                  </div>
                  <div className="welcome-title">
                    <span className="spark">*</span>Bem-Vindo
                  </div>

                  <div className="composer-card">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Como posso ajudar voce hoje?"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <AttachmentList attachments={attachments} onRemove={removeAttachment} />
                    {attachmentFeedback && (
                      <div className={`attachment-feedback ${attachmentError ? "error" : ""}`}>
                        {attachmentFeedback}
                      </div>
                    )}
                    <div className="composer-toolbar">
                      <div className="toolbar-left">
                        <button className="toolbar-plus" type="button" onClick={openFilePicker}>
                          +
                        </button>
                        {isThinking && (
                          <div className="runner-box" style={{ display: "block" }}>
                            <video src="/runner-loop.mp4" autoPlay loop muted playsInline aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="toolbar-right">
                        <button
                          className={`toolbar-send ${isThinking ? "cancel" : ""}`}
                          type="button"
                          onClick={handleSend}
                        >
                          {isThinking ? "x" : "^"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="suggestion-row">
                    <button className="suggestion-chip" onClick={() => setPrompt("Me conte quem ÃƒÂ© vuxÃƒÂª")}>
                      Quem ÃƒÂ© vocÃƒÂª?
                    </button>
                    <button className="suggestion-chip" onClick={() => setPrompt("Como estÃƒÂ¡ a Betinha?")}>
                      Betinha
                    </button>
                    <button className="suggestion-chip" onClick={() => navigateToWorkspace("files")}>
                      Ver Arquivos
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="view chat-view" style={{ display: "grid" }}>
                <div className="messages">
                  <div className="messages-inner">
                    {activeChat?.messages?.map((msg, idx) => (
                      <MessageBubble key={idx} message={msg} />
                    ))}
                  </div>
                </div>
                <div className="chat-composer-wrap">
                  <div className="chat-composer-inner">
                    <div className="chat-composer">
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Responder..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <AttachmentList attachments={attachments} onRemove={removeAttachment} />
                      {attachmentFeedback && (
                        <div className={`attachment-feedback ${attachmentError ? "error" : ""}`}>
                          {attachmentFeedback}
                        </div>
                      )}
                      <div className="chat-toolbar">
                        <div className="chat-toolbar-left">
                          <button className="toolbar-plus" type="button" onClick={openFilePicker}>
                            +
                          </button>
                          {isThinking && (
                            <div className="runner-box" style={{ display: "block" }}>
                              <video src="/runner-loop.mp4" autoPlay loop muted playsInline aria-hidden="true" />
                            </div>
                          )}
                          <div className="status">{isThinking ? "TÃƒÂ´ corrÃƒÂªndo pobi..." : ""}</div>
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

      <RunnerOverlay active={isThinking} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
