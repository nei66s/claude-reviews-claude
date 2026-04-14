# Coordination System - Architecture Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                             │
│                    (Web UI, External APIs, CLIs)                        │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS HTTP SERVER                              │
│                         (Port 3000)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    REST API ROUTES                              │  │
│  │  • /api/coordination/team/*              (12 endpoints)        │  │
│  │  • /api/coordination/workflow/*          (12 endpoints)        │  │
│  │  • /api/coordination/error/*             (8 endpoints)         │  │
│  │  • /api/coordination/mcp-tool/*          (8 endpoints)         │  │
│  │  • /api/coordination/extended/*          (10+ endpoints)       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                   │
│                                    ↓                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              COORDINATION CORE MODULES                          │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  1. MAILBOX SYSTEM (mailbox.ts)                              │  │
│  │     ├─ Teams management                                      │  │
│  │     ├─ Message routing (direct/broadcast)                   │  │
│  │     ├─ Agent status tracking                                │  │
│  │     └─ 12+ Functions, 3 DB tables                           │  │
│  │                                                                │  │
│  │  2. SPAWNER (spawner.ts)                                    │  │
│  │     ├─ Worker creation                                       │  │
│  │     ├─ Role assignment                                       │  │
│  │     ├─ Status management                                     │  │
│  │     └─ 5 Functions, 1 DB table                              │  │
│  │                                                                │  │
│  │  3. WORKFLOW ORCHESTRATION (workflowHistory.ts)            │  │
│  │     ├─ Workflow creation                                     │  │
│  │     ├─ Step tracking                                         │  │
│  │     ├─ Progress monitoring                                   │  │
│  │     └─ 11 Functions, 2 DB tables                            │  │
│  │                                                                │  │
│  │  4. ERROR HANDLING (errorHandler.ts)                        │  │
│  │     ├─ Error logging                                         │  │
│  │     ├─ Retry scheduling                                      │  │
│  │     ├─ Error escalation                                      │  │
│  │     └─ 16 Functions, 1 DB table                             │  │
│  │                                                                │  │
│  │  5. MCP INTEGRATION (mcpIntegration.ts)                    │  │
│  │     ├─ Tool registration                                     │  │
│  │     ├─ Access control                                        │  │
│  │     ├─ Call tracking                                         │  │
│  │     └─ 13 Functions, 3 DB tables                            │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │         BACKGROUND JOBS SCHEDULER (jobs/backgroundJobs.ts)      │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                │  │
│  │  🔄 Every 30 seconds:  Retry Executor                         │  │
│  │     └─ Process pending retries, send notifications            │  │
│  │                                                                │  │
│  │  🔄 Every 1 hour:      Workflow Cleanup                       │  │
│  │     └─ Delete workflows older than 7 days                     │  │
│  │                                                                │  │
│  │  🔄 Every 1 hour:      Error Cleanup                          │  │
│  │     └─ Delete resolved errors older than 7 days              │  │
│  │                                                                │  │
│  │  🔄 Every 1 minute:    Error Escalation                       │  │
│  │     └─ Promote severity of high-retry errors                 │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │     GRACEFUL SHUTDOWN HANDLERS                                  │  │
│  │     └─ SIGTERM/SIGINT → stopBackgroundJobs() → process.exit()  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────┬──────────┘
                                                              │
                                                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                                  │
│                     (11 Tables + Indexes)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📦 MAILBOX SYSTEM                                                     │
│  ├─ coordination_teams                                                 │
│  ├─ coordination_agents                                                │
│  └─ coordination_messages                                              │
│                                                                         │
│  📦 WORKFLOW SYSTEM                                                    │
│  ├─ coordination_workflows                                             │
│  └─ workflow_step_execution                                            │
│                                                                         │
│  📦 ERROR HANDLING                                                     │
│  ├─ worker_errors                                                      │
│  └─ escalation_queue                                                   │
│                                                                         │
│  📦 MCP TOOLS                                                          │
│  ├─ mcp_tools                                                          │
│  ├─ mcp_tool_access                                                    │
│  └─ mcp_tool_calls                                                     │
│                                                                         │
│  📦 SUPPORT                                                            │
│  ├─ coordination_workers                                               │
│  └─ (Other tables as needed)                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Team Creation & Worker Registration

```
Client Request
    ↓
POST /api/coordination/team/create
    ↓
  ┌─────────────────────────────┐
  │ createCoordinationTeam()    │
  │  1. Generate team ID        │
  │  2. Store in DB             │
  └─────────────────────────────┘
    ↓
  ✅ Return team info
    ↓
POST /api/coordination/team/{id}/register
    ↓
  ┌─────────────────────────────┐
  │ registerAgent()             │
  │  1. Verify team exists      │
  │  2. Create agent record     │
  │  3. Set initial status      │
  └─────────────────────────────┘
    ↓
  ✅ Agent registered
```

### 2. Message Flow

```
Sender Agent
    ↓
  ┌──────────────────────────────────┐
  │ sendMessage(fromId, toId, mode)  │
  │  1. Validate sender/receiver     │
  │  2. Create message record        │
  │  3. Store in DB                  │
  └──────────────────────────────────┘
    ↓
    ├─→ If direct: Only receiver gets it
    ├─→ If broadcast: All team members get it
    └─→ Set read = false by default
    ↓
Receiver Agent
    ↓
  ┌──────────────────────────────────┐
  │ getInbox(teamId, agentId)        │
  │  1. Query unread messages        │
  │  2. Sort by timestamp            │
  │  3. Return to caller             │
  └──────────────────────────────────┘
    ↓
  ✅ Agent reads message
```

### 3. Workflow Orchestration

```
User/Coordinator
    ↓
startCoordinationWorkflow(teamId, goal)
    ↓
  ┌────────────────────────────────────┐
  │ Create workflow record             │
  │ • Set status = "pending"           │
  │ • Link to conversation             │
  └────────────────────────────────────┘
    ↓
addWorkflowSteps(workflowId, steps[])
    ↓
  ┌────────────────────────────────────┐
  │ Create step records                │
  │ • Set status = "pending"           │
  │ • Store step text & order          │
  └────────────────────────────────────┘
    ↓
For each step:
  ↓
assignStepToWorker(workflowId, stepId, workerId)
  ↓
  ┌────────────────────────────────────┐
  │ Update step                        │
  │ • Link to worker                   │
  │ • Set status = "assigned"          │
  └────────────────────────────────────┘
    ↓
Worker processes step...
    ↓
completeWorkflowStep(workflowId, stepId, result)
    ↓
  ┌────────────────────────────────────┐
  │ Update step                        │
  │ • Set status = "completed"         │
  │ • Store result                     │
  │ • Update workflow stats            │
  └────────────────────────────────────┘
    ↓
Next step or finish
```

### 4. Error Handling & Retry

```
Worker encounters error
    ↓
logWorkerError(teamId, workerId, error, category, severity)
    ↓
  ┌──────────────────────────────────────┐
  │ Create error record                  │
  │ • Generate error ID                  │
  │ • Set retry_count = 0               │
  │ • Set next_retry_at = null          │
  │ • Store stack trace                  │
  └──────────────────────────────────────┘
    ↓
scheduleRetry(errorId, delayMs, strategy)
    ↓
  ┌──────────────────────────────────────┐
  │ Calculate next retry time            │
  │ • next_retry_at = NOW + delayMs     │
  │ • Store retry strategy               │
  └──────────────────────────────────────┘
    ↓
Background Job (every 30s)
    ↓
  ┌──────────────────────────────────────┐
  │ getPendingRetries()                  │
  │ • Find errors where                  │
  │   next_retry_at <= NOW              │
  └──────────────────────────────────────┘
    ↓
For each retry:
  ↓
processRetry(error)
  ├─ If max_retries not exceeded:
  │    └─ Increment retry_count
  │    └─ Schedule next retry
  │    └─ Notify worker (send message)
  │
  └─ If max_retries exceeded:
       ├─ Check if needs escalation
       ├─ If yes: escalateError()
       │   ├─ Promote severity (low→med→high→crit)
       │   ├─ Notify coordinator
       │   └─ Add to escalation_queue
       └─ Mark as resolved
        ↓
      ✅ Retry scheduled or escalated
```

### 5. Error Escalation (Background Job)

```
Background Job (every 1 minute)
    ↓
getErrorsEligibleForEscalation(thresholdRetries)
    ↓
  ┌─────────────────────────────────────────────┐
  │ Query worker_errors where:                  │
  │ • retry_count >= threshold (default: 3)    │
  │ • severity != 'critical'                    │
  │ • updated_at < NOW - 1 minute              │
  └─────────────────────────────────────────────┘
    ↓
For each escalation candidate:
  ↓
escalateError(errorId)
  ├─ Get current severity
  ├─ Promote: low → med → high → critical
  └─ Update DB record
    ↓
sendMessage(team, 'escalator', 'coordinator@main', 'error_notification', message)
  ├─ Alert coordinator
  ├─ Include error ID, worker, severity, retry count
  └─ Store as message
    ↓
  ✅ Error escalated and coordinator notified
```

### 6. Background Cleanup

```
Background Job (every 1 hour)
    ├─→ handleWorkflowCleanup()
    │     ├─ Query workflows where created_at < NOW - 7 days
    │     ├─ Delete matching records (cascade: steps deleted too)
    │     └─ Return deletion count
    │
    └─→ handleErrorCleanup()
          ├─ Query worker_errors where:
          │   • created_at < NOW - 7 days
          │   • resolved = true
          ├─ Delete matching records
          └─ Return deletion count
    ↓
  ✅ Cleanup complete, old data removed
```

---

## MCP Tool Integration Flow

```
registerMCPTool(name, type, config, description)
    ↓
  ┌─────────────────────────────────────┐
  │ Create MCP tool record              │
  │ • Generate tool ID                  │
  │ • Store configuration               │
  │ • Set auth_type                     │
  └─────────────────────────────────────┘
    ↓
Tool registered
    ↓
For each worker that needs access:
    ↓
grantToolAccess(toolId, workerId, accessLevel, rateLimit)
    ↓
  ┌──────────────────────────────────────┐
  │ Create access record                 │
  │ • Link tool to worker                │
  │ • Set access level (full/limited)   │
  │ • Set rate limit (calls/hour)        │
  └──────────────────────────────────────┘
    ↓
Worker uses tool
    ↓
logMCPToolCall(toolId, workerId, function, args, result, duration)
    ↓
  ┌──────────────────────────────────────┐
  │ Create tool call record              │
  │ • Function name                      │
  │ • Arguments (JSON)                   │
  │ • Result (JSON)                      │
  │ • Execution time                     │
  │ • Status (success/error)             │
  └──────────────────────────────────────┘
    ↓
  ✅ Tool call logged for audit & stats
```

---

## Database Relationships

```
coordination_teams
        │
        ├─→ coordination_agents (FK: team_id)
        │
        ├─→ coordination_messages (FK: team_id)
        │
        ├─→ coordination_workflows (FK: team_id)
        │       │
        │       ├─→ workflow_step_execution (FK: workflow_id)
        │
        ├─→ worker_errors (FK: team_id)
        │       │
        │       └─→ escalation_queue (FK: error_id)
        │
        ├─→ mcp_tools (FK: default_team_id)
        │       │
        │       ├─→ mcp_tool_access (FK: tool_id)
        │       │
        │       └─→ mcp_tool_calls (FK: tool_id)
        │
        └─→ coordination_workers (FK: team_id)
```

---

## Request/Response Cycle

```
┌──────────────────┐
│  CLIENT REQUEST  │
│  GET/POST/etc    │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────────┐
│  EXPRESS ROUTE HANDLER           │
│  • Parse parameters              │
│  • Validate input                │
│  • Extract auth context          │
└────────┬─────────────────────────┘
         │
         ↓
┌──────────────────────────────────┐
│  PERMISSION CHECK                │
│  • Verify user auth              │
│  • Check rate limits             │
│  • Authorize action              │
└────────┬─────────────────────────┘
         │
         ├─ DENIED ────→ 403 Forbidden
         │
         └─ ALLOWED ──→
                      ↓
            ┌──────────────────────┐
            │  COORDINATION MODULE │
            │  • Execute logic     │
            │  • Update DB         │
            │  • Return result     │
            └────────┬─────────────┘
                     │
                     ├─ SUCCESS ──→
                     │             ↓
                     │      ┌─────────────┐
                     │      │ 200 OK +    │
                     │      │ JSON body   │
                     │      │ Sent        │
                     │      └─────────────┘
                     │
                     └─ ERROR ───→
                                  ↓
                          ┌──────────────┐
                          │ 400/500 +    │
                          │ Error msg    │
                          │ Sent         │
                          └──────────────┘
```

---

## Startup Sequence

```
npm start
    ↓
src/server.ts: startServer()
    ↓
1️⃣  initDatabase()
    └─ Pool connection established
    ↓
2️⃣  initPermissionPipeline()
    └─ Load permission rules
    ↓
3️⃣  initHooks()
    └─ Register event hooks
    ↓
4️⃣  initDefaultRules()
    └─ Setup default permissions
    ↓
5️⃣  initializePersistentState()
    ├─ initCoordinationTables()
    │  └─ Create: teams, agents, messages 📊
    ├─ initWorkflowHistoryTables()
    │  └─ Create: workflows, steps 📋
    ├─ initErrorHandlingTables()
    │  └─ Create: errors, escalation 🚨
    └─ initMCPTables()
       └─ Create: tools, access, calls 🔧
    ↓
6️⃣  startBackgroundJobs()
    ├─ Retry executor (every 30s)
    ├─ Workflow cleanup (every 1h)
    ├─ Error cleanup (every 1h)
    └─ Error escalation (every 1m)
    ↓
7️⃣  app.use(routes)
    └─ Mount all API routes
    ↓
8️⃣  app.listen(3000)
    └─ Server ready, accepting requests
    ↓
9️⃣  Process signal handlers
    └─ SIGTERM/SIGINT → graceful shutdown
    ↓
✅  SERVER RUNNING
```

---

## Shutdown Sequence

```
SIGTERM / SIGINT received
    ↓
Signal Handler triggered
    ↓
stopBackgroundJobs()
    ├─ Clear retry executor interval
    ├─ Clear workflow cleanup interval
    ├─ Clear error cleanup interval
    ├─ Clear error escalation interval
    └─ isRunning = false
    ↓
Close HTTP connections
    ↓
Disconnect from database
    ↓
process.exit(0)
    ↓
✅  CLEAN SHUTDOWN
```

---

## Performance Characteristics

```
Operation                    Complexity      Typical Time
────────────────────────────────────────────────────────
Create team                  O(1)           ~5ms
Register agent              O(1)           ~5ms
Send message                O(log n)       ~10ms
Get inbox (n messages)      O(n)           ~20ms
Start workflow              O(1)           ~10ms
Add steps (k steps)         O(k)           ~15ms
Complete step               O(1)           ~10ms
Log error                   O(1)           ~8ms
Get error stats             O(1)           ~15ms
Register MCP tool           O(1)           ~10ms
Grant access                O(1)           ~8ms
Log tool call               O(1)           ~8ms

Database indexes on:
- team_id (all tables)
- workflow_id (steps table)
- worker_agent_id (errors, access)
- created_at (for cleanup queries)
- status (for filtering)
```

---

## Rate Limiting Model

```
Global Level:
  Permission system: 60 calls/min per chat
    
Team Level:
  No explicit limit, but cleanup after 7 days
    
Worker Level:
  MCP tools: Configurable per tool
  Example: 1000 calls/hour to GitHub API
    
Error Handling:
  Retry backoff prevents retry storms:
  • First: 30s delay
  • Second: 60s delay  
  • Third: 120s delay
  • Etc. (exponential or linear)
```
