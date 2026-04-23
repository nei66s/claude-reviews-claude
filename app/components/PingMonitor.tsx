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

  const [isHacked, setIsHacked] = useState(false);

  useEffect(() => {
    const checkHacked = () => {
      setIsHacked(document.body.classList.contains("urubutopia-active"));
    };
    checkHacked();
    const observer = new MutationObserver(checkHacked);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`topbar-ping ${isHacked ? "is-hacked" : ""}`}>
      <div className="ping-item" title={isHacked ? "Sinal da Urubu Corp" : "Latencia da API"}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
        </svg>
        <span className={`ping-dot ${apiOnline ? (isHacked ? "hacked" : "online") : "offline"}`}></span>
        <span className="ping-value">{isHacked ? "999" : (apiPing ?? "--")}</span>
        <span className="ping-unit">{isHacked ? "hks" : "ms"}</span>
        {isHacked && <span className="ping-lore">URUBU 5G</span>}
      </div>
      <div className="ping-item" title={isHacked ? "Monitoramento Ativo" : "Latencia do Banco de Dados"}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
        <span className={`ping-dot ${dbOnline ? (isHacked ? "hacked" : "online") : "offline"}`}></span>
        <span className="ping-value">{isHacked ? "666" : (dbPing ?? "--")}</span>
        <span className="ping-unit">{isHacked ? "hks" : "ms"}</span>
        {isHacked && <span className="ping-lore">HACKED</span>}
      </div>
    </div>
  );
}
