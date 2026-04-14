/**
 * Coordination REST API Routes
 * POST /api/coordination/team/create - Create team
 * POST /api/coordination/team/{teamId}/spawn - Spawn worker
 * GET /api/coordination/team/{teamId}/inbox - Get inbox
 * POST /api/coordination/team/{teamId}/inbox/{messageId}/read - Mark as read
 * GET /api/coordination/team/{teamId}/agents - List team agents
 * POST /api/coordination/team/{teamId}/send - Send message
 */
import { Router } from 'express';
import { createTeam, getInbox, markAsRead, sendMessage, getTeam, getAllTeams, registerAgent, updateAgentStatus, getMessageHistory, deleteTeam, } from '../coordination/index.js';
import { spawnWorker, getTeamWorkers } from '../coordination/spawner.js';
const router = Router();
// Create a new team
router.post('/team/create', async (req, res) => {
    try {
        const { name, leaderAgentId, config } = req.body;
        if (!name || !leaderAgentId) {
            return res.status(400).json({ error: 'Missing name or leaderAgentId' });
        }
        const teamId = await createTeam(name, leaderAgentId, config);
        res.json({ success: true, teamId });
    }
    catch (error) {
        console.error('Failed to create team', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get all teams
router.get('/team', async (req, res) => {
    try {
        const teams = await getAllTeams();
        res.json({ teams });
    }
    catch (error) {
        console.error('Failed to get teams', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get team info
router.get('/team/:teamId', async (req, res) => {
    try {
        const team = await getTeam(req.params.teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.json(team);
    }
    catch (error) {
        console.error('Failed to get team', error);
        res.status(500).json({ error: String(error) });
    }
});
// Register an agent in a team
router.post('/team/:teamId/register', async (req, res) => {
    try {
        const { agentId, role } = req.body;
        if (!agentId || !role) {
            return res.status(400).json({ error: 'Missing agentId or role' });
        }
        const id = await registerAgent(req.params.teamId, agentId, role);
        res.json({ success: true, id });
    }
    catch (error) {
        console.error('Failed to register agent', error);
        res.status(500).json({ error: String(error) });
    }
});
// Spawn a new worker
router.post('/team/:teamId/spawn', async (req, res) => {
    try {
        const { coordinatorAgentId, role, goal, context } = req.body;
        if (!coordinatorAgentId || !role || !goal) {
            return res.status(400).json({ error: 'Missing coordinatorAgentId, role, or goal' });
        }
        const worker = await spawnWorker(req.params.teamId, coordinatorAgentId, {
            role,
            goal,
            context,
        });
        res.json({ success: true, worker });
    }
    catch (error) {
        console.error('Failed to spawn worker', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get inbox for an agent
router.get('/team/:teamId/inbox/:agentId', async (req, res) => {
    try {
        const messages = await getInbox(req.params.teamId, req.params.agentId);
        res.json({ messages, count: messages.length });
    }
    catch (error) {
        console.error('Failed to get inbox', error);
        res.status(500).json({ error: String(error) });
    }
});
// Mark message as read
router.post('/team/:teamId/message/:messageId/read', async (req, res) => {
    try {
        await markAsRead(req.params.messageId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Failed to mark message as read', error);
        res.status(500).json({ error: String(error) });
    }
});
// Send a message
router.post('/team/:teamId/send', async (req, res) => {
    try {
        const { fromAgentId, toAgentId, messageType, content, metadata } = req.body;
        if (!fromAgentId || !messageType || !content) {
            return res.status(400).json({ error: 'Missing fromAgentId, messageType, or content' });
        }
        const messageId = await sendMessage(req.params.teamId, fromAgentId, toAgentId || null, messageType, content, metadata);
        res.json({ success: true, messageId });
    }
    catch (error) {
        console.error('Failed to send message', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get all agents in team
router.get('/team/:teamId/agents', async (req, res) => {
    try {
        const agents = await getTeamWorkers(req.params.teamId);
        res.json({ agents, count: agents.length });
    }
    catch (error) {
        console.error('Failed to get team agents', error);
        res.status(500).json({ error: String(error) });
    }
});
// Update agent status
router.patch('/team/:teamId/agent/:agentId/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!status || !['idle', 'working', 'blocked', 'completed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        await updateAgentStatus(req.params.teamId, req.params.agentId, status);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Failed to update agent status', error);
        res.status(500).json({ error: String(error) });
    }
});
// Get message history
router.get('/team/:teamId/history', async (req, res) => {
    try {
        const { fromAgentId, toAgentId, limit } = req.query;
        const messages = await getMessageHistory(req.params.teamId, String(fromAgentId || ''), String(toAgentId || ''), Number(limit) || 100);
        res.json({ messages, count: messages.length });
    }
    catch (error) {
        console.error('Failed to get message history', error);
        res.status(500).json({ error: String(error) });
    }
});
// Delete team
router.delete('/team/:teamId', async (req, res) => {
    try {
        await deleteTeam(req.params.teamId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Failed to delete team', error);
        res.status(500).json({ error: String(error) });
    }
});
export default router;
