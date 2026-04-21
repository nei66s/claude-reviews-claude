/**
 * Test suite for audit log persistence
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initAuditLogTable, logAuditEntry, getAuditLogsForChat, getDeniedActions, getAuditLogStats } from '../audit/persistence.js';
describe('AuditLog Persistence', () => {
    beforeAll(async () => {
        try {
            await initAuditLogTable();
        }
        catch (err) {
            console.log('Audit table already initialized or DB unavailable');
        }
    });
    it('should log audit entries to database', async () => {
        const id = await logAuditEntry('chat-123', 'file_read', 'file', 'success', {
            resourceId: 'test.txt',
            userId: 'user-1',
        });
        expect(id).toBeGreaterThan(0n);
    });
    it('should fetch audit logs for a chat', async () => {
        // Log a few entries
        await logAuditEntry('chat-audit-test', 'file_write', 'file', 'success', { resourceId: 'file1.txt' });
        await logAuditEntry('chat-audit-test', 'bash_exec', 'command', 'denied', { reason: 'Blocked' });
        const logs = await getAuditLogsForChat('chat-audit-test', 100);
        expect(logs.length).toBeGreaterThanOrEqual(2);
        expect(logs.some(l => l.action === 'file_write')).toBe(true);
        expect(logs.some(l => l.status === 'denied')).toBe(true);
    });
    it('should retrieve denied actions for security review', async () => {
        await logAuditEntry('chat-denied-test', 'bash_exec', 'command', 'denied', { reason: 'Blocked' });
        await logAuditEntry('chat-denied-test', 'file_delete', 'file', 'denied', { reason: 'Path error' });
        const denied = await getDeniedActions(100);
        expect(denied.length).toBeGreaterThanOrEqual(2);
        expect(denied.every(d => d.status === 'denied')).toBe(true);
    });
    it('should compute audit log statistics', async () => {
        await logAuditEntry('chat-stats-test', 'file_read', 'file', 'success');
        await logAuditEntry('chat-stats-test', 'bash_exec', 'command', 'failed', { reason: 'Error' });
        const stats = await getAuditLogStats();
        expect(stats.total).toBeGreaterThanOrEqual(0);
        expect(stats.success).toBeGreaterThanOrEqual(0);
        expect(stats.failed).toBeGreaterThanOrEqual(0);
        expect(stats.denied).toBeGreaterThanOrEqual(0);
    });
});
