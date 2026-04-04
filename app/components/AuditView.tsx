"use client";

import { useEffect, useState } from "react";
import { requestJson } from "../lib/api";

interface AuditLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

export default function AuditView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = (await requestJson("/audit/logs")) as { logs?: AuditLog[] };
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      }
    };
    loadLogs();
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="view audit-view">
      <div className="audit-shell">
        <div className="panel-card">
          <div className="panel-card-title">Registro de Auditoria</div>
          <div className="panel-card-copy">Acompanhe todos os passos do Chocks nos bastidores. 👦🔎📜</div>
        </div>

        <div className="audit-list">
          {logs.map((log) => (
            <div key={log.id} className={`audit-item ${log.level}`}>
              <div className="audit-meta">
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`log-badge ${log.level}`}>{log.level}</span>
              </div>
              <div className="log-message">{log.message}</div>
              {log.data !== undefined && (
                <pre className="log-data">{JSON.stringify(log.data, null, 2)}</pre>
              )}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="panel-card-copy">Nenhum log registrado ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
