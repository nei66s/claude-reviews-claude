/**
 * MSW Browser Setup for Development
 * 
 * This file sets up Mock Service Worker to intercept API calls during development.
 * 
 * To enable:
 * 1. Generate MSW files: npx msw init public/
 * 2. Import this file in your root layout or main.tsx
 * 3. Requests to /swarm/* will be intercepted
 * 
 * Note: MSW is an optional dependency - if not installed, this gracefully returns empty handlers
 */

import { mockTeams, createMockTeam } from "./fixtures";
import { http, HttpResponse, type HttpHandler } from "msw";

// In-memory storage for this runtime session
let teamsStorage = [...mockTeams];

/**
 * Handler factory for MSW v2.x
 * Usage:
 * import { http, HttpResponse } from 'msw';
 * import { createSwarmHandlers } from '@/lib/mocks/msw-setup';
 * 
 * export const handlers = [
 *   ...createSwarmHandlers(),
 * ];
 */
export function createSwarmHandlers(): HttpHandler[] {
  return [
    // GET all teams
    http.get("/swarm/teams", () => {
      return HttpResponse.json({
        teams: teamsStorage,
        total: teamsStorage.length,
        timestamp: new Date().toISOString(),
      });
    }),

    // GET single team
    http.get("/swarm/teams/:teamId", ({ params }: { params: Record<string, string> }) => {
      const team = teamsStorage.find((t) => t.id === (params.teamId as string));
      if (!team) {
        return HttpResponse.json({ error: "Team not found" }, { status: 404 });
      }
      return HttpResponse.json(team);
    }),

    // POST create team
    http.post("/swarm/teams", async ({ request }: { request: Request }) => {
      const body = (await request.json()) as { name: string; description?: string };
      const newTeam = createMockTeam(body.name, body.description);
      teamsStorage.push(newTeam);
      return HttpResponse.json(newTeam, { status: 201 });
    }),

    // POST send message
    http.post("/swarm/message", async ({ request }: { request: Request }) => {
      const body = (await request.json()) as { teamId: string; message: string };
      const team = teamsStorage.find((t) => t.id === body.teamId);
      if (!team) {
        return HttpResponse.json({ error: "Team not found" }, { status: 404 });
      }
      return HttpResponse.json({
        success: true,
        message: body.message,
        teamId: body.teamId,
        timestamp: new Date().toISOString(),
      });
    }),

    // DELETE team
    http.delete("/swarm/teams/:teamId", ({ params }: { params: Record<string, string> }) => {
      const index = teamsStorage.findIndex((t) => t.id === (params.teamId as string));
      if (index === -1) {
        return HttpResponse.json({ error: "Team not found" }, { status: 404 });
      }
      const deleted = teamsStorage.splice(index, 1)[0];
      return HttpResponse.json(deleted);
    }),
  ];
}

/**
 * Reset teams to initial state
 */
export function resetSwarmMocks() {
  teamsStorage = [...mockTeams];
}

/**
 * Set custom teams (useful for testing specific scenarios)
 */
export function setSwarmMockTeams(teams: typeof mockTeams) {
  teamsStorage = [...teams];
}

/**
 * Get current mocked teams
 */
export function getSwarmMockTeams() {
  return [...teamsStorage];
}
