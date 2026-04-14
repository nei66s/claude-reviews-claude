# API REST Endpoints — Permission Rules & Audit

## Permission Rules Management

### Deny Rules

**POST /api/permissions/deny-rules**
```json
{
  "id": "deny-bash-exec-1",
  "tools": ["bash_exec"],
  "reason": "Bash execution disabled for this workspace",
  "conditionJson": {}
}
```
Response: `{ ok: true, id: "deny-bash-exec-1" }`

**GET /api/permissions/deny-rules**
Lists all deny rules from database.
Response: Array of deny rules with timestamps

**DELETE /api/permissions/deny-rules/:id**
Delete a specific deny rule.

---

### Ask Rules

**POST /api/permissions/ask-rules**
```json
{
  "id": "ask-file-delete-1",
  "tools": ["file_delete"],
  "message": "File deletion requires explicit chat approval",
  "conditionJson": {}
}
```
Response: `{ ok: true, id: "ask-file-delete-1" }`

**GET /api/permissions/ask-rules**
Lists all ask rules.

**DELETE /api/permissions/ask-rules/:id**
Delete a specific ask rule.

---

### Approvals

**POST /api/permissions/approvals**
Record an approval for a chat (valid 1 hour by default):
```json
{
  "ruleId": "ask-file-delete-1",
  "chatId": "chat-123",
  "expiresInMs": 3600000
}
```
Response: `{ ok: true, ruleId, chatId }`

**GET /api/permissions/approvals/:chatId**
List all active approvals for a chat.

**DELETE /api/permissions/approvals/:ruleId/:chatId**
Revoke an approval.

**GET /api/permissions/status/:ruleId/:chatId**
Check if a rule is approved for a specific chat.

---

## Audit Log

### Logs

**GET /api/audit/logs/:chatId?limit=100&offset=0**
Get audit logs for a specific chat.

**GET /api/audit/action/:action?limit=100**
Get logs filtered by action type (ex: FILE_READ, BASH_EXEC).

**GET /api/audit/denied?limit=100**
Security review: all denied actions across all chats.

**GET /api/audit/stats**
Overall statistics:
```json
{
  "total": 1234,
  "success": 1100,
  "failed": 50,
  "denied": 84,
  "lastEntry": "2026-04-13T10:30:00Z"
}
```

---

## Usage Example

```bash
# Create a deny rule (bash disabled)
curl -X POST http://localhost:3000/api/permissions/deny-rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "deny-bash-1",
    "tools": ["bash_exec"],
    "reason": "Disabled"
  }'

# List all deny rules
curl http://localhost:3000/api/permissions/deny-rules

# Get audit stats
curl http://localhost:3000/api/audit/stats

# Get denied actions (security review)
curl http://localhost:3000/api/audit/denied?limit=50
```

---

## Initialization

Rules and hooks are automatically loaded from database on server startup via `initializePersistentState()`:
- All deny rules → loaded into permission pipeline
- All ask rules → loaded into permission pipeline
- All hooks → loaded from swarm_hooks table

This ensures rules persist across server restarts.
