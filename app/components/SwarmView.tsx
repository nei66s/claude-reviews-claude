"use client";

import { useEffect, useState, useCallback } from "react";
import { requestJson } from "../lib/api";
import { SkeletonCard } from "./SkeletonLoaders";
import { getMockTeamsData } from "../lib/mocks";

interface SwarmAgent {
  id: string;
  name: string;
  role: string;
  status: "idle" | "busy" | "offline";
  lastMessage?: string;
}

interface SwarmTeam {
  id: string;
  name: string;
  description: string;
  agents: SwarmAgent[];
  createdAt: string;
  state: "active" | "paused" | "archived";
}

export default function SwarmView() {
  const [teams, setTeams] = useState<SwarmTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson("/swarm/teams");
      setTeams(Array.isArray(data.teams) ? data.teams : []);
    } catch (err) {
      console.error("Failed to load teams:", err);
      // Fallback to mock data when API is unavailable
      const mockData = getMockTeamsData();
      setTeams(Array.isArray(mockData.teams) ? mockData.teams : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeams();
    const interval = setInterval(loadTeams, 10000);
    return () => clearInterval(interval);
  }, [loadTeams]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    setCreating(true);
    try {
      const newTeam: SwarmTeam = {
        id: `team-${Date.now()}`,
        name: newTeamName,
        description: newTeamDesc,
        agents: [],
        createdAt: new Date().toISOString(),
        state: "active",
      };

      // Try to save to backend, but allow optimistic UI update
      try {
        await requestJson("/swarm/teams", {
          method: "POST",
          body: JSON.stringify({
            name: newTeamName,
            description: newTeamDesc,
          }),
        });
        // On success, reload teams
        await loadTeams();
      } catch {
        // On failure, just add to local state
        setTeams([...teams, newTeam]);
      }

      setNewTeamName("");
      setNewTeamDesc("");
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async (teamId: string) => {
    if (!messageText.trim()) return;

    setSending(true);
    try {
      await requestJson("/swarm/message", {
        method: "POST",
        body: JSON.stringify({
          teamId,
          message: messageText,
        }),
      });
      setMessageText("");
      await loadTeams();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: SwarmAgent["status"]) => {
    switch (status) {
      case "busy":
        return "#f59e0b";
      case "idle":
        return "#10b981";
      case "offline":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getStatusLabel = (status: SwarmAgent["status"]) => {
    const labels = {
      idle: "Ocioso",
      busy: "Ocupado",
      offline: "Offline",
    };
    return labels[status] || status;
  };

  const selectedTeamData = selectedTeam ? teams.find((t) => t.id === selectedTeam) : null;

  return (
    <div className="view coordinator-view">
      <div className="coordinator-shell">
        {/* Header Card */}
        <div className="panel-card">
          <div className="panel-card-title">🐝 Mapa da Família de Agentes</div>
          <div className="panel-card-copy">
            Aqui você vê todos os agentes trabalhando juntos em times coordenados. Crie novos times ou envie mensagens para os existentes.
          </div>
        </div>

        {/* Create Team Section */}
        <div className="panel-card">
          <div className="panel-card-title">Criar Novo Time</div>
          <div className="swarm-create-row">
            <input
              type="text"
              placeholder="Nome do time (ex: Research Squad)"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) {
                  handleCreateTeam();
                }
              }}
              disabled={creating}
            />
            <button
              onClick={handleCreateTeam}
              disabled={creating || !newTeamName.trim()}
              style={{
                padding: "8px 14px",
                border: "1px solid var(--line)",
                background: "var(--accent)",
                color: "white",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "12px",
                transition: "all 0.2s ease",
              }}
            >
              {creating ? "Criando..." : "+ Criar"}
            </button>
          </div>
          <div className="swarm-msg-area">
            <textarea
              placeholder="Descrição do time (opcional)"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
              disabled={creating}
              style={{ minHeight: "56px" }}
            />
          </div>
        </div>

        {/* Teams List */}
        {loading ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : teams.length === 0 ? (
          <div className="panel-card-copy">
            Nenhum time de agentes criado ainda. Crie um novo time para começar!
          </div>
        ) : (
          <div className="task-list">
            {teams.map((team) => (
              <div key={team.id} className="panel-card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setSelectedTeam(selectedTeam === team.id ? null : team.id)
                  }
                >
                  <div style={{ flex: 1 }}>
                    <div className="panel-card-title">{team.name}</div>
                    <div className="panel-card-copy">{team.description}</div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 12px",
                      background: "var(--accent-soft)",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    🤖 {team.agents.length} agentes
                  </div>
                </div>

                {/* Agents List (expandable) */}
                {selectedTeam === team.id && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--line-soft)" }}>
                    {team.agents.length === 0 ? (
                      <div className="panel-card-copy">Neste time não há agentes ainda.</div>
                    ) : (
                      <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
                        {team.agents.map((agent) => (
                          <div
                            key={agent.id}
                            className="swarm-team-card"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: "12px",
                              alignItems: "start",
                            }}
                          >
                            <div>
                              <div className="swarm-team-name">{agent.name}</div>
                              <div className="swarm-team-meta">{agent.role}</div>
                              {agent.lastMessage && (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--muted-soft)",
                                    marginTop: "4px",
                                    fontStyle: "italic",
                                  }}
                                >
                                  "{agent.lastMessage}"
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 8px",
                                background:
                                  agent.status === "busy"
                                    ? "rgba(245, 158, 11, 0.1)"
                                    : agent.status === "idle"
                                    ? "rgba(16, 185, 129, 0.1)"
                                    : "rgba(107, 114, 128, 0.1)",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: "600",
                              }}
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: getStatusColor(agent.status),
                                  boxShadow: `0 0 6px ${getStatusColor(agent.status)}`,
                                }}
                              />
                              {getStatusLabel(agent.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message Send Area */}
                    <div className="swarm-msg-area">
                      <textarea
                        placeholder={`Envie uma mensagem para ${team.name}...`}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        disabled={sending}
                      />
                      <button
                        onClick={() => handleSendMessage(team.id)}
                        disabled={sending || !messageText.trim()}
                        style={{
                          padding: "8px 14px",
                          border: "1px solid var(--line)",
                          background: messageText.trim() ? "var(--accent)" : "rgba(255,255,255,0.1)",
                          color: "white",
                          borderRadius: "10px",
                          cursor: messageText.trim() ? "pointer" : "not-allowed",
                          fontWeight: "600",
                          fontSize: "12px",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {sending ? "Enviando..." : "Enviar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
