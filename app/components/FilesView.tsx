"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson, TraceEntry } from "../lib/api";

interface FileEntry {
  name?: string;
  path: string;
  isDir: boolean;
  size?: number;
}

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading"; path: string }
  | { kind: "text"; path: string; content: string; size?: number; editable: boolean }
  | { kind: "image"; path: string; size?: number }
  | { kind: "binary"; path: string; size?: number };

function formatActionName(label?: string) {
  const map: Record<string, string> = {
    file_write: "editei um arquivo",
    directory_create: "criei uma pasta",
    file_move: "movi um item",
    file_copy: "copiei um item",
    file_delete: "removi um item",
    create_file: "criei um arquivo",
    create_dir: "criei uma pasta",
    move: "movi um item",
    copy: "copiei um item",
    delete: "removi um item",
    write: "editei um arquivo",
  };

  return map[label || ""] || "fiz uma acao no workspace";
}

function formatActionState(state?: TraceEntry["state"]) {
  if (state === "error") return "nao deu certo";
  if (state === "pending") return "em andamento";
  return "concluido";
}

function summarizeAction(entry: TraceEntry) {
  if (!entry.payload || typeof entry.payload !== "object") {
    return entry.subtitle || "Acao interna do workspace.";
  }

  const payload = entry.payload as Record<string, unknown>;
  const path = typeof payload.path === "string" ? payload.path : "";
  const fromPath = typeof payload.fromPath === "string" ? payload.fromPath : "";
  const toPath = typeof payload.toPath === "string" ? payload.toPath : "";
  const message = typeof payload.message === "string" ? payload.message : "";

  if (entry.state === "error" && message) {
    return message;
  }

  if (fromPath || toPath) {
    return `De ${fromPath || "origem"} para ${toPath || "destino"}`;
  }

  if (path) {
    return `Caminho: ${path}`;
  }

  return entry.subtitle || "Acao interna do workspace.";
}

function getFileExtensionLabel(entry: FileEntry) {
  if (entry.isDir) return "DIR";

  const name = entry.name || entry.path.split("/").pop() || "";
  const extension = name.includes(".") ? name.split(".").pop() || "FILE" : "FILE";
  return extension.slice(0, 4).toUpperCase();
}

function ActionIcon({ kind }: { kind: "open" | "move" | "copy" | "download" | "delete" }) {
  if (kind === "open") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19h16" />
        <path d="M12 5v10" />
        <path d="m7 10 5 5 5-5" />
      </svg>
    );
  }

  if (kind === "move") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="m8 7 4-4 4 4" />
        <path d="m8 17 4 4 4-4" />
      </svg>
    );
  }

  if (kind === "copy") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="9" width="10" height="10" rx="2" />
        <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
      </svg>
    );
  }

  if (kind === "download") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M5 19h14" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l1 12h6l1-12" />
    </svg>
  );
}

export default function FilesView() {
  const [currentPath, setCurrentPath] = useState(".");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullAccess, setFullAccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pathInput, setPathInput] = useState(".");
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });
  const [editorValue, setEditorValue] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [actionTrace, setActionTrace] = useState<TraceEntry[]>([]);

  const loadFiles = useCallback(async (targetPath: string) => {
    setLoading(true);
    try {
      const data = await requestJson(`/files/list?path=${encodeURIComponent(targetPath)}`);
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setCurrentPath(typeof data?.currentPath === "string" ? data.currentPath : targetPath);
      setPathInput(typeof data?.currentPath === "string" ? data.currentPath : targetPath);
      setFullAccess(Boolean(data?.fullAccess));
      setSearchQuery("");
    } catch (err) {
      console.error("Failed to load files:", err);
      setFeedback(err instanceof Error ? err.message : "Falha ao listar arquivos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles(".");
  }, [loadFiles]);

  useEffect(() => {
    const handleFullAccessChange = () => {
      setPreview({ kind: "idle" });
      void loadFiles(".");
    };

    window.addEventListener("chocks:full-access-changed", handleFullAccessChange);
    return () => {
      window.removeEventListener("chocks:full-access-changed", handleFullAccessChange);
    };
  }, [loadFiles]);

  const refreshCurrentDirectory = useCallback(async () => {
    await loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  const openPreview = useCallback(async (targetPath: string) => {
    setPreview({ kind: "loading", path: targetPath });
    try {
      const data = await requestJson(`/files/read?path=${encodeURIComponent(targetPath)}`);
      if (data?.kind === "text") {
        setPreview({
          kind: "text",
          path: data.path,
          content: data.content || "",
          size: data.size,
          editable: Boolean(data.editable),
        });
        setEditorValue(data.content || "");
        return;
      }

      if (data?.kind === "image") {
        setPreview({ kind: "image", path: data.path, size: data.size });
        return;
      }

      setPreview({ kind: "binary", path: data?.path || targetPath, size: data?.size });
    } catch (err) {
      console.error("Failed to open preview:", err);
      setPreview({ kind: "idle" });
      setFeedback(err instanceof Error ? err.message : "Falha ao abrir preview.");
    }
  }, []);

  const runFileAction = useCallback(
    async (action: string, payload: Record<string, unknown>, successMessage: string) => {
      setBusyAction(action);
      setFeedback("");
      try {
        await requestJson("/files/action", {
          method: "POST",
          body: JSON.stringify({ action, ...payload }),
        }).then((response) => {
          if (response?.trace) {
            setActionTrace((prev) => [response.trace as TraceEntry, ...prev].slice(0, 8));
          }
        });
        setFeedback(successMessage);
        await refreshCurrentDirectory();
      } catch (err) {
        console.error(`Failed to run ${action}:`, err);
        setFeedback(err instanceof Error ? err.message : "Falha na operacao.");
        setActionTrace((prev) => [
          {
            type: "tool_call",
            label: action,
            state: "error" as const,
            subtitle: "A operacao falhou.",
            payload: {
              action,
              message: err instanceof Error ? err.message : "Falha na operacao.",
            },
          },
          ...prev,
        ].slice(0, 8));
      } finally {
        setBusyAction(null);
      }
    },
    [refreshCurrentDirectory],
  );

  const handleEntryClick = async (entry: FileEntry) => {
    if (entry.isDir) {
      setPreview({ kind: "idle" });
      await loadFiles(entry.path);
      return;
    }

    await openPreview(entry.path);
  };

  const createFolder = async () => {
    const targetPath = window.prompt("Nova pasta:", currentPath === "." ? "nova-pasta" : `${currentPath}/nova-pasta`);
    if (!targetPath?.trim()) return;
    await runFileAction("create_dir", { path: targetPath.trim() }, "Pasta criada.");
  };

  const createFile = async () => {
    const targetPath = window.prompt("Novo arquivo:", currentPath === "." ? "novo-arquivo.txt" : `${currentPath}/novo-arquivo.txt`);
    if (!targetPath?.trim()) return;
    await runFileAction("create_file", { path: targetPath.trim() }, "Arquivo criado.");
  };

  const renameOrMove = async (entry: FileEntry) => {
    const targetPath = window.prompt("Novo caminho:", entry.path);
    if (!targetPath?.trim() || targetPath.trim() === entry.path) return;
    await runFileAction(
      "move",
      { fromPath: entry.path, toPath: targetPath.trim() },
      "Item movido.",
    );
    if (preview.kind !== "idle" && preview.path === entry.path) {
      setPreview({ kind: "idle" });
    }
  };

  const duplicateEntry = async (entry: FileEntry) => {
    const defaultCopyPath = entry.isDir
      ? `${entry.path}-copia`
      : entry.path.replace(/(\.[^./\\]+)?$/, "-copia$1");
    const targetPath = window.prompt("Copiar para:", defaultCopyPath);
    if (!targetPath?.trim()) return;
    await runFileAction(
      "copy",
      { fromPath: entry.path, toPath: targetPath.trim() },
      "Item copiado.",
    );
  };

  const deleteEntry = async (entry: FileEntry) => {
    const confirmed = window.confirm(`Apagar ${entry.isDir ? "a pasta" : "o arquivo"} "${entry.path}"?`);
    if (!confirmed) return;
    await runFileAction("delete", { path: entry.path }, "Item removido.");
    if (preview.kind !== "idle" && preview.path === entry.path) {
      setPreview({ kind: "idle" });
    }
  };

  const savePreview = async () => {
    if (preview.kind !== "text" || !preview.editable) return;
    await runFileAction(
      "write",
      { path: preview.path, content: editorValue },
      "Arquivo salvo.",
    );
    setPreview({
      ...preview,
      content: editorValue,
    });
  };

  const goUp = async () => {
    if (currentPath === "." || /^[A-Za-z]:\/?$/.test(currentPath)) {
      if (fullAccess) {
        await loadFiles(currentPath);
      }
      return;
    }

    const normalized = currentPath.replace(/\/+$/, "");
    const segments = normalized.split("/");
    const nextPath = segments.length <= 1 ? "." : segments.slice(0, -1).join("/");
    await loadFiles(nextPath || ".");
  };

  const navigateToPath = async () => {
    const nextPath = pathInput.trim();
    if (!nextPath) return;
    await loadFiles(nextPath);
  };

  const breadcrumbs = useMemo(() => {
    if (currentPath === ".") {
      return ["."];
    }
    return currentPath.split("/").filter(Boolean);
  }, [currentPath]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return entries;
    }

    return entries.filter((entry) => {
      const name = (entry.name || entry.path.split("/").pop() || "").toLowerCase();
      const filePath = entry.path.toLowerCase();
      return name.includes(normalizedQuery) || filePath.includes(normalizedQuery);
    });
  }, [entries, searchQuery]);

  return (
    <div className="view files-view">
      <div className="file-browser">
        <div className="file-browser-header">
          <div className="file-browser-topline compact">
            <div className="file-browser-title-wrap">
              <div className="file-browser-title">Explorador</div>
              <div className="panel-card-copy">
                {fullAccess ? "Computador inteiro" : "Somente workspace"}
              </div>
            </div>
            <div className="file-browser-actions compact">
              <button className="menu-item compact" type="button" onClick={() => void refreshCurrentDirectory()}>
                Atualizar
              </button>
              <button className="menu-item compact" type="button" onClick={() => void goUp()}>
                Subir
              </button>
              <button className="menu-item compact" type="button" onClick={() => void createFile()}>
                Arquivo
              </button>
              <button className="menu-item compact" type="button" onClick={() => void createFolder()}>
                Pasta
              </button>
            </div>
          </div>
          <div className="file-browser-toolbar">
            <div className="file-browser-breadcrumbs">
              <span className="file-browser-crumb current" onClick={() => void loadFiles(fullAccess ? currentPath.match(/^[A-Za-z]:/) ? `${currentPath.slice(0, 2)}/` : "." : ".")}>
                {fullAccess ? "computador" : "workspace"}
              </span>
              {breadcrumbs.map((crumb, idx) => {
                const joined = currentPath === "."
                  ? "."
                  : fullAccess && idx === 0 && /^[A-Za-z]:$/.test(crumb)
                    ? `${crumb}/`
                    : breadcrumbs.slice(0, idx + 1).join("/");
                return (
                  <span key={`${crumb}-${idx}`} className="file-browser-crumb" onClick={() => void loadFiles(joined)}>
                    {crumb}
                  </span>
                );
              })}
            </div>
            <div className="file-browser-pathbar">
              <input
                className="file-browser-path-input"
                type="text"
                value={pathInput}
                onChange={(event) => setPathInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void navigateToPath();
                  }
                }}
                placeholder="Digite um caminho"
              />
              <button className="menu-item compact file-browser-go-button" type="button" onClick={() => void navigateToPath()}>
                Ir
              </button>
            </div>
            <div className="file-browser-search">
              <input
                className="file-browser-search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Pesquisar nesta pasta"
              />
            </div>
            <div className="file-browser-summary">
              {filteredEntries.length} {filteredEntries.length === 1 ? "item" : "itens"}
            </div>
          </div>
          {feedback && <div className="panel-card-copy">{feedback}</div>}
        </div>

        <div className={`file-browser-body ${preview.kind === "idle" ? "no-preview" : "with-preview"}`}>
          <div className="file-browser-list">
            {filteredEntries.map((entry) => (
              <div key={entry.path} className={`file-browser-item ${entry.isDir ? "folder" : "file"}`}>
                <button className="file-browser-item-hitbox" type="button" onClick={() => void handleEntryClick(entry)}>
                  <div className={`file-browser-art ${entry.isDir ? "folder" : "file"}`}>
                    {entry.isDir ? (
                      <div className="folder-art" aria-hidden="true">
                        <span className="folder-art-tab"></span>
                        <span className="folder-art-body"></span>
                      </div>
                    ) : (
                      <div className="file-art" aria-hidden="true">
                        <span className="file-art-page"></span>
                        <span className="file-art-corner"></span>
                        <span className="file-art-label">{getFileExtensionLabel(entry)}</span>
                      </div>
                    )}
                  </div>
                  <span className="file-browser-item-name">{entry.name || entry.path.split("/").pop()}</span>
                  {!entry.isDir && entry.size !== undefined && (
                    <span className="file-browser-item-meta">{Math.max(1, Math.round(entry.size / 1024))} KB</span>
                  )}
                </button>
                <div
                  className="file-browser-item-actions"
                  style={{ "--action-count": entry.isDir ? 4 : 5 } as CSSProperties}
                >
                  <button
                    className="menu-item file-browser-icon-button"
                    type="button"
                    title={entry.isDir ? "Abrir pasta" : "Abrir preview"}
                    aria-label={entry.isDir ? "Abrir pasta" : "Abrir preview"}
                    onClick={() => void handleEntryClick(entry)}
                  >
                    <ActionIcon kind="open" />
                  </button>
                  <button
                    className="menu-item file-browser-icon-button"
                    type="button"
                    title="Mover"
                    aria-label="Mover"
                    onClick={() => void renameOrMove(entry)}
                  >
                    <ActionIcon kind="move" />
                  </button>
                  <button
                    className="menu-item file-browser-icon-button"
                    type="button"
                    title="Copiar"
                    aria-label="Copiar"
                    onClick={() => void duplicateEntry(entry)}
                  >
                    <ActionIcon kind="copy" />
                  </button>
                  {!entry.isDir && (
                    <a
                      className="menu-item file-browser-icon-button"
                      href={`/api/files/download?path=${encodeURIComponent(entry.path)}`}
                      title="Baixar"
                      aria-label="Baixar"
                    >
                      <ActionIcon kind="download" />
                    </a>
                  )}
                  <button
                    className="menu-item danger file-browser-icon-button"
                    type="button"
                    title="Apagar"
                    aria-label="Apagar"
                    onClick={() => void deleteEntry(entry)}
                  >
                    <ActionIcon kind="delete" />
                  </button>
                </div>
              </div>
            ))}
            {loading && <div className="loading">Carregando arquivos...</div>}
            {!loading && filteredEntries.length === 0 && (
              <div className="sidebar-empty">
                {searchQuery.trim() ? "Nenhum item encontrado para essa busca." : "Nenhum item encontrado nesta pasta."}
              </div>
            )}
          </div>

          {preview.kind !== "idle" && (
            <div className="file-preview">
              <div className="file-preview-header">
                <div className="file-preview-title">
                  {preview.kind === "loading" ? "Abrindo preview..." : "Preview"}
                </div>
                {preview.kind !== "loading" && <div className="file-preview-path">{preview.path}</div>}
                {preview.kind !== "loading" && typeof preview.size === "number" && (
                  <div className="file-preview-meta">{Math.round(preview.size / 1024)} KB</div>
                )}
              </div>

              {preview.kind === "text" && (
                <>
                  <div className="file-preview-actions">
                    <button className="menu-item" type="button" onClick={() => void savePreview()} disabled={busyAction === "write"}>
                      Salvar
                    </button>
                    <a className="menu-item" href={`/api/files/download?path=${encodeURIComponent(preview.path)}`}>
                      Baixar
                    </a>
                  </div>
                  <textarea
                    className="file-preview-editor"
                    value={editorValue}
                    onChange={(event) => setEditorValue(event.target.value)}
                    spellCheck={false}
                  />
                </>
              )}

              {preview.kind === "image" && (
                <>
                  <div className="file-preview-actions">
                    <a className="menu-item" href={`/api/files/download?path=${encodeURIComponent(preview.path)}`}>
                      Baixar
                    </a>
                  </div>
                  <div
                    className="file-preview-image"
                    style={{ position: "relative", minHeight: "320px" }}
                  >
                    <Image
                      src={`/api/files/raw?path=${encodeURIComponent(preview.path)}`}
                      alt={preview.path}
                      fill
                      unoptimized
                      sizes="(max-width: 900px) 100vw, 50vw"
                      style={{ objectFit: "contain" }}
                    />
                  </div>
                </>
              )}

              {preview.kind === "binary" && (
                <>
                  <div className="panel-card-copy">
                    Esse arquivo nao tem preview textual aqui. Use download para abrir no app apropriado.
                  </div>
                  <div className="file-preview-actions">
                    <a className="menu-item" href={`/api/files/download?path=${encodeURIComponent(preview.path)}`}>
                      Baixar arquivo
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {actionTrace.length > 0 && (
          <div className="trace">
            <div className="trace-title">
              <span>Historico do workspace</span>
              <span className="trace-count">{actionTrace.length} acoes</span>
            </div>
            <div className="trace-shell">
              {actionTrace.map((entry, index) => (
                <details key={`${entry.label || "trace"}-${index}`} className="trace-card">
                  <summary className="trace-summary">
                    <div className="trace-summary-main">
                      <span className="trace-summary-icon">FS</span>
                      <div className="trace-shell-copy">
                        <span className="trace-summary-name">{formatActionName(entry.label)}</span>
                        <span className="trace-shell-subtitle">{summarizeAction(entry)}</span>
                      </div>
                    </div>
                    <span className={`trace-summary-state ${entry.state || "complete"}`}>
                      {formatActionState(entry.state)}
                    </span>
                  </summary>
                  <div className="trace-body">
                    {entry.subtitle && <div className="trace-label">{entry.subtitle}</div>}
                    {entry.payload !== undefined && (
                      <pre className="trace-pre">{JSON.stringify(entry.payload, null, 2)}</pre>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
