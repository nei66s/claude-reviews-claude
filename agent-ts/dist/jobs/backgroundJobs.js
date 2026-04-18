/**
 * Background Jobs System
 * Handles retry scheduling, workflow cleanup, and error escalation
 */
import { getPendingRetries, resolveError, escalateError, getErrorsEligibleForEscalation } from '../coordination/errorHandler.js';
import { cleanupOldWorkflows } from '../coordination/workflowHistory.js';
import { cleanupOldErrors } from '../coordination/errorHandler.js';
import { sendMessage } from '../coordination/mailbox.js';
const DEFAULT_CONFIG = {
    retryCheckIntervalMs: 30000, // Every 30 seconds
    workflowCleanupIntervalMs: 3600000, // Every hour
    workflowCleanupAgeHours: 168, // 7 days
    errorCleanupIntervalMs: 3600000, // Every hour
    errorCleanupAgeHours: 168, // 7 days
    errorEscalationIntervalMs: 60000, // Every minute
    errorEscalationThresholdRetries: 3, // After 3 retries, escalate
    backfillTitlesIntervalMs: 600000, // Every 10 minutes
};
// Registry of all background jobs
const registeredJobs = [
    {
        name: 'RetriesHandler',
        getIntervalMs: c => c.retryCheckIntervalMs,
        execute: handlePendingRetries
    },
    {
        name: 'WorkflowCleanup',
        getIntervalMs: c => c.workflowCleanupIntervalMs,
        execute: handleWorkflowCleanup
    },
    {
        name: 'ErrorCleanup',
        getIntervalMs: c => c.errorCleanupIntervalMs,
        execute: handleErrorCleanup
    },
    {
        name: 'ErrorEscalation',
        getIntervalMs: c => c.errorEscalationIntervalMs,
        execute: handleErrorEscalation
    },
    {
        name: 'BackfillConversationTitles',
        getIntervalMs: c => c.backfillTitlesIntervalMs,
        execute: async () => {
            // Lazy import so that the job file is only loaded when needed
            const { runBackfillTitlesJob } = await import('./backfillTitlesJob.js');
            await runBackfillTitlesJob();
        }
    }
];
let jobs = [];
let isRunning = false;
/**
 * Start background jobs
 */
export async function startBackgroundJobs(config = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    if (isRunning) {
        console.log('[JOBS] Background jobs already running');
        return;
    }
    isRunning = true;
    console.log('[JOBS] Starting background jobs...');
    for (const jobDef of registeredJobs) {
        const intervalMs = jobDef.getIntervalMs(finalConfig);
        if (intervalMs <= 0) {
            console.log(`[JOBS] Skipping ${jobDef.name} (interval <= 0)`);
            continue;
        }
        const timer = setInterval(async () => {
            try {
                await jobDef.execute(finalConfig);
            }
            catch (error) {
                console.error(`[JOBS] Error in ${jobDef.name}:`, error);
            }
        }, intervalMs);
        jobs.push(timer);
    }
    console.log('[JOBS] ✅ Background jobs started');
}
/**
 * Stop background jobs
 */
export function stopBackgroundJobs() {
    if (!isRunning) {
        console.log('[JOBS] No background jobs running');
        return;
    }
    console.log('[JOBS] Stopping background jobs...');
    for (const job of jobs) {
        clearInterval(job);
    }
    jobs = [];
    isRunning = false;
    console.log('[JOBS] ✅ Background jobs stopped');
}
/**
 * Handle pending retries
 */
async function handlePendingRetries(config) {
    const retries = await getPendingRetries();
    if (retries.length === 0)
        return;
    console.log(`[JOBS] Found ${retries.length} pending retries`);
    for (const error of retries) {
        try {
            // Custom retry handler if provided
            if (config.retryExecutorFn) {
                await config.retryExecutorFn(error.id);
            }
            else {
                // Default: send retry notification to coordinator
                await sendMessage(error.team_id, `retry-executor`, error.worker_agent_id, 'task_notification', `Retrying failed task. Attempt ${error.retry_count + 1}/${error.max_retries}`, {
                    errorId: error.id,
                    retryCount: error.retry_count,
                    originalError: error.error_message,
                });
                console.log(`[JOBS] Sent retry for worker ${error.worker_agent_id} (attempt ${error.retry_count + 1})`);
            }
            // Mark as resolved if max retries reached
            if (error.retry_count >= error.max_retries) {
                await resolveError(error.id);
                console.log(`[JOBS] Max retries reached for error ${error.id}, marking as resolved`);
            }
        }
        catch (error) {
            console.error(`[JOBS] Error handling retry for ${error?.id}:`, error);
        }
    }
}
/**
 * Handle workflow cleanup
 */
async function handleWorkflowCleanup(config) {
    try {
        const deleted = await cleanupOldWorkflows(config.workflowCleanupAgeHours);
        if (deleted > 0) {
            console.log(`[JOBS] Cleaned up ${deleted} old workflows`);
        }
    }
    catch (error) {
        console.error('[JOBS] Error in workflow cleanup:', error);
    }
}
/**
 * Handle error cleanup
 */
async function handleErrorCleanup(config) {
    try {
        const deleted = await cleanupOldErrors(config.errorCleanupAgeHours);
        if (deleted > 0) {
            console.log(`[JOBS] Cleaned up ${deleted} old error records`);
        }
    }
    catch (error) {
        console.error('[JOBS] Error in error cleanup:', error);
    }
}
/**
 * Handle error escalation
 */
async function handleErrorEscalation(config) {
    try {
        const escalationCandidates = await getErrorsEligibleForEscalation(config.errorEscalationThresholdRetries);
        if (escalationCandidates.length === 0)
            return;
        console.log(`[JOBS] Found ${escalationCandidates.length} errors eligible for escalation`);
        for (const error of escalationCandidates) {
            try {
                // Escalate the error (promote severity)
                await escalateError(error.id);
                // Notify coordinator about escalation
                await sendMessage(error.team_id, `escalation-notifier`, `coordinator@main`, 'error_notification', `⚠️ Error escalated: ${error.error_message}`, {
                    errorId: error.id,
                    workerAgentId: error.worker_agent_id,
                    previousSeverity: error.severity,
                    retryCount: error.retry_count,
                    maxRetries: error.max_retries,
                    errorCategory: error.error_category,
                });
                console.log(`[JOBS] Escalated error ${error.id} (severity: ${error.severity}, retries: ${error.retry_count})`);
            }
            catch (err) {
                console.error(`[JOBS] Error escalating ${error.id}:`, err);
            }
        }
    }
    catch (error) {
        console.error('[JOBS] Error in escalation check:', error);
    }
}
/**
 * Check if background jobs are running
 */
export function isBackgroundJobsRunning() {
    return isRunning;
}
/**
 * Get active job count
 */
export function getActiveJobCount() {
    return jobs.length;
}
