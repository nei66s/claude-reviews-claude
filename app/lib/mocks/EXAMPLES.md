/**
 * Example: How to use mocks in your tests
 * 
 * This file demonstrates different ways to use the mock library
 */

// ============================================================================
// Example 1: Using mocks in a Vitest unit test
// ============================================================================

import { describe, it, expect } from "vitest";
import { mockTeams, getMockTeam, resetMockStorage } from "@/lib/mocks";

describe("Example: Unit Tests with Mocks", () => {
  beforeEach(() => {
    resetMockStorage();
  });

  it("should render teams from mocks", () => {
    // Your component uses mocks when API fails
    const teams = mockTeams;
    expect(teams).toHaveLength(3);
    expect(teams[0].agents).toHaveLength(2);
  });

  it("should find specific team", () => {
    const team = getMockTeam("team-1");
    expect(team?.name).toBe("Research Squad");
  });
});

// ============================================================================
// Example 2: Using mocks in a React component test (with React Testing Library)
// ============================================================================

// import { render, screen } from "@testing-library/react";
// import SwarmView from "@/components/SwarmView";
// import { setMockTeams, createMockTeam } from "@/lib/mocks";
//
// describe("SwarmView with Mocks", () => {
//   it("displays mock teams when API fails", () => {
//     // Component will automat ically use mocks on API failure
//     render(<SwarmView />);
//
//     // After loading, should display mock teams
//     // (timing depends on your component's error handling)
//     expect(screen.queryByText("Research Squad")).toBeInTheDocument();
//   });
//
//   it("works with custom mock data", () => {
//     const customTeams = [
//       createMockTeam("Custom Team"),
//     ];
//     setMockTeams(customTeams);
//
//     render(<SwarmView />);
//     expect(screen.queryByText("Custom Team")).toBeInTheDocument();
//   });
// });

// ============================================================================
// Example 3: Using mocks with MSW (Mock Service Worker)
// ============================================================================

// import { setupServer } from "msw/node";
// import { createSwarmHandlers } from "@/lib/mocks/msw-setup";
// import { http, HttpResponse } from "msw";
//
// // Create MSW server with swarm handlers
// const server = setupServer(
//   ...createSwarmHandlers(),
//   // Add other handlers as needed
// );
//
// // Global setup/teardown for all tests
// beforeAll(() => server.listen());
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());
//
// describe("API Tests with MSW", () => {
//   it("fetches teams from mock API", async () => {
//     const response = await fetch("/swarm/teams");
//     const data = await response.json();
//
//     expect(data.teams).toHaveLength(3);
//     expect(data.total).toBe(3);
//   });
//
//   it("can override mock handlers", async () => {
//     server.use(
//       http.get("/swarm/teams", () => {
//         return HttpResponse.json({
//           teams: [],
//           total: 0,
//         });
//       })
//     );
//
//     const response = await fetch("/swarm/teams");
//     const data = await response.json();
//
//     expect(data.teams).toHaveLength(0);
//   });
// });

// ============================================================================
// Example 4: Integration test with mock data
// ============================================================================

// import { render, screen, waitFor } from "@testing-library/react";
// import userEvent from "@testing-library/user-event";
// import SwarmView from "@/components/SwarmView";
// import { getMockTeamsData } from "@/lib/mocks";
//
// describe("SwarmView Integration Tests", () => {
//   it("should expand team details when clicked", async () => {
//     const user = userEvent.setup();
//     render(<SwarmView />);
//
//     // Wait for mock data to load
//     await waitFor(() => {
//       expect(screen.getByText("Research Squad")).toBeInTheDocument();
//     });
//
//     // Click team to expand
//     await user.click(screen.getByText("Research Squad"));
//
//     // Should show agents
//     await waitFor(() => {
//       expect(screen.getByText("Aurora")).toBeInTheDocument();
//       expect(screen.getByText("Nexus")).toBeInTheDocument();
//     });
//   });
//
//   it("should send message to team", async () => {
//     const user = userEvent.setup();
//     render(<SwarmView />);
//
//     // Wait for teams to load
//     await waitFor(() => {
//       expect(screen.getByText("Research Squad")).toBeInTheDocument();
//     });
//
//     // Expand team
//     await user.click(screen.getByText("Research Squad"));
//
//     // Type and send message
//     const textarea = screen.getByPlaceholderText(
//       /Envie uma mensagem para Research Squad/
//     );
//     await user.type(textarea, "Test message");
//     await user.click(screen.getByRole("button", { name: /Enviar/ }));
//
//     // Verify message was sent (check for success feedback)
//   });
// });

// ============================================================================
// Example 5: Snapshot testing with mocks
// ============================================================================

// import { render } from "@testing-library/react";
// import SwarmView from "@/components/SwarmView";
//
// describe("SwarmView Snapshots", () => {
//   it("matches snapshot", () => {
//     const { container } = render(<SwarmView />);
//     expect(container).toMatchSnapshot();
//   });
// });

// ============================================================================
// Example 6: E2E/Playwright test simulation
// ============================================================================

// import { test, expect } from "@playwright/test";
//
// test.describe("SwarmView E2E", () => {
//   test("should load and display teams", async ({ page }) => {
//     await page.goto("http://localhost:3000/swarm");
//
//     // Wait for mock teams to load
//     await expect(page.locator("text=Research Squad")).toBeVisible();
//     await expect(page.locator("text=Code Review Team")).toBeVisible();
//   });
//
//   test("should expand team and show agents", async ({ page }) => {
//     await page.goto("http://localhost:3000/swarm");
//
//     // Click team
//     await page.click("text=Research Squad");
//
//     // Should show agents
//     await expect(page.locator("text=Aurora")).toBeVisible();
//     await expect(page.locator("text=Nexus")).toBeVisible();
//   });
// });

export const exampleMockUsage = {
  description: "See the comments above for usage examples",
};
