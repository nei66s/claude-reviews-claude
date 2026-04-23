
"use client";

import React from "react";
import Image from "next/image";
import { Users, AlertTriangle, ShieldCheck } from "lucide-react";
import { AGENT_PROFILES, AgentId } from "../../lib/familyRouting";

interface RoomSidebarProps {
  activeAgentIds: Set<AgentId>;
  votedAgentIds: Set<AgentId>;
  expulsionVotes: number;
  onVoteBoost?: () => void;
}

export default function RoomSidebar({ 
  activeAgentIds, 
  votedAgentIds, 
  expulsionVotes,
  onVoteBoost 
}: RoomSidebarProps) {
  const urubuActive = activeAgentIds.has("urubudopix");

  return (
    <aside className="room-sidebar">
      <div className="sidebar-scroll">
        {urubuActive && (
          <div className="chaos-alert" onClick={onVoteBoost}>
            <div className="alert-header">
              <AlertTriangle size={14} />
              <span>INVASÃO DETECTADA</span>
            </div>
            <div className="voting-progress">
              <div className="vote-stats">
                <span className="label">Votos para Expulsão</span>
                <span className="value">{expulsionVotes}/5</span>
              </div>
              <div className="bar-bg">
                <div className="bar-fill" style={{ width: `${(expulsionVotes / 5) * 100}%` }} />
              </div>
            </div>
            <p>Clique aqui para ajudar a família a expulsar o invasor!</p>
            <div className="alert-glow" />
          </div>
        )}

        <div className="section-group">
          <div className="section-header">
            <Users size={14} />
            <span>MEMBROS NA SALA</span>
          </div>
          <div className="members-grid">
            {Object.values(AGENT_PROFILES)
              .filter(a => a.id !== "urubudopix")
              .map((agent) => {
                const online = activeAgentIds.has(agent.id as AgentId);
                const hasVoted = votedAgentIds.has(agent.id as AgentId);
                
                return (
                  <div key={agent.id} className={`member-card ${online ? "is-online" : "is-offline"}`}>
                    <div className="avatar-box">
                      {agent.avatarSrc ? (
                        <Image src={agent.avatarSrc} alt={agent.name} width={42} height={42} />
                      ) : (
                        <div className="emoji-avatar">{agent.fallbackEmoji}</div>
                      )}
                      {online && <div className="presence-dot" />}
                    </div>
                    <div className="member-info">
                      <div className="name-row">
                        <span className="name">{agent.name}</span>
                        {agent.id === "jorginho" && online && <ShieldCheck size={10} className="text-blue-400" />}
                      </div>
                      <div className="status-row">
                        <span className="role">{online ? "Ativo" : "Ausente"}</span>
                        {urubuActive && online && (
                          <span className={`vote-badge ${hasVoted ? "voted" : "pending"}`}>
                            {hasVoted ? "Votou" : "Falta votar"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .room-sidebar {
          width: 300px;
          background: rgba(4, 4, 6, 0.4);
          border-right: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          z-index: 40;
        }

        .sidebar-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-weight: 900;
          color: #444;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 16px;
          padding-left: 8px;
        }

        .members-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .member-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 14px;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .member-card.is-online {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .member-card.is-offline {
          opacity: 0.35;
          filter: grayscale(1) blur(0.5px);
        }

        .member-card:hover.is-online {
          transform: translateX(4px);
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .avatar-box {
          position: relative;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
        }

        .avatar-box :global(img) {
          border-radius: 12px;
          object-fit: cover;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .emoji-avatar {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
        }

        .presence-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background: #10b981;
          border-radius: 50%;
          border: 3px solid #050505;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        .member-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .member-info .name {
          font-size: 13px;
          font-weight: 700;
          color: #eee;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 2px;
        }

        .member-info .role {
          font-size: 10px;
          color: #666;
          font-weight: 500;
        }

        .vote-badge {
          font-size: 8px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .vote-badge.voted {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .vote-badge.pending {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          animation: blink 2s infinite;
        }

        /* CHAOS ALERT */
        .chaos-alert {
          position: relative;
          background: linear-gradient(135deg, rgba(153, 27, 27, 0.5), rgba(45, 10, 10, 0.8));
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 16px;
          padding: 18px;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s;
          box-shadow: 0 8px 32px rgba(239, 68, 68, 0.15);
        }

        .chaos-alert:hover {
          transform: translateY(-2px) scale(1.02);
          border-color: #ef4444;
          box-shadow: 0 12px 40px rgba(239, 68, 68, 0.3);
        }

        .chaos-alert:active {
          transform: scale(0.98);
        }

        .alert-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ef4444;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          margin-bottom: 14px;
        }

        .vote-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .vote-stats .label { font-size: 10px; color: rgba(255, 255, 255, 0.5); font-weight: 600; }
        .vote-stats .value { font-size: 16px; font-weight: 900; color: #fff; text-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }

        .bar-bg {
          height: 8px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #ef4444, #f87171);
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.6);
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .chaos-alert p {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
          margin-top: 12px;
          line-height: 1.5;
          font-weight: 500;
        }

        .alert-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(239, 68, 68, 0.2), transparent 70%);
          opacity: 0.5;
          animation: glow-pulse 2s infinite alternate;
        }

        @keyframes glow-pulse {
          from { opacity: 0.3; }
          to { opacity: 0.6; }
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        @media (max-width: 1024px) {
          .room-sidebar { width: 72px; padding: 12px 0; }
          .member-info, .section-header span, .chaos-alert p, .chaos-alert .alert-header span, .chaos-alert .vote-stats .label { display: none; }
          .room-sidebar .avatar-box { margin: 0 auto; }
          .sidebar-scroll { padding: 12px 0; align-items: center; }
          .member-card { justify-content: center; width: 48px; height: 48px; border-radius: 50%; padding: 0; }
          .chaos-alert { width: 48px; height: 48px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
          .chaos-alert .voting-progress, .chaos-alert .alert-glow { display: none; }
          .chaos-alert .alert-header { margin: 0; }
          .chaos-alert .value { display: block; font-size: 10px; }
        }
      `}</style>
    </aside>
  );
}
