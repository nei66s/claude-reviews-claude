"use client";

import { useEffect, useState } from "react";
import { requestJson } from "../lib/api";
import { SkeletonCard } from "./SkeletonLoaders";

interface OpenAIStats {
  configured: boolean;
  keyMasked: string | null;
  online: boolean;
  modelCount: number | null;
  latencyMs: number | null;
  defaultModel: string | null;
}

interface MonitorStats {
  memory?: {
    rss?: number;
    heapUsed?: number;
    heapTotal?: number;
    external?: number;
  };
  uptime?: number;
  openai?: OpenAIStats;
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StatCard({ label, value, sub, accent, tooltip }: { label: string; value: string; sub?: string; accent?: string; tooltip?: string }) {
  return (
    <div className="mon-stat-card" data-tooltip={tooltip}>
      <div className="mon-stat-label">{label}</div>
      <div className="mon-stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="mon-stat-sub">{sub}</div>}
    </div>
  );
}

export default function MonitorView() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStats = async () => {
    try {
      const data = (await requestJson("/monitor/stats")) as MonitorStats;
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load monitor stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const openai = stats?.openai;
  const heapPct = stats?.memory?.heapUsed && stats?.memory?.heapTotal
    ? Math.round((stats.memory.heapUsed / stats.memory.heapTotal) * 100)
    : null;

  return (
    <div className="view monitor-view">
      <div className="mon-shell">

        {/* Header */}
        <div className="mon-header">
          <div className="mon-header-left">
            <div className="mon-header-icon">🖥️</div>
            <div>
              <div className="mon-header-title">Monitor do Sistema</div>
              <div className="mon-header-sub">
                {lastUpdated
                  ? `Atualizado às ${lastUpdated.toLocaleTimeString()}`
                  : "Carregando..."}
              </div>
            </div>
          </div>
          <div className="mon-header-right">
            <div className={`mon-live-dot${!loading ? " on" : ""}`} />
            <button className="mon-refresh-btn" onClick={() => void loadStats()} title="Atualizar">↻</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
        {/* Servidor */}
        <div className="mon-section-label">Servidor</div>
        <div className="mon-grid-2">
          <StatCard
            label="Memória RSS"
            value={stats?.memory?.rss ? formatBytes(stats.memory.rss) : "--"}
            sub="Resident Set Size"
            tooltip="Resident Set Size — memória total alocada pelo processo Node.js, incluindo código, stack e heap."
          />
          <StatCard
            label="Uptime"
            value={stats?.uptime ? formatUptime(stats.uptime) : "--"}
            sub="Tempo desde o último restart"
            tooltip="Tempo que o servidor está rodando sem reiniciar. Reinicializações zeram este contador."
          />
          <StatCard
            label="Heap Usado"
            value={stats?.memory?.heapUsed ? formatBytes(stats.memory.heapUsed) : "--"}
            sub={heapPct !== null ? `${heapPct}% do heap total` : undefined}
            accent={heapPct !== null && heapPct > 80 ? "#f87171" : undefined}
            tooltip="Memória JavaScript em uso ativo pelo V8. Valores acima de 80% podem indicar vazamento de memória."
          />
          <StatCard
            label="Heap Total"
            value={stats?.memory?.heapTotal ? formatBytes(stats.memory.heapTotal) : "--"}
            sub="Alocado pelo V8"
            tooltip="Tamanho total do heap JavaScript alocado pelo motor V8. Cresce conforme a demanda."
          />
        </div>

        {/* Heap bar */}
        {heapPct !== null && (
          <div className="mon-bar-wrap">
            <div className="mon-bar-label">
              <span>Uso do Heap</span>
              <span className="mon-bar-pct">{heapPct}%</span>
            </div>
            <div className="mon-bar-track">
              <div
                className="mon-bar-fill"
                style={{
                  width: `${heapPct}%`,
                  background: heapPct > 80 ? "#f87171" : heapPct > 60 ? "#fbbf24" : "var(--accent)",
                }}
              />
            </div>
          </div>
        )}

        {/* OpenAI */}
        <div className="mon-section-label">OpenAI API</div>
        <div className="mon-openai-card">
          <div className="mon-openai-row">
            <div className="mon-openai-status">
              <span
                className="mon-openai-dot"
                style={{ background: openai?.online ? "var(--accent)" : openai?.configured ? "#f87171" : "#71717a" }}
              />
              <span className="mon-openai-status-text">
                {loading ? "Verificando..." : openai?.online ? "Online" : openai?.configured ? "Erro de conexão" : "Não configurada"}
              </span>
            </div>
            {openai?.keyMasked && (
              <span className="mon-openai-key">{openai.keyMasked}</span>
            )}
          </div>

          {openai?.configured && (
            <div className="mon-grid-3">
              <div className="mon-openai-stat" data-tooltip="Total de modelos acessíveis com sua chave atual. Inclui GPT-4, GPT-3.5, embeddings e outros.">
                <div className="mon-openai-stat-label">Modelos disponíveis</div>
                <div className="mon-openai-stat-value">{openai.modelCount ?? "--"}</div>
              </div>
              <div className="mon-openai-stat" data-tooltip="Tempo de resposta do endpoint /v1/models da OpenAI. Acima de 2000ms pode indicar instabilidade na API.">
                <div className="mon-openai-stat-label">Latência da API</div>
                <div
                  className="mon-openai-stat-value"
                  style={openai.latencyMs !== null && openai.latencyMs > 2000 ? { color: "#fbbf24" } : undefined}
                >
                  {openai.latencyMs !== null ? `${openai.latencyMs} ms` : "--"}
                </div>
              </div>
              <div className="mon-openai-stat" data-tooltip="Modelo configurado na variável OPENAI_MODEL do ambiente. Usado como padrão nas conversas.">
                <div className="mon-openai-stat-label">Modelo padrão</div>
                <div className="mon-openai-stat-value mon-openai-model">
                  {openai.defaultModel ?? "não definido"}
                </div>
              </div>
            </div>
          )}
        </div>
          </>
        )}

      </div>
    </div>
  );
}
