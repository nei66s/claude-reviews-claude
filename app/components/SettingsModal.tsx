"use client";

import { useEffect, useState } from "react";

import { requestJson } from "../lib/api";

export default function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState("bsilv");
  const [welcomeTitle, setWelcomeTitle] = useState("Bem-vindo");
  const [planLabel, setPlanLabel] = useState("Plano local");
  const [permissionMode, setPermissionMode] = useState("ask");
  const [fullAccess, setFullAccess] = useState(false);
  const [approvedTools, setApprovedTools] = useState<string[]>([]);
  const [sandboxEnabled, setSandboxEnabled] = useState(true);
  const [sandboxWritableRoots, setSandboxWritableRoots] = useState("");

  const approvalTools = [
    { name: "file_write", label: "Salvar arquivo" },
    { name: "directory_create", label: "Criar pasta" },
    { name: "file_move", label: "Mover/Renomear" },
    { name: "file_copy", label: "Copiar/Duplicar" },
    { name: "file_delete", label: "Apagar" },
  ];

  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async () => {
      try {
        const data = await requestJson("/tools/status");
        setPermissionMode(typeof data?.permissionMode === "string" ? data.permissionMode : "ask");
        setFullAccess(Boolean(data?.fullAccess));
        setApprovedTools(Array.isArray(data?.approvedTools) ? data.approvedTools : []);
        setSandboxEnabled(data?.sandboxEnabled !== false);
        setSandboxWritableRoots(
          Array.isArray(data?.sandboxWritableRoots) ? data.sandboxWritableRoots.join("\n") : "",
        );
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };

    void loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="overlay settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="overlay-modal settings-modal">
        <div className="modal-header settings-modal-header">
          <div className="modal-title">Configuracoes do Chocks</div>
          <button className="modal-close settings-modal-close" type="button" onClick={onClose}>
            x
          </button>
        </div>

        <div className="modal-body settings-modal-body">
          <div className="field-group settings-field-group">
            <label>Nome do usuario</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          <div className="field-group settings-field-group">
            <label>Titulo da saudacao</label>
            <input value={welcomeTitle} onChange={(e) => setWelcomeTitle(e.target.value)} />
          </div>

          <div className="field-group settings-field-group">
            <label>Selo do plano</label>
            <input value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} />
          </div>

          <div className="field-group settings-field-group">
            <label>Modo de permissao</label>
            <select value={permissionMode} onChange={(e) => setPermissionMode(e.target.value)}>
              <option value="ask">Perguntar sempre</option>
              <option value="auto">Automatico</option>
              <option value="read_only">Somente leitura</option>
            </select>
          </div>

          <div className="field-group row settings-field-group settings-inline-toggle">
            <label>Acesso total</label>
            <button
              className={`toggle ${fullAccess ? "active" : ""}`}
              type="button"
              aria-pressed={fullAccess}
              onClick={() => setFullAccess(!fullAccess)}
            >
              <div className="toggle-dot"></div>
            </button>
          </div>

          <div className="field-group row settings-field-group settings-inline-toggle">
            <label>Sandbox de escrita</label>
            <button
              className={`toggle ${sandboxEnabled ? "active" : ""}`}
              type="button"
              aria-pressed={sandboxEnabled}
              onClick={() => setSandboxEnabled(!sandboxEnabled)}
            >
              <div className="toggle-dot"></div>
            </button>
          </div>

          <div className="field-group settings-field-group">
            <label>Raizes liberadas para escrita</label>
            <textarea
              className="settings-roots-input"
              value={sandboxWritableRoots}
              onChange={(e) => setSandboxWritableRoots(e.target.value)}
              placeholder={"C:/Users/voce/projeto\nD:/workspace-seguro"}
              rows={4}
            />
            <div className="panel-card-copy settings-help">
              Uma raiz por linha. Se vazio, o sandbox permite escrita apenas no workspace atual.
            </div>
          </div>

          <div className="field-group settings-field-group">
            <label>Tools aprovadas no modo ask</label>
            <div className="permission-pill-row settings-pill-row">
              {approvalTools.map((tool) => {
                const active = approvedTools.includes(tool.name);
                return (
                  <button
                    key={tool.name}
                    type="button"
                    className={`permission-pill ${active ? "active" : ""}`}
                    onClick={() =>
                      setApprovedTools((prev) =>
                        prev.includes(tool.name)
                          ? prev.filter((item) => item !== tool.name)
                          : [...prev, tool.name],
                      )
                    }
                  >
                    {tool.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer settings-modal-footer">
          <button className="btn secondary settings-btn settings-btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary settings-btn settings-btn-primary"
            type="button"
            onClick={async () => {
              try {
                const permissionResponse = await requestJson("/tools/toggle", {
                  method: "POST",
                  body: JSON.stringify({ name: "permission_mode", permissionMode }),
                });

                for (const tool of approvalTools) {
                  await requestJson("/tools/toggle", {
                    method: "POST",
                    body: JSON.stringify({
                      name: "tool_approval",
                      toolName: tool.name,
                      enabled: approvedTools.includes(tool.name),
                    }),
                  });
                }

                const response = await requestJson("/tools/toggle", {
                  method: "POST",
                  body: JSON.stringify({ name: "full_access", enabled: fullAccess }),
                });

                await requestJson("/tools/toggle", {
                  method: "POST",
                  body: JSON.stringify({
                    name: "sandbox_settings",
                    enabled: sandboxEnabled,
                    writableRoots: sandboxWritableRoots
                      .split(/\r?\n/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }),
                });

                window.dispatchEvent(
                  new CustomEvent("chocks:full-access-changed", {
                    detail: { fullAccess: Boolean(response?.settings?.fullAccess) },
                  }),
                );

                window.dispatchEvent(
                  new CustomEvent("chocks:permission-mode-changed", {
                    detail: {
                      permissionMode: permissionResponse?.settings?.permissionMode || permissionMode,
                    },
                  }),
                );
              } catch (err) {
                console.error("Failed to save settings:", err);
              } finally {
                onClose();
              }
            }}
          >
            Salvar alteracoes
          </button>
        </div>
      </div>
    </div>
  );
}
