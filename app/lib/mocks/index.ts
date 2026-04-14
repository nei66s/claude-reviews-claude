/**
 * Mock Library Index
 * Centralize exports para fixtures, handlers, and MSW setup
 */

export * from "./fixtures";
export * from "./handlers";
export * from "./msw-setup";

// Re-export commonly used types and helpers
export {
  mockTeams,
  mockAgents,
  mockSwarmResponse,
  getMockTeam,
  getMockAgent,
  createMockTeam,
} from "./fixtures";

export {
  swarmHandlers,
  resetMockStorage,
  setMockTeams,
  getMockTeamsData,
} from "./handlers";

export {
  createSwarmHandlers,
  resetSwarmMocks,
  setSwarmMockTeams,
  getSwarmMockTeams,
} from "./msw-setup";
