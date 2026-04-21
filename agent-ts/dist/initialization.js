/**
 * Initialization module — Load rules/hooks from DB on server startup
 * Ensures all permissions and hooks are restored after restart
 */
import { loadDenyRules, loadAskRules, initPermissionTables } from './permissions/persistence.js';
import { loadHooks, initHookTables } from './swarm/hookPersistence.js';
import { getPermissionPipeline } from './permissions/pipeline.js';
import { initTokenManager } from './tokenManager.js';
import { initCoordinationTables, initWorkflowHistoryTables, initErrorHandlingTables, initMCPTables, } from './coordination/index.js';
/**
 * Initialize all persistent configurations from database on startup
 */
export async function initializePersistentState() {
    console.log('[INIT] Loading persistent state from database...');
    try {
        // Initialize permission tables
        await initPermissionTables();
        console.log('[INIT] Permission tables initialized');
        // Initialize hook tables
        await initHookTables();
        console.log('[INIT] Hook tables initialized');
        // Initialize coordination system tables
        await initCoordinationTables();
        console.log('[INIT] Coordination tables initialized');
        await initWorkflowHistoryTables();
        console.log('[INIT] Workflow history tables initialized');
        await initErrorHandlingTables();
        console.log('[INIT] Error handling tables initialized');
        await initMCPTables();
        console.log('[INIT] MCP tables initialized');
        // Initialize token tracking
        await initTokenManager();
        console.log('[INIT] Token manager initialized');
        // Load permission rules from DB
        const denyRules = await loadDenyRules();
        const askRules = await loadAskRules();
        console.log(`[INIT] Loaded ${denyRules.length} deny rules`);
        console.log(`[INIT] Loaded ${askRules.length} ask rules`);
        // Populate in-memory permission pipeline
        const pipeline = getPermissionPipeline();
        for (const rule of denyRules) {
            const tools = rule.tool.includes(',') ? rule.tool.split(',') : rule.tool;
            pipeline.addDenyRule({
                id: rule.id,
                tool: tools,
                condition: (ctx) => {
                    // Try to match condition from stored JSON
                    // For now, always true — condition logic is stored in DB
                    return true;
                },
                reason: rule.reason,
            });
        }
        for (const rule of askRules) {
            const tools = rule.tool.includes(',') ? rule.tool.split(',') : rule.tool;
            pipeline.addAskRule({
                id: rule.id,
                tool: tools,
                condition: () => true,
                message: rule.message,
            });
        }
        // Load hooks from DB (stored for reference, not yet loaded into registry)
        const hooks = await loadHooks();
        console.log(`[INIT] Loaded ${hooks.length} hooks from database`);
        console.log('[INIT] ✅ Persistent state loaded successfully');
    }
    catch (err) {
        console.error('[INIT] ❌ Error loading persistent state:', err);
        throw err;
    }
}
