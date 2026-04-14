/**
 * Example test file for SwarmView component
 * Demonstrates how to use the mock fixtures
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  mockTeams,
  mockAgents,
  getMockTeam,
  getMockAgent,
  createMockTeam,
  resetMockStorage,
  setMockTeams,
} from "@/lib/mocks";

describe("Swarm Mocks", () => {
  beforeEach(() => {
    resetMockStorage();
  });

  describe("Fixtures", () => {
    it("should have mock teams", () => {
      expect(mockTeams).toHaveLength(3);
      expect(mockTeams[0].name).toBe("Research Squad");
      expect(mockTeams[1].name).toBe("Code Review Team");
      expect(mockTeams[2].name).toBe("Data Processing Squad");
    });

    it("should have mock agents", () => {
      const agentList = Object.values(mockAgents);
      expect(agentList.length).toBeGreaterThan(0);
    });

    it("should have agents in teams", () => {
      const team = mockTeams[0];
      expect(team.agents).toHaveLength(2);
      expect(team.agents[0].name).toBe("Aurora");
      expect(team.agents[1].name).toBe("Nexus");
    });

    it("should have correct agent statuses", () => {
      expect(mockAgents.aurora.status).toBe("idle");
      expect(mockAgents.sentinel.status).toBe("busy");
      expect(mockAgents.guardian.status).toBe("offline");
    });
  });

  describe("Helpers", () => {
    it("getMockTeam should find a team by ID", () => {
      const team = getMockTeam("team-1");
      expect(team).toBeDefined();
      expect(team?.name).toBe("Research Squad");
    });

    it("getMockTeam should return undefined for unknown ID", () => {
      const team = getMockTeam("unknown-team");
      expect(team).toBeUndefined();
    });

    it("getMockAgent should find an agent by ID", () => {
      const agent = getMockAgent("agent-1");
      expect(agent).toBeDefined();
      expect(agent?.name).toBe("Aurora");
    });

    it("getMockAgent should return undefined for unknown ID", () => {
      const agent = getMockAgent("unknown-agent");
      expect(agent).toBeUndefined();
    });

    it("createMockTeam should create a new team", () => {
      const newTeam = createMockTeam("New Team", "A test team");
      expect(newTeam.name).toBe("New Team");
      expect(newTeam.description).toBe("A test team");
      expect(newTeam.agents).toHaveLength(0);
      expect(newTeam.state).toBe("active");
    });

    it("new team should have unique ID", () => {
      const team1 = createMockTeam("Team 1");
      const team2 = createMockTeam("Team 2");
      expect(team1.id).not.toBe(team2.id);
    });
  });

  describe("Storage Management", () => {
    it("resetMockStorage should restore initial state", () => {
      setMockTeams([]);
      expect(mockTeams).toHaveLength(0);

      resetMockStorage();
      expect(mockTeams).toHaveLength(3);
    });

    it("setMockTeams should set custom teams", () => {
      const customTeams = [
        createMockTeam("Custom Team 1"),
        createMockTeam("Custom Team 2"),
      ];
      setMockTeams(customTeams);
      expect(mockTeams).toHaveLength(2);
    });
  });

  describe("Team-Agent Relationships", () => {
    it("all agents in teams should be valid", () => {
      for (const team of mockTeams) {
        for (const agent of team.agents) {
          expect(agent.id).toBeDefined();
          expect(agent.name).toBeDefined();
          expect(agent.role).toBeDefined();
          expect(["idle", "busy", "offline"]).toContain(agent.status);
        }
      }
    });

    it("should have agents across teams", () => {
      const allAgentIds = new Set<string>();
      for (const team of mockTeams) {
        for (const agent of team.agents) {
          allAgentIds.add(agent.id);
        }
      }
      expect(allAgentIds.size).toBeGreaterThan(0);
    });

    it("no agent should be in multiple teams (data integrity)", () => {
      const teamMap = new Map<string, string[]>();

      for (const team of mockTeams) {
        for (const agent of team.agents) {
          if (!teamMap.has(agent.id)) {
            teamMap.set(agent.id, []);
          }
          teamMap.get(agent.id)!.push(team.id);
        }
      }

      // Each agent should only appear in one team
      for (const [agentId, teamIds] of teamMap) {
        expect(teamIds).toHaveLength(1);
      }
    });
  });
});
