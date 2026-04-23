
"use client";

import React from "react";

interface RoomTickerProps {
  currentTopic: string;
  isUrubuActive: boolean;
}

export default function RoomTicker({ currentTopic, isUrubuActive }: RoomTickerProps) {
  const newsPrefix = isUrubuActive ? "🚨 URUBUTÓPIA NEWS" : "📺 PIMPOTASMA LIVE NEWS";
  
  return (
    <footer className={`room-footer-ticker ${isUrubuActive ? "is-chaos" : ""}`}>
      <div className="ticker-label">
        <div className="pulse-icon" />
        <span>{newsPrefix}</span>
      </div>
      <div className="ticker-content">
        <div className="ticker-track">
          {[1, 2, 3].map(i => (
            <span key={i}>
              {isUrubuActive 
                ? `ATENÇÃO: ${currentTopic} • URUBU CORP TENTANDO DOMINAR O MUNDO • CUIDADO COM GOLPES NO PIX • ALERTA DE VULNERABILIDADE • `
                : `DESTAQUE: ${currentTopic} • FAMÍLIA PIMPOTASMA EM HARMONIA • NOVOS DESAFIOS PARA OS AGENTES • FIQUE LIGADO • `
              }
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .room-footer-ticker {
          height: 44px;
          background: #000;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          overflow: hidden;
          z-index: 50;
          transition: all 0.5s;
        }

        .room-footer-ticker.is-chaos {
          background: #1a0505;
          border-top-color: rgba(239, 68, 68, 0.3);
          box-shadow: 0 -5px 20px rgba(239, 68, 68, 0.1);
        }

        .ticker-label {
          background: #4f46e5;
          color: #fff;
          height: 100%;
          padding: 0 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          z-index: 10;
          clip-path: polygon(0 0, 90% 0, 100% 100%, 0% 100%);
          transition: background-color 0.5s;
        }

        .is-chaos .ticker-label {
          background: #ef4444;
        }

        .pulse-icon {
          width: 8px;
          height: 8px;
          background: #fff;
          border-radius: 50%;
          animation: pulse 0.8s infinite alternate;
          box-shadow: 0 0 8px #fff;
        }

        .ticker-content {
          flex: 1;
          overflow: hidden;
        }

        .ticker-track {
          display: flex;
          white-space: nowrap;
          animation: ticker-loop 50s linear infinite;
        }

        .ticker-track span {
          display: inline-block;
          color: #888;
          font-size: 11px;
          font-weight: 700;
          padding-right: 120px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: color 0.5s;
        }

        .is-chaos .ticker-track span {
          color: #ef4444;
        }

        @keyframes ticker-loop {
          from { transform: translateX(0); }
          to { transform: translateX(-33.33%); }
        }

        @keyframes pulse {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </footer>
  );
}
