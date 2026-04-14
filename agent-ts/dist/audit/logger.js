/**
 * Audit Logger — Records sensitive operations for compliance/debugging.
 */
// In-memory storage; could be persisted to DB
const auditLog = [];
let nextId = 1;
export class AuditLogger {
    /**
     * Log an audit entry
     */
    static log(entry) {
        const full = {
            id: `audit_${nextId++}`,
            timestamp: new Date().toISOString(),
            ...entry,
        };
        auditLog.push(full);
        // Keep only last 10000 entries (prevent unbounded growth)
        if (auditLog.length > 10000) {
            auditLog.splice(0, auditLog.length - 10000);
        }
        return full;
    }
    /**
     * Log tool execution
     */
    static logToolExecution(tool, input, result, userId, chatId) {
        return this.log({
            action: 'tool_execute',
            tool,
            input,
            result: typeof result === 'string' ? result : result?.ok ? 'ok' : 'error',
            userId,
            chatId,
        });
    }
    /**
     * Log permission denial
     */
    static logPermissionDenied(tool, reason, userId, chatId) {
        return this.log({
            action: 'permission_denied',
            tool,
            error: reason,
            userId,
            chatId,
        });
    }
    /**
     * Log permission approval
     */
    static logPermissionApproved(tool, ruleId, userId, chatId) {
        return this.log({
            action: 'permission_approved',
            tool,
            metadata: { ruleId },
            userId,
            chatId,
        });
    }
    /**
     * Get recent audit entries
     */
    static getRecent(limit = 100, filter) {
        let results = auditLog.slice(-limit);
        if (filter) {
            results = results.filter(entry => {
                if (filter.userId && entry.userId !== filter.userId)
                    return false;
                if (filter.chatId && entry.chatId !== filter.chatId)
                    return false;
                if (filter.action && entry.action !== filter.action)
                    return false;
                return true;
            });
        }
        return results.reverse(); // newest first
    }
    /**
     * Get stats (for monitoring)
     */
    static getStats() {
        const byAction = {};
        auditLog.forEach(entry => {
            byAction[entry.action] = (byAction[entry.action] || 0) + 1;
        });
        return { total: auditLog.length, byAction };
    }
    /**
     * Clear all entries (testing only)
     */
    static clear() {
        auditLog.length = 0;
        nextId = 1;
    }
}
// Also export raw log for direct access
export { auditLog };
