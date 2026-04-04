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
  capabilities: PluginCapability[];
}

interface CoreTool {
  name: string;
  enabled: boolean;
  category: string;
  reason?: string;
}

export default function PluginsView() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [coreTools, setCoreTools] = useState<CoreTool[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="view plugins-view">
      <div className="plugins-shell">
        <div className="panel-card">
          <div className="panel-card-title">Poderes do Chocks (Plugins)</div>
          <div className="panel-card-copy">Ative ou desative as ferramentas especiais dele. 👦⚡🎒</div>
        </div>

        <div className="panel-card" style={{ marginBottom: "14px" }}>
          <div className="panel-card-title">Tools do Sistema</div>
          <div className="panel-card-copy">Aqui você controla tools nativas como file_read, file_write e grep.</div>
        </div>

        <div className="plugins-list" style={{ marginBottom: "18px" }}>
          {coreTools.map((tool) => (
            <div key={tool.name} className="panel-card plugin-item">
              <div className="plugin-header">
                <div className="plugin-info" style={{ flex: 1 }}>
                  <div className="plugin-name" style={{ fontFamily: "monospace" }}>{tool.name}</div>
                  <div className="plugin-desc">Categoria: {tool.category}</div>
                  {tool.reason && (
                    <div className="plugin-desc" style={{ marginTop: "8px", opacity: 0.7 }}>{tool.reason}</div>
                  )}
                </div>
                <div
                  className={`toggle ${tool.enabled ? "active" : ""}`}
                  onClick={() => toggleCoreTool(tool.name, tool.enabled)}
                  style={{ marginLeft: "20px" }}
                >
                  <div className="toggle-dot"></div>
                </div>
              </div>
            </div>
          ))}
          {!loading && coreTools.length === 0 && (
            <div className="panel-card-copy" style={{ marginTop: "20px", textAlign: "center", opacity: 0.6 }}>
              Nenhuma tool do sistema encontrada.
            </div>
          )}
        </div>

        <div className="plugins-list">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="panel-card plugin-item">
              <div className="plugin-header">
                <div className="plugin-info" style={{ flex: 1 }}>
                  <div className="plugin-name">{plugin.name}</div>
                  <div className="plugin-desc">{plugin.description}</div>
                  
                  {plugin.capabilities && plugin.capabilities.length > 0 && (
                    <div className="plugin-capabilities" style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recursos Liberados</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {plugin.capabilities.map((cap, i) => (
                          <div 
                            key={i} 
                            className="capability-badge"
                            title={cap.description}
                            style={{ 
                              background: "rgba(255,255,255,0.05)", 
                              border: "1px solid var(--border)",
                              borderRadius: "6px",
                              padding: "4px 10px",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px"
                            }}
                          >
                            <span style={{ fontSize: "10px", fontWeight: "800", color: "var(--accent)", textTransform: "uppercase" }}>{cap.type}</span>
                            <span style={{ fontSize: "13px", fontWeight: "500" }}>{cap.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div 
                  className={`toggle ${plugin.enabled ? "active" : ""}`} 
                  onClick={() => togglePlugin(plugin.id, plugin.enabled)}
                  style={{ marginLeft: "20px" }}
                >
                  <div className="toggle-dot"></div>
                </div>
              </div>
            </div>
          ))}
          {!loading && plugins.length === 0 && (
            <div className="panel-card-copy" style={{ marginTop: "20px", textAlign: "center", opacity: 0.6 }}>
              Nenhum plugin instalado até agora.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
