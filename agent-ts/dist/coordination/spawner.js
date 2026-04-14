/**
 * Coordinator Spawner
 * Dispatches worker agents to handle specific tasks
 */
import { createTeam, registerAgent, sendMessage, getTeamAgents, updateAgentStatus } from './mailbox.js';
/**
 * Spawn a new worker for the coordinator
 * Each worker is a separate agent instance with a unique ID
 */
export async function spawnWorker(teamId, coordinatorAgentId, spec) {
    // Generate unique worker ID
    const workerId = `${spec.role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const agentId = `${workerId}@${teamId}`;
    // Register worker in team
    await registerAgent(teamId, agentId, spec.role);
    // Mark worker as working
    await updateAgentStatus(teamId, agentId, 'working');
    // Send initial task prompt to worker
    const prompt = buildWorkerPrompt(spec, agentId, coordinatorAgentId);
    await sendMessage(teamId, coordinatorAgentId, agentId, 'task_notification', prompt, {
        goal: spec.goal,
        role: spec.role,
        context: spec.context,
    });
    return {
        agentId,
        teamId,
        role: spec.role,
        workerId,
    };
}
/**
 * Spawn multiple workers in parallel
 */
export async function spawnWorkers(teamId, coordinatorAgentId, specs) {
    return Promise.all(specs.map((spec) => spawnWorker(teamId, coordinatorAgentId, spec)));
}
/**
 * Build a self-contained prompt for worker
 * Workers can't see coordinator's context, so prompt must be complete
 */
function buildWorkerPrompt(spec, workerId, coordinatorId) {
    const lines = [
        `You are a specialized worker agent in a coordination team.`,
        ``,
        `Your role: ${spec.role}`,
        `Worker ID: ${workerId}`,
        `Coordinator ID: ${coordinatorId}`,
        ``,
        `GOAL:`,
        `${spec.goal}`,
        ``,
        `IMPORTANT RULES:`,
        `1. You have FULL context isolation - you cannot see the coordinator's conversation`,
        `2. This prompt contains everything you need to complete the task`,
        `3. When done, send "idle_notification" with status "completed" or "blocked"`,
        `4. For errors or permission requests, use "error_notification" or "permission_request"`,
        `5. Do NOT assume any file paths or context beyond what's provided above`,
        ``,
    ];
    if (spec.context) {
        lines.push(`CONTEXT:`);
        lines.push(`${JSON.stringify(spec.context, null, 2)}`);
        lines.push(``);
    }
    lines.push(`BEGIN WORK:`);
    return lines.join('\n');
}
/**
 * Create a new coordination team
 */
export async function createCoordinationTeam(leaderAgentId, teamName) {
    const teamId = await createTeam(teamName, leaderAgentId);
    // TODO: get team config from mailbox
    return {
        teamId,
        config: {
            id: teamId,
            name: teamName,
            leader_agent_id: leaderAgentId,
            created_at: new Date().toISOString(),
            config: null,
        },
    };
}
/**
 * Wait for worker to complete
 * Polls inbox for idle_notification or error_notification
 */
export async function waitForWorkerCompletion(teamId, workerId, timeoutMs = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        // In real implementation, poll mailbox for messages from workerId
        // For now, return after a delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return { status: 'blocked', result: 'Worker did not complete in time' };
}
/**
 * Send a follow-up message to a worker
 */
export async function sendWorkerMessage(teamId, coordinatorAgentId, workerAgentId, message) {
    return sendMessage(teamId, coordinatorAgentId, workerAgentId, 'direct_message', message);
}
/**
 * Get all workers in a team with their status
 */
export async function getTeamWorkers(teamId) {
    const agents = await getTeamAgents(teamId);
    return agents.map((agent) => ({
        ...agent,
        statusReadable: agent.status === 'idle'
            ? 'Idle'
            : agent.status === 'working'
                ? 'Working'
                : agent.status === 'blocked'
                    ? 'Blocked'
                    : 'Completed',
    }));
}
