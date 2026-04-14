# 🐝 Swarm Mocks Documentation

This directory contains mock data and handlers for the Swarm feature.

## Structure

```
app/lib/mocks/
├── fixtures.ts      # Reusable test data (agents, teams)
├── handlers.ts      # MSW handlers and storage utilities
├── index.ts         # Central exports
└── README.md        # This file
```

## Usage

### In Components (Fallback)

The `SwarmView` component automatically uses mock data when the API is unavailable:

```tsx
import { getMockTeamsData } from "../lib/mocks";

// Fallback when API fails
const mockData = getMockTeamsData();
setTeams(mockData.teams);
```

### In Tests

```tsx
import { 
  mockTeams, 
  mockAgents, 
  resetMockStorage,
  getMockTeam 
} from "@/lib/mocks";

describe("SwarmView", () => {
  beforeEach(() => {
    resetMockStorage();
  });

  it("renders teams", () => {
    expect(mockTeams).toHaveLength(3);
  });

  it("finds a team by ID", () => {
    const team = getMockTeam("team-1");
    expect(team?.name).toBe("Research Squad");
  });
});
```

### With MSW (Mock Service Worker)

To set up MSW for full API mocking in development:

1. Install MSW:
```bash
npm install -D msw
```

2. Use the handlers:
```tsx
import { swarmHandlers } from "@/lib/mocks";

// In your MSW setup
export const handlers = [
  ...swarmHandlers,
  // other handlers
];
```

## Fixtures

### Teams
- **Research Squad**: 2 researchers (Aurora, Nexus)
- **Code Review Team**: 2 reviewers (Sentinel, Refactor)
- **Data Processing Squad**: 2 analysts (Analyzer, Guardian)

### Agents
- **Aurora**: Researcher, idle
- **Nexus**: Coordinator, idle
- **Sentinel**: Reviewer, busy
- **Refactor**: Optimizer, idle
- **Analyzer**: Data Scientist, busy
- **Guardian**: Security Officer, offline

## Adding New Mocks

### Add a fixture:
```tsx
// In fixtures.ts
export const mockNewAgent: SwarmAgent = {
  id: "agent-7",
  name: "Nova",
  role: "Architect",
  status: "idle",
  lastMessage: "Reviewing architecture",
};
```

### Add a handler:
```tsx
// In handlers.ts
{
  method: "DELETE",
  path: "/swarm/teams/:teamId",
  handler: ({ params }) => {
    mockStorage.teams = mockStorage.teams.filter(
      t => t.id !== params.teamId
    );
    return { success: true };
  },
}
```

## Utilities

- `getMockTeam(teamId)` - Get team by ID
- `getMockAgent(agentId)` - Get agent by ID
- `createMockTeam(name, description)` - Create new mock team
- `resetMockStorage()` - Reset to initial state
- `setMockTeams(teams)` - Set custom teams
- `getMockTeamsData()` - Get all teams data

## Notes

- Mocks are centralized for easy maintenance
- Fixtures can be reused across tests
- Handlers simulate API behavior without a real backend
- Storage persists during runtime (useful for integration tests)
