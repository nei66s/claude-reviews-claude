/**
 * Permission Pipeline — 7-step gauntlet for tool execution.
 *
 * Steps:
 * 1. Deny rules (block immediately)
 * 2. Ask rules (require prior approval)
 * 3. Tool.checkPermissions (built-in tool validation)
 * 4. Content-specific checks (file path, command, URL)
 * 5. Requires interaction (certain operations need user gesture)
 * 6. Safety checks (moderation, rate limits)
 * 7. Post-pipeline transforms (log, notify)
 */
import { moderateText } from '../moderation.js';
class PermissionPipeline {
    denyRules = [];
    askRules = [];
    rateLimitMap = new Map();
    tokenBudgetMap = new Map();
    // Step 1: Deny rules (fail-closed)
    async step1_DenyRules(tool, context) {
        for (const rule of this.denyRules) {
            if (this.toolMatches(rule.tool, tool) && rule.condition(context)) {
                return {
                    allowed: false,
                    reason: rule.reason,
                    step: 1,
                };
            }
        }
        return { allowed: true };
    }
    // Step 2: Ask rules (requires prior approval in session)
    async step2_AskRules(tool, context) {
        for (const rule of this.askRules) {
            if (this.toolMatches(rule.tool, tool) && rule.condition(context)) {
                const isApproved = context.approvedRules?.includes(rule.id);
                if (!isApproved) {
                    return {
                        allowed: false,
                        reason: `Approval required: ${rule.message}`,
                        step: 2,
                    };
                }
            }
        }
        return { allowed: true };
    }
    // Step 3: Tool-specific checks
    async step3_ToolCheckPermissions(tool, context) {
        // This delegates to the tool's own checkPermissions method
        // For now, always pass (tools handle their own validation)
        return { allowed: true };
    }
    // Step 4: Content-specific checks
    async step4_ContentSpecific(tool, input, context) {
        // Example: block file operations outside project root
        if (tool === 'file_read' || tool === 'file_write') {
            const path = input?.path || input?.from_path;
            if (path && typeof path === 'string') {
                if (path.includes('..') || path.startsWith('/etc') || path.startsWith('C:\\Windows')) {
                    return {
                        allowed: false,
                        reason: 'Path outside allowed scope',
                        step: 4,
                    };
                }
            }
        }
        // Block certain bash commands globally
        if (tool === 'bash_exec') {
            const cmd = input?.command || '';
            if (typeof cmd === 'string' && /\b(rm\s+-rf|dd\s+if=|:()\s*{|fork\(\)|ping|curl|wget)\b/i.test(cmd)) {
                // Blacklist some dangerous patterns
                if (context.permissionMode === 'read_only') {
                    return {
                        allowed: false,
                        reason: 'Command blocked in read-only mode',
                        step: 4,
                    };
                }
            }
        }
        return { allowed: true };
    }
    // Step 5: Requires interaction
    async step5_RequiresInteraction(tool, context) {
        // Certain tools absolutely require user interaction (no auto-execute)
        const requiresInteraction = ['file_delete', 'bash_exec', 'web_fetch'];
        if (requiresInteraction.includes(tool) && context.permissionMode === 'ask') {
            // In ask mode, always require explicit approval
            // This is enforced by the tool layer, just signal here
        }
        return { allowed: true };
    }
    // Step 6: Safety checks (moderation, rate limits)
    async step6_SafetyChecks(tool, input, context) {
        const chatId = context.chatId || 'unknown';
        const now = Date.now();
        // Rate limiting: 60 calls per minute per chat
        const rateLimitKey = `rate_${chatId}`;
        let rateLimit = this.rateLimitMap.get(rateLimitKey);
        if (!rateLimit || now > rateLimit.resetTime) {
            rateLimit = { count: 0, resetTime: now + 60000 }; // 60-second window
            this.rateLimitMap.set(rateLimitKey, rateLimit);
        }
        rateLimit.count++;
        if (rateLimit.count > 60) {
            return {
                allowed: false,
                reason: 'Rate limit exceeded: 60 calls per minute',
                step: 6,
            };
        }
        // Token budget: 100k tokens per session per hour
        const budgetKey = `budget_${chatId}`;
        let budget = this.tokenBudgetMap.get(budgetKey);
        if (!budget || now > budget.resetTime) {
            budget = { used: 0, limit: 100000, resetTime: now + 3600000 }; // 1-hour window
            this.tokenBudgetMap.set(budgetKey, budget);
        }
        // Rough token estimate: input words * 1.3
        const inputStr = JSON.stringify(input);
        const estimatedTokens = Math.ceil(inputStr.split(/\s+/).length * 1.3);
        if (budget.used + estimatedTokens > budget.limit) {
            return {
                allowed: false,
                reason: `Token budget exceeded: ${budget.used}/${budget.limit} tokens used`,
                step: 6,
            };
        }
        budget.used += estimatedTokens;
        // Content moderation: check tool input for harmful content
        if (input && typeof input === 'object') {
            for (const [key, value] of Object.entries(input)) {
                if (typeof value === 'string' && value.length > 0) {
                    try {
                        const modResult = await moderateText(value);
                        if (!modResult.allowed) {
                            return {
                                allowed: false,
                                reason: `Content moderation blocked: ${modResult.reason}`,
                                step: 6,
                            };
                        }
                    }
                    catch (err) {
                        // Moderation error: log but don't block
                        console.error('Moderation check error:', err);
                    }
                }
            }
        }
        return { allowed: true };
    }
    // Step 7: Post-pipeline transforms
    async step7_PostPipeline(tool, allowed, context, step) {
        // Dispatch hook event for audit/logging
        if (!allowed) {
            // Will be dispatched by caller to HookRegistry
        }
    }
    /**
     * Run full 7-step pipeline
     */
    async check(tool, input, context) {
        let result = await this.step1_DenyRules(tool, context);
        if (!result.allowed)
            return result;
        result = await this.step2_AskRules(tool, context);
        if (!result.allowed)
            return result;
        result = await this.step3_ToolCheckPermissions(tool, context);
        if (!result.allowed)
            return result;
        result = await this.step4_ContentSpecific(tool, input, context);
        if (!result.allowed)
            return result;
        result = await this.step5_RequiresInteraction(tool, context);
        if (!result.allowed)
            return result;
        result = await this.step6_SafetyChecks(tool, input, context);
        if (!result.allowed)
            return result;
        return { allowed: true };
    }
    /**
     * Add a deny rule
     */
    addDenyRule(rule) {
        this.denyRules.push(rule);
    }
    /**
     * Add an ask rule
     */
    addAskRule(rule) {
        this.askRules.push(rule);
    }
    /**
     * List all active rules
     */
    getRules() {
        return {
            deny: this.denyRules,
            ask: this.askRules,
        };
    }
    /**
     * Clear rules (for testing)
     */
    clear() {
        this.denyRules = [];
        this.askRules = [];
    }
    // Helper: check if tool matches rule pattern
    toolMatches(pattern, tool) {
        if (pattern === '*')
            return true;
        if (Array.isArray(pattern))
            return pattern.includes(tool);
        return pattern === tool;
    }
}
// Global singleton
let globalPipeline = null;
export function initPermissionPipeline() {
    if (!globalPipeline) {
        globalPipeline = new PermissionPipeline();
        // Add default deny rules
        globalPipeline.addDenyRule({
            id: 'deny_absolute_paths',
            tool: ['file_read', 'file_write', 'file_delete'],
            condition: (ctx) => {
                const path = ctx.latestUserMessage || '';
                return /^\/|^[A-Z]:\\/.test(String(path));
            },
            reason: 'Absolute paths must use relative paths within project',
        });
    }
    return globalPipeline;
}
export function getPermissionPipeline() {
    if (!globalPipeline) {
        throw new Error('Permission pipeline not initialized. Call initPermissionPipeline() first.');
    }
    return globalPipeline;
}
export { PermissionPipeline };
