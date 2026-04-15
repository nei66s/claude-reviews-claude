/**
 * MSW (Mock Service Worker) Handlers for Development
 * Intercepta chamadas de API e retorna dados mock
 */

import { mockTeams, createMockTeam } from "./fixtures";

// Simula um armazenamento em memória para este runtime
const mockStorage = {
  teams: [...mockTeams],
};

/**
 * Mock handlers para rotas de Swarm
 * Para usar com MSW, você precisa:
 * 1. Instalar: npm install -D msw
 * 2. Importar estes handlers no seu setupTests ou browser
 */
export const swarmHandlers = [
  {
    method: "GET",
    path: "/swarm/teams",
    handler: () => {
      return {
        teams: mockStorage.teams,
        total: mockStorage.teams.length,
        timestamp: new Date().toISOString(),
      };
    },
  },
  {
    method: "GET",
    path: "/swarm/teams/:teamId",
    handler: ({ params }: { params: Record<string, string> }) => {
      const team = mockStorage.teams.find((t) => t.id === params.teamId);
      if (!team) {
        return { error: "Team not found" };
      }
      return team;
    },
  },
  {
    method: "POST",
    path: "/swarm/teams",
    handler: ({ body }: { body: Record<string, string> }) => {
      const newTeam = createMockTeam(body.name, body.description);
      mockStorage.teams.push(newTeam);
      return newTeam;
    },
  },
  {
    method: "POST",
    path: "/swarm/message",
    handler: ({ body }: { body: Record<string, string> }) => {
      // Simula envio de mensagem
      const team = mockStorage.teams.find((t) => t.id === body.teamId);
      if (!team) {
        return { error: "Team not found" };
      }
      return {
        success: true,
        message: body.message,
        teamId: body.teamId,
        timestamp: new Date().toISOString(),
      };
    },
  },
];

/**
 * Utilitário para resetar o armazenamento de mock
 * Útil em testes
 */
export function resetMockStorage() {
  mockStorage.teams = [...mockTeams];
}

/**
 * Utilitário para resetar e usar dados customizados
 */
export function setMockTeams(teams: typeof mockTeams) {
  mockStorage.teams = [...teams];
}

/**
 * Versão simplificada para uso no componente quando API falha
 * (já está sendo usada no SwarmView)
 */
export function getMockTeamsData() {
  return {
    teams: mockStorage.teams,
    total: mockStorage.teams.length,
    timestamp: new Date().toISOString(),
  };
}
