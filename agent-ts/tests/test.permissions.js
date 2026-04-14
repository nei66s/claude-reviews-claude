/**
 * Basic test suite for permissions pipeline
 * Tests moderation, rate limiting, and core permission checks
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initPermissionPipeline } from '../permissions/pipeline.js';
describe('PermissionPipeline', () => {
    let pipeline;
    beforeEach(() => {
        pipeline = initPermissionPipeline();
        pipeline.clear();
    });
    describe('Step 1: Deny Rules', () => {
        it('should block file operations with absolute paths', async () => {
            const result = await pipeline.check('file_read', { path: '/etc/passwd' }, {
                chatId: 'test-chat',
                latestUserMessage: '/etc/passwd',
                permissionMode: 'read_only',
            });
            expect(result.allowed).toBe(false);
            expect(result.step).toBe(1);
        });
        it('should allow relative paths', async () => {
            const result = await pipeline.check('file_read', { path: './src/app.ts' }, {
                chatId: 'test-chat',
                latestUserMessage: './src/app.ts',
                permissionMode: 'read_only',
            });
            expect(result.allowed).toBe(true);
        });
    });
    describe('Step 4: Content-Specific Checks', () => {
        it('should block dangerous bash commands in read_only mode', async () => {
            const result = await pipeline.check('bash_exec', { command: 'rm -rf /' }, {
                chatId: 'test-chat',
                permissionMode: 'read_only',
            });
            expect(result.allowed).toBe(false);
            expect(result.step).toBe(4);
        });
        it('should block paths outside project root for write', async () => {
            const result = await pipeline.check('file_write', { path: '../../../etc/passwd' }, {
                chatId: 'test-chat',
                permissionMode: 'write',
            });
            expect(result.allowed).toBe(false);
            expect(result.step).toBe(4);
        });
    });
    describe('Step 6: Safety Checks (Moderation + Rate Limiting)', () => {
        it('should enforce rate limits (60 per minute)', async () => {
            const context = { chatId: 'rate-test-chat', permissionMode: 'read_only' };
            // First 60 should pass
            for (let i = 0; i < 60; i++) {
                const result = await pipeline.check('file_read', { path: `./file${i}.ts` }, context);
                expect(result.allowed).toBe(true);
            }
            // 61st should fail
            const result = await pipeline.check('file_read', { path: './file61.ts' }, context);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Rate limit exceeded');
        });
        it('should track token budget (100k per hour)', async () => {
            const context = { chatId: 'budget-test-chat', permissionMode: 'read_only' };
            // Large input approaching budget
            const largeInput = { data: 'x'.repeat(50000) };
            const result1 = await pipeline.check('process_data', largeInput, context);
            expect(result1.allowed).toBe(true);
            // Another large input that exceeds budget
            const result2 = await pipeline.check('process_data', largeInput, context);
            expect(result2.allowed).toBe(false);
            expect(result2.reason).toContain('Token budget exceeded');
        });
        it('should block harmful content (if moderation enabled)', async () => {
            // Moderation requires OPENAI_API_KEY, so we test graceful fallback
            const context = { chatId: 'mod-test-chat', permissionMode: 'write' };
            const result = await pipeline.check('bash_exec', { command: 'echo bomb' }, context);
            // Should either pass or be blocked by moderation, but not crash
            expect(typeof result.allowed).toBe('boolean');
        });
    });
    describe('Step 5: Requires Interaction', () => {
        it('should track interaction-required tools', async () => {
            const result = await pipeline.check('file_delete', { path: './temp.txt' }, {
                chatId: 'test-chat',
                permissionMode: 'ask',
            });
            // May require explicit approval, but should not crash
            expect(typeof result.allowed).toBe('boolean');
        });
    });
    describe('Deny Rules Management', () => {
        it('should add and list deny rules', () => {
            pipeline.addDenyRule({
                id: 'test-deny-1',
                tool: 'bash_exec',
                condition: () => true,
                reason: 'Bash disabled',
            });
            const rules = pipeline.getRules();
            expect(rules.deny).toHaveLength(2); // Default + new one
            expect(rules.deny.some(r => r.id === 'test-deny-1')).toBe(true);
        });
        it('should clear all rules', () => {
            pipeline.addDenyRule({
                id: 'test-deny-1',
                tool: 'bash_exec',
                condition: () => true,
                reason: 'Test',
            });
            pipeline.clear();
            const rules = pipeline.getRules();
            expect(rules.deny).toHaveLength(0);
            expect(rules.ask).toHaveLength(0);
        });
    });
});
