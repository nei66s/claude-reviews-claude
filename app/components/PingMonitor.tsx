"use client";

import { useEffect, useState } from "react";

export default function PingMonitor() {
  const [apiPing, setApiPing] = useState<number | null>(null);
  const [dbPing, setDbPing] = useState<number | null>(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [dbOnline, setDbOnline] = useState(false);

  async function pollPing() {
    // API ping (repassado pelo proxy do Next)
    const startApi = Date.now();
    try {
      await fetch("/api/ping");
      setApiPing(Date.now() - startApi);
      setApiOnline(true);
    } catch {
      setApiPing(null);
      setApiOnline(false);
    }

    // DB ping proxy
    const startDb = Date.now();
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        setDbPing(Date.now() - startDb);
        setDbOnline(true);
      } else {
        throw new Error();
      }
    } catch {
      setDbPing(null);
      setDbOnline(false);
    }
  }

  useEffect(() => {
    pollPing();
    const interval = setInterval(pollPing, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="topbar-ping">
      <div className="ping-item" title="Latencia da API">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
        </svg>
        <span className={`ping-dot ${apiOnline ? "online" : "offline"}`}></span>
        <span className="ping-value">{apiPing ?? "--"}</span>
        <span className="ping-unit">ms</span>
      </div>
      <div className="ping-item" title="Latencia do Banco de Dados">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
        <span className={`ping-dot ${dbOnline ? "online" : "offline"}`}></span>
        <span className="ping-value">{dbPing ?? "--"}</span>
        <span className="ping-unit">ms</span>
      </div>
    </div>
  );
}
