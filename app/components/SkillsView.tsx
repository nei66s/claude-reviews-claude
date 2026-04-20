"use client";

import { useEffect, useState } from "react";
import { requestJson } from "../lib/api";
import styles from "./SkillsView.module.css";
import { isTauri } from "../lib/desktop";
import MemoryAdminView from "./MemoryAdminView";
import MemoryGraphView from "./MemoryGraphView";

interface SkillItem {
  id?: string;
  icon: string;
  label: string;
  desc: string;
  category: "native" | "tool" | "plugin";
  example?: string;
  badge?: string;
  enabled?: boolean;
  status?: string;
}

const NATIVE_SKILLS: SkillItem[] = [
  { icon: "🪟", label: "Lançar Aplicativos", desc: "Localiza e abre qualquer programa instalado no Windows ou abre o site oficial como fallback.", example: "abre o discord", category: "native", badge: "PC" },
  { icon: "💻", label: "Gestão de Janelas", desc: "Minimiza tudo, mostra a área de trabalho ou foca em janelas específicas.", example: "minimiza tudo", category: "native", badge: "PC" },
  { icon: "☀️", label: "Brilho e Temas", desc: "Controla o brilho físico do monitor e alterna entre modo escuro/claro do Windows.", example: "ativa o modo escuro", category: "native", badge: "PC" },
  { icon: "📈", label: "Status de Hardware", desc: "Relatório instantâneo de CPU, RAM e nível de Bateria.", example: "como tá a ram?", category: "native", badge: "PC" },
  { icon: "🗣️", label: "Voz Nativa (TTS)", desc: "Faz o computador falar qualquer texto utilizando a síntese de voz local.", example: "fale: o café está pronto", category: "native", badge: "PC" },
  { icon: "📸", label: "Print de Tela", desc: "Tira um screenshot e coloca direto na sua área de transferência.", example: "tira um print", category: "native", badge: "PC" },
  { icon: "🧹", label: "Limpeza Expressa", desc: "Esvazia a lixeira e limpa arquivos temporários do sistema.", example: "esvazia a lixeira", category: "native", badge: "PC" },
  { icon: "⏰", label: "Lembretes Locais", desc: "Agenda notificações nativas do Windows que aparecem mesmo se você fechar o chat.", example: "me lembra em 5 minutos...", category: "native", badge: "PC" },
  { icon: "🔒", label: "Segurança", desc: "Bloqueia a tela do PC, reinicia ou desliga o sistema.", example: "tranca o pc", category: "native", badge: "PC" },
  { icon: "⌨️", label: "Macros de Teclado", desc: "Simula digitação real de teclas onde o cursor estiver posicionado.", example: "digita meu email", category: "native", badge: "PC" },
  { icon: "🛜", label: "Controle de Rede", desc: "Desconecta o Wifi ou reseta adaptadores de rede.", example: "desliga o wifi", category: "native", badge: "PC" },
  { icon: "🔊", label: "Volume e Mídia", desc: "Aumenta, diminui, muta ou controla o Play/Pause global.", example: "muta o pc", category: "native", badge: "PC" },
  { icon: "📂", label: "Pastas Inteligentes", desc: "Cria estruturas de pastas na área de trabalho ou documentos.", example: "cria pasta projeto x", category: "native", badge: "PC" },
  { icon: "📋", label: "Área de Transferência", desc: "Lê ou escreve no seu Ctrl+C.", example: "o que tem no meu clipboard?", category: "native", badge: "PC" },
  { icon: "🐚", label: "Terminal Direto", desc: "Executa qualquer comando CMD/PowerShell com resposta instantânea.", example: "ipconfig", category: "native", badge: "PC" },
];

type SkillTab = "all" | "native" | "tools" | "plugins" | "memory-admin" | "memory-graph";

export default function SkillsView() {
  const [activeTab, setActiveTab] = useState<SkillTab>("all");
  const [tools, setTools] = useState<SkillItem[]>([]);
  const [plugins, setPlugins] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [toolsData, pluginsData] = await Promise.all([
        requestJson("/tools/status").catch(() => ({ tools: [] })),
        requestJson("/plugins/list").catch(() => ({ plugins: [] })),
      ]);

      if (Array.isArray(toolsData?.tools)) {
        const mappedTools: SkillItem[] = toolsData.tools.map((t: { name: string; description: string; enabled?: boolean }) => ({
          id: t.name,
          icon: "🛠️",
          label: t.name,
          desc: t.description,
          category: "tool",
          badge: "IA",
          enabled: t.enabled !== false
        }));
        setTools(mappedTools);
      }

      if (Array.isArray(pluginsData?.plugins)) {
        const mappedPlugins: SkillItem[] = pluginsData.plugins.map((p: { id: string; name: string; description: string; enabled?: boolean; status?: string }) => ({
          id: p.id,
          icon: "🔌",
          label: p.name,
          desc: p.description || "Plugin instalado no sistema.",
          category: "plugin",
          badge: "EXT",
          enabled: p.enabled,
          status: p.status
        }));
        setPlugins(mappedPlugins);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePlugin = async (id: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: nextEnabled } : p));
    try {
      await requestJson("/plugins/toggle", {
        method: "POST",
        body: JSON.stringify({ id, enabled: nextEnabled })
      });
    } catch (err) {
      setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: currentEnabled } : p));
    }
  };

  const allSkills = [...NATIVE_SKILLS, ...tools, ...plugins];
  const filtered = allSkills.filter(s => {
    if (activeTab === "all") return true;
    if (activeTab === "native") return s.category === "native";
    if (activeTab === "tools") return s.category === "tool";
    if (activeTab === "plugins") return s.category === "plugin";
    return false;
  });

  return (
    <div className={styles["skills-view"]}>
      <style jsx>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255,255,255,0.1);
          transition: .4s;
          border-radius: 20px;
          border: 1px solid var(--border);
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 2px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: var(--accent);
        }
        input:checked + .slider:before {
          transform: translateX(20px);
        }
      `}</style>
      <header className={styles["skills-header"]}>
        <div className={styles["skills-title-row"]}>
          <div className={styles["skills-icon-main"]}>🧠</div>
          <div>
            <h1>Habilidades e Cognição</h1>
            <p className={styles["skills-subtitle"]}>
              Gerenciamento completo das capacidades neurais, ferramentas de IA e instintos nativos do Pimpotasma.
            </p>
          </div>
        </div>
      </header>

      <nav className={styles["skills-tabs"]}>
        <div className={`${styles["skills-tab"]} ${activeTab === "all" ? styles.active : ""}`} onClick={() => setActiveTab("all")}>
          <span>Visão Geral</span>
        </div>
        <div className={`${styles["skills-tab"]} ${activeTab === "memory-admin" ? styles.active : ""}`} onClick={() => setActiveTab("memory-admin")}>
          <span>🧠 Memória (Admin)</span>
        </div>
        <div className={`${styles["skills-tab"]} ${activeTab === "memory-graph" ? styles.active : ""}`} onClick={() => setActiveTab("memory-graph")}>
          <span>🕸️ Grafo Neural</span>
        </div>
        {isTauri() && (
          <div className={`${styles["skills-tab"]} ${activeTab === "native" ? styles.active : ""}`} onClick={() => setActiveTab("native")}>
            <span>⚡ Nativas</span>
          </div>
        )}
        <div className={`${styles["skills-tab"]} ${activeTab === "tools" ? styles.active : ""}`} onClick={() => setActiveTab("tools")}>
          <span>🛠️ IA Tools</span>
        </div>
        <div className={`${styles["skills-tab"]} ${activeTab === "plugins" ? styles.active : ""}`} onClick={() => setActiveTab("plugins")}>
          <span>🔌 Plugins</span>
        </div>
      </nav>

      <main className={styles["skills-content"]} style={{ padding: (activeTab === 'memory-admin' || activeTab === 'memory-graph') ? '0' : '40px' }}>
        {activeTab === "memory-admin" && <MemoryAdminView />}
        {activeTab === "memory-graph" && <MemoryGraphView />}
        
        {(activeTab !== "memory-admin" && activeTab !== "memory-graph") && (
          loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>Sincronizando sistemas...</div>
          ) : (
            <div className={styles["skills-grid"]}>
              {filtered.map((skill, idx) => (
                <div key={`${skill.label}-${idx}`} className={`${styles["skill-card"]} ${skill.enabled === false ? styles.disabled : ""}`} style={{ animationDelay: `${idx * 0.03}s` }}>
                  {skill.badge && <span className={styles["skill-badge"]}>{skill.badge}</span>}
                  <div className={styles["skill-card-head"]}>
                    <div className={styles["skill-card-icon"]}>{skill.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div className={styles["skill-card-label"]}>{skill.label}</div>
                      {skill.status && <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase' }}>{skill.status}</div>}
                    </div>
                    {(skill.category === "plugin") && (
                      <label className="toggle-switch">
                        <input type="checkbox" checked={skill.enabled} onChange={() => togglePlugin(skill.id!, !!skill.enabled)} />
                        <span className="slider"></span>
                      </label>
                    )}
                  </div>
                  <p className={styles["skill-card-desc"]}>{skill.desc}</p>
                  
                  <div className={styles["skill-card-tags"]}>
                    <span className={`${styles["skill-tag"]} ${styles[skill.category]}`}>{skill.category}</span>
                    {skill.enabled === false && <span className={styles["skill-tag"]} style={{ color: '#ef4444' }}>Desativado</span>}
                  </div>

                  {skill.example && (
                    <div className={styles["skill-card-footer"]}>
                      <div className={styles["skill-example"]}>
                        “{skill.example}”
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
