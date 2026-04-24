
"use client";

import React from "react";
import { Sparkles } from "lucide-react";

interface RoomHeaderProps {
  currentTopic: string | null;
  synergy: number;
  expulsionVotes: number;
  isUrubuActive?: boolean;
}

export default function RoomHeader({ currentTopic, synergy, expulsionVotes, isUrubuActive }: RoomHeaderProps) {
  const getSynergyColor = () => {
    if (synergy > 85) return "#10b981"; // Green
    if (synergy > 50) return "#f59e0b"; // Orange
    return "#ef4444"; // Red
  };

  return (
    <header className="room-topbar">
      <div className="topbar-left">
        <div className="live-badge">
          <div className="dot" />
          <span>AO VIVO</span>
        </div>
        <div className="title-area">
          <h1>Sala de Convivência</h1>
          <div className="synergy-wrapper">
            <span className="synergy-label">Sinergia da Família:</span>
            <div className="synergy-gauge-mini">
              <div 
                className="synergy-fill" 
                style={{ 
                  width: `${synergy}%`,
                  backgroundColor: getSynergyColor() 
                }} 
              />
            </div>
            <span className="synergy-value" style={{ color: getSynergyColor() }}>{synergy}%</span>
          </div>
        </div>
      </div>
      
      <div className="topbar-center">
        {isUrubuActive ? (
          <div className="vote-display-top">
            <div className="vote-progress-mini">
              <span className="v-label">VOTOS PARA EXPULSÃO:</span>
              <span className="v-count">{expulsionVotes} / 5</span>
              <div className="v-bar">
                <div className="v-fill" style={{ width: `${(expulsionVotes / 5) * 100}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="topic-display">
            <Sparkles size={14} className="text-indigo-400" />
            <span className="topic-text">{currentTopic}</span>
          </div>
        )}
      </div>

      <div className="topbar-right">
        {/* Placeholder for future controls */}
      </div>

      <style jsx>{`
        .room-topbar {
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          background: rgba(10, 10, 15, 0.82);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          z-index: 50;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 280px;
        }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.1em;
          border: 1px solid rgba(239, 68, 68, 0.25);
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.1);
        }

        .live-badge .dot {
          width: 7px;
          height: 7px;
          background: currentColor;
          border-radius: 50%;
          animation: pulse 1s infinite alternate;
        }

        .title-area h1 {
          font-size: 14px;
          font-weight: 800;
          margin: 0;
          color: #fff;
          letter-spacing: -0.01em;
        }

        .synergy-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 3px;
        }

        .synergy-label {
          font-size: 9px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .synergy-gauge-mini {
          width: 60px;
          height: 4px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
          overflow: hidden;
        }

        .synergy-fill {
          height: 100%;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.5s;
          box-shadow: 0 0 8px currentColor;
        }

        .synergy-value {
          font-size: 10px;
          font-weight: 800;
          font-family: var(--font-mono, monospace);
        }

        .topbar-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        .topic-display {
          background: rgba(255, 255, 255, 0.03);
          padding: 6px 18px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 450px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          transition: all 0.3s;
        }

        .topic-display:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .topic-text {
          font-size: 12px;
          font-weight: 500;
          color: #ccc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .vote-display-top {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 6px 16px;
          border-radius: 12px;
          animation: pulse-border 2s infinite;
        }

        .vote-progress-mini {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .v-label {
          font-size: 10px;
          font-weight: 900;
          color: #ef4444;
          letter-spacing: 0.05em;
        }

        .v-count {
          font-size: 13px;
          font-weight: 900;
          color: #fff;
          font-family: monospace;
        }

        .v-bar {
          width: 80px;
          height: 6px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 3px;
          overflow: hidden;
        }

        .v-fill {
          height: 100%;
          background: #ef4444;
          box-shadow: 0 0 10px #ef4444;
          transition: width 0.3s ease;
        }

        @keyframes pulse-border {
          0%, 100% { border-color: rgba(239, 68, 68, 0.3); }
          50% { border-color: rgba(239, 68, 68, 0.7); box-shadow: 0 0 15px rgba(239, 68, 68, 0.15); }
        }

        .topbar-right {
          min-width: 280px;
          display: flex;
          justify-content: flex-end;
        }

        @keyframes pulse {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0.5; transform: scale(0.85); }
        }

        @media (max-width: 1024px) {
          .topbar-center { display: none; }
        }
      `}</style>
    </header>
  );
}
