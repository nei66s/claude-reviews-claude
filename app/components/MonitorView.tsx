"use client";

import { useEffect, useState } from "react";
import { requestJson } from "../lib/api";

interface MonitorStats {
  memory?: {
    rss?: number;
  };
  uptime?: number;
}

export default function MonitorView() {
  const [stats, setStats] = useState<MonitorStats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = (await requestJson("/monitor/stats")) as MonitorStats;
        setStats(data);
      } catch (err) {
        console.error("Failed to load monitor stats:", err);
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="view monitor-view">
      <div className="monitor-shell">
        <div className="panel-card">
          <div className="panel-card-title">Sistema do Chocks</div>
          <div className="panel-card-copy">Consumo de recursos e saúde do servidor em tempo real. 🌡️🧠</div>
        </div>

        <div className="monitor-grid">
          <div className="panel-card">
            <div className="panel-card-title">Memória RSS</div>
            <div className="monitor-value">{stats?.memory?.rss ? `${(stats.memory.rss / 1024 / 1024).toFixed(1)} MB` : "--"}</div>
          </div>
          <div className="panel-card">
            <div className="panel-card-title">Uptime</div>
            <div className="monitor-value">{stats?.uptime ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : "--"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
