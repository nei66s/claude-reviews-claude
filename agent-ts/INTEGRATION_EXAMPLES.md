# Coordination System - Integration Examples

Complete end-to-end examples for using the coordination system.

---

## 1. Basic Team Setup

### Create a Team

```bash
# Create a new coordination team
curl -X POST http://localhost:3000/api/coordination/team/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "feature-build-team",
    "leaderAgentId": "coordinator@main",
    "config": {
      "description": "Team for building new feature X"
    }
  }'

# Response:
# {
#   "success": true,
#   "teamId": "team-1712345678900-abc123"
# }
```

### Register Workers

```bash
TEAM_ID="team-1712345678900-abc123"

# Register researcher worker
curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/register \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "researcher@feature-x",
    "role": "researcher"
  }'

# Register implementer worker
curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/register \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "implementer@feature-x",
    "role": "implementer"
  }'

# Register tester worker
curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/register \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "tester@feature-x",
    "role": "tester"
  }'
```

---

## 2. Workflow Orchestration

### Start a Workflow

```bash
TEAM_ID="team-1712345678900-abc123"
CONV_ID="conv-$(date +%s)"

# Start workflow
curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/workflow/start \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "'$CONV_ID'",
    "goal": "Build and test user authentication feature",
    "initiatedBy": "user@company.com"
  }'

# Response:
# {
#   "success": true,
#   "workflowId": "workflow-1712345678900-abc123"
# }
```

### Add Steps to Workflow

```bash
TEAM_ID="team-1712345678900-abc123"
WORKFLOW_ID="workflow-1712345678900-abc123"

curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/steps \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      {
        "stepId": "analyze-requirements",
        "text": "Analyze requirements and create technical specification"
      },
      {
        "stepId": "implement-auth",
        "text": "Implement OAuth2 authentication flow"
      },
      {
        "stepId": "write-tests",
        "text": "Write unit and integration tests"
      },
      {
        "stepId": "performance-test",
        "text": "Run performance benchmarks"
      }
    ]
  }'
```

### Assign Steps To Workers

```bash
WORKFLOW_ID="workflow-1712345678900-abc123"

# Assign first step to researcher
curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/step/analyze-requirements/assign \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "researcher@feature-x"
  }'

# Assign implementation step
curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/step/implement-auth/assign \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "implementer@feature-x"
  }'

# Assign tests step
curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/step/write-tests/assign \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "tester@feature-x"
  }'

# Assign performance step
curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/step/performance-test/assign \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "tester@feature-x"
  }'
```

### Complete Workflow Steps

```bash
WORKFLOW_ID="workflow-1712345678900-abc123"

# Research complete
curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/step/analyze-requirements/complete \
  -H "Content-Type: application/json" \
  -d '{
    "result": {
      "specification": "OAuth2 with Spring Security",
      "estimatedDays": 5,
      "risks": ["Third-party dependency risk"]
    }
  }'

# Implementation complete
curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/step/implement-auth/complete \
  -H "Content-Type: application/json" \
  -d '{
    "result": {
      "filesModified": ["AuthController.java", "SecurityConfig.java"],
      "linesAdded": 342
    }
  }'

# Tests complete
curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/step/write-tests/complete \
  -H "Content-Type: application/json" \
  -d '{
    "result": {
      "testsPassed": 45,
      "coverage": 94.5
    }
  }'

# Performance tests complete
curl -X POST http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/step/performance-test/complete \
  -H "Content-Type: application/json" \
  -d '{
    "result": {
      "avgLatency": 25,
      "throughput": 5000
    }
  }'
```

### Get Workflow Status

```bash
WORKFLOW_ID="workflow-1712345678900-abc123"

# Get workflow
curl http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID

# Get steps
curl http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID/steps

# Get stats
curl http://localhost:3000/api/coordination/team/$TEAM_ID/workflow-stats
```

---

## 3. Error Handling & Retries

### Simulate Worker Error

```bash
TEAM_ID="team-1712345678900-abc123"

curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/error/log \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "implementer@feature-x",
    "errorMessage": "Failed to connect to OAuth provider (timeout after 30s)",
    "category": "timeout",
    "severity": "high",
    "maxRetries": 3,
    "stackTrace": "Error: ECONNREFUSED...\n  at Timeout.main (auth.ts:42)"
  }'

# Response:
# {
#   "success": true,
#   "errorId": "error-1712345678900-abc123"
# }
```

### Schedule Retry

```bash
ERROR_ID="error-1712345678900-abc123"

# Schedule retry for 5 minutes from now
curl -X POST http://localhost:3000/api/coordination/error/$ERROR_ID/retry \
  -H "Content-Type: application/json" \
  -d '{
    "delaySeconds": 300
  }'

# Response:
# { "success": true }
```

### Get Error Statistics

```bash
TEAM_ID="team-1712345678900-abc123"

curl http://localhost:3000/api/coordination/team/$TEAM_ID/error-stats

# Response:
# {
#   "total": 5,
#   "byCategory": {
#     "timeout": 2,
#     "permission_denied": 1,
#     "resource_error": 2
#   },
#   "bySeverity": {
#     "low": 1,
#     "medium": 2,
#     "high": 2,
#     "critical": 0
#   },
#   "pendingRetries": 2
# }
```

---

## 4. MCP Tool Integration

### Register External Tools

```bash
TEAM_ID="team-1712345678900-abc123"

# Register GitHub API
curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/mcp-tool/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github",
    "type": "api",
    "config": {
      "baseUrl": "https://api.github.com",
      "owner": "company",
      "repo": "project"
    },
    "description": "GitHub REST API for repo operations",
    "authType": "token"
  }'

# Response:
# {
#   "success": true,
#   "toolId": "mcp-api-1712345678900-abc123"
# }
```

### Grant Tool Access

```bash
TEAM_ID="team-1712345678900-abc123"
TOOL_ID="mcp-api-1712345678900-abc123"

# Grant full access to implementer, 1000 calls/hour limit
curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/mcp-tool/$TOOL_ID/access \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "implementer@feature-x",
    "accessLevel": "full",
    "rateLimit": 1000
  }'

# Grant limited access to researcher, 100 calls/hour
curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/mcp-tool/$TOOL_ID/access \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "researcher@feature-x",
    "accessLevel": "limited",
    "rateLimit": 100
  }'
```

### Log Tool Call

```bash
TOOL_ID="mcp-api-1712345678900-abc123"

curl -X POST http://localhost:3000/api/coordination/mcp-tool/$TOOL_ID/log-call \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "implementer@feature-x",
    "functionName": "createPullRequest",
    "arguments": {
      "title": "auth: implement oauth2",
      "branch": "feature/oauth2"
    },
    "result": {
      "prNumber": 1234,
      "url": "https://github.com/company/project/pull/1234"
    },
    "durationMs": 245
  }'
```

### Get Tool Usage Stats

```bash
TOOL_ID="mcp-api-1712345678900-abc123"

curl http://localhost:3000/api/coordination/mcp-tool/$TOOL_ID/stats

# Response:
# {
#   "totalCalls": 45,
#   "successfulCalls": 43,
#   "failedCalls": 2,
#   "avgDurationMs": 234
# }
```

---

## 5. Messaging & Coordination

### Send Direct Message to Worker

```bash
TEAM_ID="team-1712345678900-abc123"

curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/send \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "coordinator@main",
    "toAgentId": "implementer@feature-x",
    "messageType": "direct_message",
    "content": "Please prioritize the OAuth2 implementation. Client needs it by Friday."
  }'
```

### Send Broadcast to All Workers

```bash
TEAM_ID="team-1712345678900-abc123"

curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/send \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "coordinator@main",
    "toAgentId": null,
    "messageType": "broadcast",
    "content": "15 minutes until standup. Be ready to report progress."
  }'
```

### Get Worker Inbox

```bash
TEAM_ID="team-1712345678900-abc123"

curl http://localhost:3000/api/coordination/team/$TEAM_ID/inbox/implementer@feature-x

# Response:
# {
#   "messages": [
#     {
#       "id": "msg-xxx",
#       "from_agent_id": "coordinator@main",
#       "message_type": "direct_message",
#       "content": "Please prioritize the OAuth2 implementation...",
#       "read": false,
#       "created_at": "2024-04-13T10:30:00Z"
#     }
#   ],
#   "count": 1
# }
```

---

## 6. Complete Workflow Example (Full Script)

```bash
#!/bin/bash

# team name and IDs
TEAM_NAME="demo-team-$(date +%s)"
TEAM_ID=""
WORKFLOW_ID=""

echo "=== Coordination System Demo ==="
echo ""

# Step 1: Create team
echo "1. Creating team..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/coordination/team/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'$TEAM_NAME'",
    "leaderAgentId": "demo-coordinator"
  }')
TEAM_ID=$(echo $RESPONSE | grep -o '"teamId":"[^"]*' | cut -d'"' -f4)
echo "   Team created: $TEAM_ID"

# Step 2: Register workers
echo "2. Registering workers..."
for ROLE in researcher implementer tester; do
  curl -s -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/register \
    -H "Content-Type: application/json" \
    -d '{"agentId":"'$ROLE'@'$TEAM_NAME'","role":"'$ROLE'"}' > /dev/null
  echo "   Registered $ROLE"
done

# Step 3: Start workflow
echo "3. Starting workflow..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/workflow/start \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "demo-'$(date +%s)'",
    "goal": "Build demo feature",
    "initiatedBy": "demo-user"
  }')
WORKFLOW_ID=$(echo $RESPONSE | grep -o '"workflowId":"[^"]*' | cut -d'"' -f4)
echo "   Workflow created: $WORKFLOW_ID"

# Step 4: Get team info
echo "4. Team status:"
curl -s http://localhost:3000/api/coordination/team/$TEAM_ID/agents | grep -o '"agent_id":"[^"]*' | cut -d'"' -f4

echo ""
echo "=== Demo Complete ==="
echo "Team ID: $TEAM_ID"
echo "Workflow ID: $WORKFLOW_ID"
echo ""
echo "Try:"
echo "  curl http://localhost:3000/api/coordination/team/$TEAM_ID"
echo "  curl http://localhost:3000/api/coordination/workflow/$WORKFLOW_ID"
```

---

## Performance & Best Practices

### Rate Limiting
- Default: 60 calls/min per chat (permission system)
- MCP tools: Configurable per worker (e.g., 1000 calls/hour)

### Retry Strategy
- Exponential backoff: `delay = min(maxDelay, baseDelay * 2^retryCount)`
- Linear backoff: `delay = min(maxDelay, baseDelay * (retryCount + 1))`
- Default: exponential, max 300s

### Cleanup
- Workflows: Auto-cleanup after 7 days
- Errors: Auto-cleanup after 7 days (unresolved only)
- Background jobs: Run every 30s-60m depending on job

### Monitoring
- Check `/api/coordination/team/{teamId}/workflow-stats` for workflow progress
- Check `/api/coordination/team/{teamId}/error-stats` for error trends
- Check `/api/coordination/mcp-tool/{toolId}/stats` for tool usage
