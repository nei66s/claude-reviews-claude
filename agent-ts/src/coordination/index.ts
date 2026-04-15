/**
 * Coordination System - Index
 * Multi-agent team coordination with mailbox communication
 */

export {
  initCoordinationTables,
  createTeam,
  registerAgent,
  sendMessage,
  getInbox,
  markAsRead,
  markManyAsRead,
  updateAgentStatus,
  getTeamAgents,
  getTeam,
  getTeamsByLeader,
  getAllTeams,
  deleteTeam,
  getMessageHistory,
  type MessageType,
  type CoordinationMessage,
  type CoordinationTeam,
  type CoordinationAgent,
} from './mailbox.js'

export {
  initCoordinationAgentProfileTables,
  upsertAgentProfile,
  getAgentProfile,
  listAgentProfiles,
  type PersistedAgentProfile,
} from './agentProfiles.js'

export {
  spawnWorker,
  spawnWorkers,
  createCoordinationTeam,
  waitForWorkerCompletion,
  sendWorkerMessage,
  getTeamWorkers,
  type WorkerSpec,
  type SpawnedWorker,
} from './spawner.js'

export {
  initWorkflowHistoryTables,
  startCoordinationWorkflow,
  addWorkflowSteps,
  assignStepToWorker,
  completeWorkflowStep,
  failWorkflowStep,
  getWorkflowHistory,
  getWorkflowSteps,
  getTeamWorkflowHistory,
  getWorkflowStats,
  cleanupOldWorkflows,
  type CoordinationWorkflowStatus,
  type CoordinationWorkflowHistory,
  type WorkflowStepExecution,
} from './workflowHistory.js'

export {
  initErrorHandlingTables,
  logWorkerError,
  scheduleRetry,
  calculateBackoffDelay,
  calculateLinearBackoff,
  getPendingRetries,
  shouldRetry,
  resolveError,
  getTeamErrorStats,
  getError,
  getRecentErrors,
  getErrorsEligibleForEscalation,
  escalateError,
  cleanupOldErrors,
  type ErrorSeverity,
  type ErrorCategory,
  type RetryStrategy,
  type WorkerError,
} from './errorHandler.js'

export {
  initMCPTables,
  registerMCPTool,
  grantToolAccess,
  canAccessTool,
  logMCPToolCall,
  getAvailableTools,
  getMCPTool,
  listMCPTools,
  disableMCPTool,
  getMCPToolStats,
  getRecentToolCalls,
  cleanupOldToolCalls,
  type MCPToolType,
  type MCPAuthType,
  type MCPTool,
  type MCPToolAccess,
} from './mcp.js'
