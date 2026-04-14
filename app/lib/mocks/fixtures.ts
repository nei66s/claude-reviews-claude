/**
 * Mock Fixtures for Swarm View Tests
 * Reutilizável em testes e desenvolvimento
 */

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

export const mockAgents: Record<string, SwarmAgent> = {
  aurora: {
    id: "agent-1",
    name: "Aurora",
    role: "Researcher",
    status: "idle",
    lastMessage: "Analyzed 5 papers today",
  },
  nexus: {
    id: "agent-2",
    name: "Nexus",
    role: "Coordinator",
    status: "idle",
    lastMessage: "Coordinating findings",
  },
  sentinel: {
    id: "agent-3",
    name: "Sentinel",
    role: "Reviewer",
    status: "busy",
    lastMessage: "Reviewing PR #42",
  },
  refactor: {
    id: "agent-4",
    name: "Refactor",
    role: "Optimizer",
    status: "idle",
    lastMessage: "Waiting for tasks",
  },
  analyzer: {
    id: "agent-5",
    name: "Analyzer",
    role: "Data Scientist",
    status: "busy",
    lastMessage: "Processing 10K records",
  },
  guardian: {
    id: "agent-6",
    name: "Guardian",
    role: "Security Officer",
    status: "offline",
    lastMessage: "Last seen 2 hours ago",
  },
};

export const mockTeams: SwarmTeam[] = [
  {
    id: "team-1",
    name: "Research Squad",
    description: "Team investigating the latest AI trends",
    agents: [mockAgents.aurora, mockAgents.nexus],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    state: "active",
  },
  {
    id: "team-2",
    name: "Code Review Team",
    description: "Automated code quality checks",
    agents: [mockAgents.sentinel, mockAgents.refactor],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    state: "active",
  },
  {
    id: "team-3",
    name: "Data Processing Squad",
    description: "High-performance data analysis and transformation",
    agents: [mockAgents.analyzer, mockAgents.guardian],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    state: "active",
  },
];

export const mockSwarmResponse = {
  teams: mockTeams,
  total: mockTeams.length,
  timestamp: new Date().toISOString(),
};

/**
 * Helper to get a team by ID from fixtures
 */
export function getMockTeam(teamId: string): SwarmTeam | undefined {
  return mockTeams.find((t) => t.id === teamId);
}

/**
 * Helper to get an agent by ID from fixtures
 */
export function getMockAgent(agentId: string): SwarmAgent | undefined {
  return Object.values(mockAgents).find((a) => a.id === agentId);
}

/**
 * Helper to create a new mock team
 */
export function createMockTeam(
  name: string,
  description: string = ""
): SwarmTeam {
  return {
    id: `team-${Date.now()}`,
    name,
    description,
    agents: [],
    createdAt: new Date().toISOString(),
    state: "active",
  };
}
