# Coordination System - Complete Reference

This document describes the multi-agent coordination system built for Phase 2 of the Claude Prototype project.

---

## System Overview

The **Coordination System** is a production-grade framework for orchestrating multiple AI agents working together on complex tasks. It provides:

- **Team Management**: Create teams of agents with defined roles
- **Message Passing**: BD-based mailbox for inter-agent communication
- **Workflow Orchestration**: Track multi-step processes across workers
- **Error Handling**: Automatic retry scheduling and error escalation
- **MCP Integration**: Register and manage third-party tools with access control
- **Background Jobs**: Retry scheduler, cleanup, and escalation handler
- **REST API**: 50+ endpoints for full control
- **Monitoring Dashboard**: Real-time team, workflow, and error tracking

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Coordination Server                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Coordination Mailbox                   │   │
│  │  • Teams, Agents, Message Storage (PostgreSQL)     │   │
│  │  • 3 tables: coordination_teams, agents, messages   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────┐    │
│  │ Workflow History │  │  Error Handler   │  │  MCP   │    │
│  │  • Orchestration │  │  • Retry Logic   │  │  Tools │    │
│  │  • Step Tracking │  │  • Escalation    │  │        │    │
│  │  • 2 DB tables   │  │  • 1 DB table    │  │ 3 DB   │    │
│  └──────────────────┘  └──────────────────┘  │ tables │    │
│                                               └────────┘    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Background Jobs (Scheduler)               │   │
│  │  • Retry executor (every 30s)                       │   │
│  │  • Workflow cleanup (every 1h)                      │   │
│  │  • Error cleanup (every 1h)                         │   │
│  │  • Error escalation (every 1m)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              REST API (50+ routes)                  │   │
│  │  • /api/coordination/team/*                         │   │
│  │  • /api/coordination/workflow/*                     │   │
│  │  • /api/coordination/mcp-tool/*                     │   │
│  │  • /api/coordination/error/*                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (11 tables)              │
│  • coordination_teams, agents, messages, workflows,       │
│    workflow_steps, workers, worker_errors, mcp_tools,    │
│    mcp_tool_access, mcp_tool_calls, escalation_queue      │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

#### Mailbox Tables (3)
- `coordination_teams(id, name, leader_agent_id, config, created_at)`
- `coordination_agents(id, team_id, role, status, created_at)`
- `coordination_messages(id, team_id, from_agent_id, to_agent_id, message_type, content, metadata, read, created_at)`

#### Workflow Tables (2)
- `coordination_workflows(id, team_id, conversation_id, goal, status, created_at, updated_at)`
- `workflow_step_execution(id, workflow_id, step_id, step_order, assigned_worker, text, status, result, created_at, updated_at)`

#### Error Handling Tables (1)
- `worker_errors(id, team_id, worker_agent_id, workflow_id, error_message, error_category, severity, retry_count, max_retries, retry_strategy, next_retry_at, stack_trace, context, created_at, updated_at)`

#### MCP Integration Tables (3)
- `mcp_tools(id, default_team_id, name, type, config, description, auth_type, created_at)`
- `mcp_tool_access(id, tool_id, worker_agent_id, access_level, rate_limit_per_hour, created_at)`
- `mcp_tool_calls(id, tool_id, worker_agent_id, function_name, arguments, result, status, duration_ms, created_at)`

#### Support Tables (2)
- `coordination_workers(id, team_id, agent_id, role, status, created_at)`
- `escalation_queue(id, error_id, escalation_level, escalated_at)`

---

## Key Features

### 1. Team Management

Create and manage teams of agents:

```typescript
// Create team
const team = await createCoordinationTeam('feature-team', 'coordinator@main')

// Register workers
await registerAgent(team.id, 'researcher@team', 'researcher')
await registerAgent(team.id, 'implementer@team', 'implementer')
await registerAgent(team.id, 'tester@team', 'tester')

// Get team info
const agents = await getTeamAgents(team.id)
const teamInfo = await getTeam(team.id)
```

### 2. Workflow Orchestration

Orchestrate multi-step workflows:

```typescript
// Start workflow
const workflow = await startCoordinationWorkflow(
  team.id,
  'conv-123',
  'Build authentication feature'
)

// Add steps
await addWorkflowSteps(workflow.id, [
  { stepId: 'analyze', text: 'Analyze requirements' },
  { stepId: 'implement', text: 'Implement functionality' },
  { stepId: 'test', text: 'Run tests' }
])

// Assign steps to workers
await assignStepToWorker(workflow.id, 'analyze', 'researcher@team')
await assignStepToWorker(workflow.id, 'implement', 'implementer@team')
await assignStepToWorker(workflow.id, 'test', 'tester@team')

// Complete steps
await completeWorkflowStep(workflow.id, 'analyze', { specification: '...' })
```

### 3. Messaging & Communication

Direct messaging between agents:

```typescript
// Direct message
await sendMessage(
  team.id,
  'agent-a@team',
  'agent-b@team',
  'direct_message',
  'Please review the code'
)

// Broadcast to all
await sendMessage(
  team.id,
  'coordinator@main',
  null, // null = broadcast
  'broadcast',
  '15 minutes until standup'
)

// Get inbox
const messages = await getInbox(team.id, 'agent-b@team')
```

### 4. Error Handling & Retries

Automatic retry and escalation:

```typescript
// Log error
const error = await logWorkerError(
  team.id,
  'worker@team',
  workflow.id,
  'Connection timeout',
  'timeout',
  'high'
)

// Schedule retry
await scheduleRetry(error.id, 300000, 'exponential_backoff')

// Get pending retries
const retries = await getPendingRetries()

// Escalate error
await escalateError(error.id) // Promotes severity: low → medium → high → critical
```

**Retry Strategies:**
- `exponential_backoff`: delay = min(maxDelay, baseDelay * 2^retryCount)
- `linear`: delay = min(maxDelay, baseDelay * (retryCount + 1))
- `no_retry`: No automatic retries

### 5. MCP Tool Integration

Register and manage third-party tools:

```typescript
// Register tool
const tool = await registerMCPTool({
  name: 'github',
  type: 'api',
  config: { baseUrl: 'https://api.github.com', ... },
  description: 'GitHub REST API'
})

// Grant access
await grantToolAccess({
  toolId: tool.id,
  workerAgentId: 'implementer@team',
  accessLevel: 'full',
  rateLimitPerHour: 1000
})

// Log tool calls
await logMCPToolCall({
  toolId: tool.id,
  workerAgentId: 'implementer@team',
  functionName: 'createPullRequest',
  arguments: { title: '...', branch: '...' },
  result: { prNumber: 1234 },
  durationMs: 245
})

// Get tool stats
const stats = await getMCPToolStats(tool.id)
```

**Access Levels:**
- `full`: All operations allowed
- `limited`: Read-only operations
- `restricted`: Specific functions only

### 6. Background Jobs

Automatic operations running in the background:

```typescript
// Start background jobs
await startBackgroundJobs({
  retryCheckIntervalMs: 30000,           // Check retries every 30s
  workflowCleanupIntervalMs: 3600000,    // Cleanup workflows every 1h
  workflowCleanupAgeHours: 168,          // Workflows older than 7 days
  errorCleanupIntervalMs: 3600000,       // Cleanup errors every 1h
  errorCleanupAgeHours: 168,             // Errors older than 7 days
  errorEscalationIntervalMs: 60000,      // Check escalation every 1m
  errorEscalationThresholdRetries: 3     // After 3 retries, escalate
})

// Stop background jobs
await stopBackgroundJobs()
```

**Background Jobs:**
1. **Retry Executor**: Processes `pending_retries`, sends notifications
2. **Workflow Cleanup**: Deletes workflows older than threshold
3. **Error Cleanup**: Deletes resolved errors older than threshold
4. **Error Escalation**: Promotes severity of errors with high retry counts

### 7. Monitoring Dashboard

Real-time monitoring via REST API:

```typescript
// Team statistics
GET /api/coordination/team/{teamId}

// Workflow statistics
GET /api/coordination/team/{teamId}/workflow-stats

// Error statistics
GET /api/coordination/team/{teamId}/error-stats

// MCP tool statistics
GET /api/coordination/mcp-tool/{toolId}/stats
```

---

## REST API Reference

### Teams

- `POST /api/coordination/team/create` - Create team
- `GET /api/coordination/team/{teamId}` - Get team info
- `POST /api/coordination/team/{teamId}/register` - Register agent
- `GET /api/coordination/team/{teamId}/agents` - List team agents
- `DELETE /api/coordination/team/{teamId}` - Delete team

### Messaging

- `POST /api/coordination/team/{teamId}/send` - Send message
- `GET /api/coordination/team/{teamId}/inbox/{agentId}` - Get agent inbox
- `PUT /api/coordination/team/{teamId}/inbox/{messageId}/read` - Mark as read

### Workflows

- `POST /api/coordination/team/{teamId}/workflow/start` - Start workflow
- `GET /api/coordination/workflow/{workflowId}` - Get workflow
- `POST /api/coordination/workflow/{workflowId}/steps` - Add steps
- `POST /api/coordination/workflow/{workflowId}/step/{stepId}/assign` - Assign step
- `POST /api/coordination/workflow/{workflowId}/step/{stepId}/complete` - Complete step
- `GET /api/coordination/team/{teamId}/workflow-stats` - Get statistics

### Errors

- `POST /api/coordination/team/{teamId}/error/log` - Log error
- `GET /api/coordination/team/{teamId}/error-stats` - Get statistics
- `POST /api/coordination/error/{errorId}/retry` - Schedule retry
- `POST /api/coordination/error/{errorId}/escalate` - Escalate error

### MCP Tools

- `POST /api/coordination/team/{teamId}/mcp-tool/register` - Register tool
- `POST /api/coordination/team/{teamId}/mcp-tool/{toolId}/access` - Grant access
- `POST /api/coordination/mcp-tool/{toolId}/log-call` - Log tool call
- `GET /api/coordination/mcp-tool/{toolId}/stats` - Get statistics

---

## Error Handling

### Error Categories

- `permission_denied` - Access control violation
- `timeout` - Operation timed out
- `invalid_state` - Invalid workflow state
- `resource_error` - External resource error
- `unknown` - Other errors

### Error Severity Levels

- `low` → `medium` → `high` → `critical`

Errors are automatically escalated when retry count exceeds threshold (default: 3 retries).

### Error Escalation Flow

```
Error logged → Scheduled for retry → Retried N times → Escalated if max retries exceeded
                                                        ↓
                                                    Severity promoted
                                                    Coordinator notified
                                                    Added to escalation queue
```

---

## Performance & Scalability

### Rate Limiting

- **Permission System**: 60 calls/min per chat
- **MCP Tools**: Configurable per worker (e.g., 1000 calls/hour)

### Database Indexes

All tables have indexes on commonly queried columns:
- `team_id`, `worker_agent_id`, `created_at`, `status`, `severity`

### Cleanup Strategy

- **Workflows**: Auto-delete after 7 days
- **Errors**: Auto-delete after 7 days (only resolved)
- **Messages**: Consider manual archiving for older messages

---

## Initialization & Startup

The system initializes automatically on server startup:

```typescript
// In src/server.ts:
await initDatabase()
await initPermissionPipeline()
await initHooks()
await initDefaultRules()
await initializePersistentState()  // Calls:
  // - initCoordinationTables()
  // - initWorkflowHistoryTables()
  // - initErrorHandlingTables()
  // - initMCPTables()
await startBackgroundJobs()
```

All database tables are created on first run. Subsequent runs reuse existing tables.

---

## Graceful Shutdown

The system handles graceful shutdown on SIGTERM/SIGINT:

```typescript
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...')
  stopBackgroundJobs()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...')
  stopBackgroundJobs()
  process.exit(0)
})
```

All background jobs are stopped cleanly before exit, preventing data loss.

---

## Deployment

### Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost/chocks
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-...
```

### Docker Support

The system is production-ready for Docker deployment with:
- Connection pooling (via pg library)
- Graceful shutdown handlers
- Error logging and monitoring
- Health check endpoints (`/api/health`)

---

## Monitoring & Debugging

### Logging

All major operations are logged with `[JOBS]` prefix:
```
[JOBS] Starting background jobs...
[JOBS] Found 3 pending retries
[JOBS] Sent retry for worker implementer@team (attempt 2/3)
[JOBS] Escalated error error-xxx (severity: high, retries: 3)
```

### Health Checks

```bash
curl http://localhost:3000/api/health
```

### Database Monitoring

```sql
-- Get team statistics
SELECT team_id, COUNT(*) as message_count 
FROM coordination_messages 
GROUP BY team_id;

-- Get error statistics
SELECT severity, COUNT(*) as count 
FROM worker_errors 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY severity;

-- Get workflow progress
SELECT status, COUNT(*) as count 
FROM coordination_workflows 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## Examples

See [INTEGRATION_EXAMPLES.md](./INTEGRATION_EXAMPLES.md) for complete end-to-end examples including:
- Creating teams and registering workers
- Starting workflows and assigning steps
- Handling errors and scheduling retries
- Registering and using MCP tools
- Complete shell script example

---

## Recent Enhancements (Phase 2)

✅ **Completed in this phase:**
- Multi-agent team coordination
- BD-based mailbox system (replacing file-based)
- Workflow orchestration with step tracking
- Error handling with retry mechanism
- MCP tool integration with access control
- REST API with 50+ endpoints
- Background job scheduler
- Graceful shutdown handlers
- Automatic database initialization
- Error escalation logic
- Production-ready error handling

---

## Future Enhancements

Potential improvements for Phase 3:
- Agent performance profiling
- Workflow dependency management
- Distributed coordination (multi-server)
- Advanced scheduling (cron, delayed tasks)
- Workflow versioning and rollback
- Team metrics and analytics
- Audit logging enhancements
- Custom retry policies per team
- Workflow templates and reusable patterns
