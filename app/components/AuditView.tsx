"use client";

import { useEffect, useState, useRef } from "react";
import { requestJson } from "../lib/api";
import { SkeletonCard } from "./SkeletonLoaders";

interface AuditLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

const LEVEL_COLORS: Record<string, string> = {
  info: "#60a5fa",
  warn: "#fbbf24",
  error: "#f87171",
  debug: "#a78bfa",
};

const LEVEL_BG: Record<string, string> = {
  info: "rgba(96,165,250,0.1)",
  warn: "rgba(251,191,36,0.1)",
  error: "rgba(248,113,113,0.1)",
  debug: "rgba(167,139,250,0.1)",
};

type FilterLevel = "all" | "info" | "warn" | "error" | "debug";

export default function AuditView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<FilterLevel>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = (await requestJson("/audit/logs")) as { logs?: AuditLog[] };
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void loadLogs();
    }, 0);
    if (live) {
      intervalRef.current = setInterval(loadLogs, 10000);
    }
    return () => {
      clearTimeout(initialLoad);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [live]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayed = filter === "all" ? logs : logs.filter((l) => l.level === filter);
  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="view audit-view">
      <div className="audit-shell">

        {/* Header */}
        <div className="audit-header-card">
          <div className="audit-header-left">
            <div className="audit-header-icon">📜</div>
            <div>
              <div className="audit-header-title">Registro de Auditoria</div>
              <div className="audit-header-sub">Acompanhe todos os passos do Chocks nos bastidores</div>
            </div>
          </div>
          <div className="audit-header-right">
            <button
              className={`audit-live-btn${live ? " active" : ""}`}
              onClick={() => setLive((v) => !v)}
              title={live ? "Pausar atualizações" : "Retomar atualizações"}
            >
              <span className={`audit-live-dot${live ? " pulsing" : ""}`} />
              {live ? "Ao vivo" : "Pausado"}
            </button>
            <button className="audit-refresh-btn" onClick={() => void loadLogs()} title="Atualizar agora">
              ↻
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="audit-filter-bar">
          {(["all", "info", "warn", "error", "debug"] as FilterLevel[]).map((lvl) => (
            <button
              key={lvl}
              className={`audit-filter-btn${filter === lvl ? " active" : ""}`}
              style={filter === lvl && lvl !== "all" ? {
                color: LEVEL_COLORS[lvl],
                borderColor: LEVEL_COLORS[lvl],
                background: LEVEL_BG[lvl],
              } : {}}
              onClick={() => setFilter(lvl)}
            >
              {lvl === "all" ? "Todos" : lvl.toUpperCase()}
              {lvl !== "all" && counts[lvl] !== undefined && (
                <span className="audit-filter-count">{counts[lvl]}</span>
              )}
              {lvl === "all" && <span className="audit-filter-count">{logs.length}</span>}
            </button>
          ))}
        </div>

        {/* Log list */}
        {loading ? (
          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
        <div className="audit-log-list">
          {displayed.length === 0 && (
            <div className="audit-empty">
              <span className="audit-empty-icon">🔍</span>
              <span>Nenhum log registrado ainda.</span>
            </div>
          )}
          {displayed.map((log) => {
            const color = LEVEL_COLORS[log.level] ?? "#a1a1aa";
            const bg = LEVEL_BG[log.level] ?? "transparent";
            const isOpen = expanded.has(log.id);
            const hasData = log.data !== undefined;
            return (
              <div
                key={log.id}
                className={`audit-log-entry${isOpen ? " open" : ""}`}
                style={{ borderLeftColor: color }}
                onClick={() => hasData && toggleExpand(log.id)}
              >
                <div className="audit-log-row">
                  <span className="audit-log-badge" style={{ color, background: bg }}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="audit-log-msg">{log.message}</span>
                  <span className="audit-log-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  {hasData && (
                    <span className="audit-log-chevron" style={{ color }}>
                      {isOpen ? "▾" : "▸"}
                    </span>
                  )}
                </div>
                {isOpen && hasData && (
                  <pre className="audit-log-data">{JSON.stringify(log.data, null, 2)}</pre>
                )}
              </div>
            );
          })}
        </div>
        )}

      </div>
    </div>
  );
}
