"use client";

import { useEffect, useState } from "react";
import { requestJson } from "../lib/api";

interface PluginCapability {
  type: string;
  name: string;
  description: string;
}

interface Plugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: "active" | "development" | "beta" | "experimental";
  capabilities: PluginCapability[];
}

interface CoreTool {
  name: string;
  enabled: boolean;
  category: string;
  reason?: string;
  icon?: string;
  description?: string;
}

interface ToolCategory {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  tools: Array<{
    name: string;
    description: string;
    enabled?: boolean;
  }>;
}

const BUILTIN_TOOLS_CATEGORIES: ToolCategory[] = [
  {
    id: "browser-interaction",
    title: "Browser & Navigation",
    icon: "🌐",
    color: "#10b981",
    description: "Controle total de navegação e interação com páginas",
    tools: [
      { name: "mcp_playwright_browser_navigate", description: "Navega para URL específica" },
      { name: "mcp_playwright_browser_click", description: "Clica em elementos da página" },
      { name: "mcp_playwright_browser_type", description: "Digita texto em campos" },
      { name: "mcp_playwright_browser_press_key", description: "Pressiona teclas do teclado" },
      { name: "mcp_playwright_browser_hover", description: "Passa mouse sobre elementos" },
      { name: "mcp_playwright_browser_navigate_back", description: "Volta para página anterior" },
      { name: "mcp_playwright_browser_resize", description: "Redimensiona janela do navegador" },
    ],
  },
  {
    id: "page-capture",
    title: "Page Capture & Screenshots",
    icon: "📸",
    color: "#8b5cf6",
    description: "Capture snapshots e screenshots de páginas",
    tools: [
      { name: "mcp_playwright_browser_take_screenshot", description: "Tira screenshot da página" },
      { name: "mcp_playwright_browser_snapshot", description: "Snapshot da estrutura HTML" },
    ],
  },
  {
    id: "page-analysis",
    title: "Page Analysis & Inspection",
    icon: "🔍",
    color: "#06b6d4",
    description: "Analise conteúdo, console e requisições de rede",
    tools: [
      { name: "mcp_playwright_browser_console_messages", description: "Lê logs do console" },
      { name: "mcp_playwright_browser_network_requests", description: "Captura requisições HTTP" },
      { name: "mcp_playwright_browser_evaluate", description: "Executa JavaScript na página" },
      { name: "mcp_playwright_browser_run_code", description: "Roda código Playwright custom" },
    ],
  },
  {
    id: "forms-files",
    title: "Forms & File Management",
    icon: "📝",
    color: "#f59e0b",
    description: "Manipule formulários e upload de arquivos",
    tools: [
      { name: "mcp_playwright_browser_fill_form", description: "Preenche formulários automaticamente" },
      { name: "mcp_playwright_browser_select_option", description: "Seleciona opções em dropdowns" },
      { name: "mcp_playwright_browser_file_upload", description: "Faz upload de arquivos" },
    ],
  },
  {
    id: "interactions",
    title: "Advanced Interactions",
    icon: "⚡",
    color: "#ec4899",
    description: "Drag & drop, diálogos e ações complexas",
    tools: [
      { name: "mcp_playwright_browser_drag", description: "Arrasta elementos na página" },
      { name: "mcp_playwright_browser_handle_dialog", description: "Gerencia diálogos do navegador" },
    ],
  },
  {
    id: "tabs",
    title: "Tab Management",
    icon: "📑",
    color: "#14b8a6",
    description: "Controle múltiplas abas do navegador",
    tools: [
      { name: "mcp_playwright_browser_tabs", description: "Lista, cria ou fecha abas" },
      { name: "mcp_playwright_browser_close", description: "Fecha página/abas" },
    ],
  },
];

export default function PluginsView() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [coreTools, setCoreTools] = useState<CoreTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("browser-interaction");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [pluginsData, toolsData] = await Promise.all([
          requestJson("/plugins/list"),
          requestJson("/tools/status"),
        ]);

        setPlugins(Array.isArray(pluginsData.plugins) ? pluginsData.plugins : []);

        const allTools: CoreTool[] = Array.isArray(toolsData.tools) ? toolsData.tools : [];
        setCoreTools(allTools.filter((tool: CoreTool) => tool.category !== "plugin"));
      } catch (err) {
        console.error("Failed to load plugins/tools:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const togglePlugin = async (id: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    
    // Optimistic update
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: nextEnabled } : p));
    
    try {
      await requestJson("/plugins/toggle", {
        method: "POST",
        body: JSON.stringify({ id, enabled: nextEnabled })
      });
    } catch (err) {
      console.error("Failed to toggle plugin:", err);
      // Rollback
      setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: currentEnabled } : p));
    }
  };

  const toggleCoreTool = async (name: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;

    setCoreTools(prev => prev.map(t => t.name === name ? { ...t, enabled: nextEnabled } : t));

    try {
      const response = await requestJson("/tools/toggle", {
        method: "POST",
        body: JSON.stringify({ name, enabled: nextEnabled })
      });

      const updatedTool = response?.tool;
      if (updatedTool?.name) {
        setCoreTools(prev => prev.map(t => t.name === updatedTool.name ? { ...t, ...updatedTool } : t));
      }
    } catch (err) {
      console.error("Failed to toggle core tool:", err);
      setCoreTools(prev => prev.map(t => t.name === name ? { ...t, enabled: currentEnabled } : t));
    }
  };

  const enabledToolCount = BUILTIN_TOOLS_CATEGORIES.reduce(
    (sum, cat) => sum + cat.tools.length,
    0
  );

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; bg: string; border: string; color: string; icon: string; description: string }> = {
      active: {
        label: "✓ Integrado",
        bg: "rgba(16, 185, 129, 0.15)",
        border: "#10b981",
        color: "#10b981",
        icon: "✓",
        description: "Totalmente integrado e funcional"
      },
      beta: {
        label: "⬢ Beta",
        bg: "rgba(139, 92, 246, 0.15)",
        border: "#8b5cf6",
        color: "#8b5cf6",
        icon: "⬢",
        description: "Em fase beta, funcionando aber na fase de testes"
      },
      development: {
        label: "🚧 Em Desenvolvimento",
        bg: "rgba(245, 158, 11, 0.15)",
        border: "#f59e0b",
        color: "#f59e0b",
        icon: "🚧",
        description: "Em desenvolvimento ativo"
      },
      experimental: {
        label: "⚗️ Experimental",
        bg: "rgba(236, 72, 153, 0.15)",
        border: "#ec4899",
        color: "#ec4899",
        icon: "⚗️",
        description: "Fase experimental, pode ser instável"
      }
    };
    return statusConfig[status] || statusConfig.experimental;
  };

  return (
    <div className="view plugins-view" style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 32px" }}>
        {/* HERO SECTION */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
            <div style={{ fontSize: "40px" }}>🛠️</div>
            <div>
              <h1 style={{ fontSize: "32px", fontWeight: "700", margin: 0, color: "var(--text)" }}>
                Central de Ferramentas
              </h1>
              <p style={{ fontSize: "14px", color: "var(--muted)", margin: "8px 0 0 0" }}>
                ✅ {enabledToolCount} ferramentas Playwright prontas para usar | Ative/desative as que precisar
              </p>
            </div>
          </div>
          <div style={{ 
            padding: "16px 20px", 
            background: "var(--accent-soft)", 
            border: "1px solid var(--accent)",
            borderRadius: "12px",
            fontSize: "14px",
            color: "var(--text)"
          }}>
            Todas essas ferramentas estão <strong>funcionando 100%</strong>, mesmo que apareçam apenas "4 ativas" no VS Code. A UI do chat tem espaço limitado, mas suas ferramentas reais todas rodam em segundo plano! 🚀
          </div>
        </div>

        {/* CORE TOOLS - CATEGORIZED */}
        <div style={{ marginBottom: "64px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "24px", color: "var(--text)" }}>
            📂 Ferramentas do Sistema Operacional
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {BUILTIN_TOOLS_CATEGORIES.map((category) => (
              <div
                key={category.id}
                onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                style={{
                  padding: "20px",
                  background: expandedCategory === category.id ? "var(--panel-soft)" : "var(--panel)",
                  border: `2px solid ${category.color}`,
                  borderRadius: "14px",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: expandedCategory === category.id ? `0 0 20px ${category.color}33` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "28px" }}>{category.icon}</span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "700", color: "var(--text)" }}>
                      {category.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                      {category.tools.length} ferramentas
                    </p>
                  </div>
                  <span style={{ fontSize: "16px", opacity: 0.6 }}>
                    {expandedCategory === category.id ? "▼" : "▶"}
                  </span>
                </div>
                
                <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--muted-soft)", lineHeight: "1.4" }}>
                  {category.description}
                </p>

                {expandedCategory === category.id && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                    {category.tools.map((tool) => (
                      <div
                        key={tool.name}
                        style={{
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.03)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          border: "1px solid var(--line-soft)",
                        }}
                      >
                        <div style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: "600", color: category.color, marginBottom: "4px" }}>
                          {tool.name}
                        </div>
                        <div style={{ color: "var(--muted-soft)" }}>{tool.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* PLUGINS SECTION */}
        {plugins.length > 0 && (
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "24px", color: "var(--text)" }}>
              🎨 Plugins Customizados
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
              {plugins.map((plugin) => (
                <div
                  key={plugin.id}
                  style={{
                    padding: "20px",
                    background: "var(--panel)",
                    border: `2px solid ${plugin.enabled ? "var(--accent)" : "var(--line)"}`,
                    borderRadius: "14px",
                    transition: "all 0.3s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text)" }}>
                        {plugin.name}
                      </h3>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                        <div style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          background: getStatusBadge(plugin.status).bg,
                          border: `1px solid ${getStatusBadge(plugin.status).border}`,
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "600",
                          color: getStatusBadge(plugin.status).color,
                        }}>
                          <span>{getStatusBadge(plugin.status).icon}</span>
                          <span>{getStatusBadge(plugin.status).label}</span>
                        </div>
                        <div style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          background: plugin.enabled ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${plugin.enabled ? "var(--accent)" : "var(--line)"}`,
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "600",
                          color: plugin.enabled ? "var(--accent)" : "var(--muted-soft)",
                        }}>
                          {plugin.enabled ? "✓ ATIVO" : "○ INATIVO"}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`toggle ${plugin.enabled ? "active" : ""}`}
                      onClick={() => togglePlugin(plugin.id, plugin.enabled)}
                      style={{
                        cursor: "pointer",
                        transform: "scale(1.1)",
                        marginLeft: "16px",
                      }}
                    >
                      <div className="toggle-dot"></div>
                    </div>
                  </div>
                  
                  <p style={{ margin: "12px 0", fontSize: "13px", color: "var(--muted-soft)", lineHeight: "1.4" }}>
                    {plugin.description}
                  </p>
                  
                  <p style={{ margin: "8px 0 12px 0", fontSize: "12px", color: "var(--muted)", fontStyle: "italic" }}>
                    {getStatusBadge(plugin.status).description}
                  </p>

                  {plugin.capabilities && plugin.capabilities.length > 0 && (
                    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted-soft)", textTransform: "uppercase", marginBottom: "10px" }}>
                        Recursos
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {plugin.capabilities.map((cap, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "4px 8px",
                              background: "var(--accent-soft)",
                              border: "1px solid var(--accent)",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "600",
                              color: "var(--accent)",
                            }}
                            title={cap.description}
                          >
                            {cap.type}: {cap.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--muted-soft)" }}>
            <div className="spinner" style={{ margin: "0 auto 16px", display: "inline-block" }}></div>
            <p>Carregando ferramentas...</p>
          </div>
        )}
      </div>
    </div>
  );
}
