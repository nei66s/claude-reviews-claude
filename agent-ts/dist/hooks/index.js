/**
 * Hook Registry & Dispatcher
 * Manages hook registration, storage, and execution.
 */
class HookRegistry {
    hooks = new Map();
    nextId = 1;
    /**
     * Register a hook handler for an event.
     */
    register(event, handler, priority = 50) {
        const id = `hook_${this.nextId++}`;
        const hook = {
            id,
            event,
            handler,
            priority,
            disabled: false,
        };
        this.hooks.set(id, hook);
        return id;
    }
    /**
     * Unregister a hook by ID.
     */
    unregister(id) {
        return this.hooks.delete(id);
    }
    /**
     * Disable a hook temporarily.
     */
    disable(id) {
        const hook = this.hooks.get(id);
        if (!hook)
            return false;
        hook.disabled = true;
        return true;
    }
    /**
     * Re-enable a disabled hook.
     */
    enable(id) {
        const hook = this.hooks.get(id);
        if (!hook)
            return false;
        hook.disabled = false;
        return true;
    }
    /**
     * Get hooks of a specific event, sorted by priority.
     */
    getHooks(event) {
        return Array.from(this.hooks.values())
            .filter(h => h.event === event && !h.disabled)
            .sort((a, b) => (b.priority || 50) - (a.priority || 50));
    }
    /**
     * List all hooks, optionally filtered.
     */
    list(filter) {
        return Array.from(this.hooks.values()).filter(h => {
            if (filter?.event && h.event !== filter.event)
                return false;
            if (filter?.disabled !== undefined && h.disabled !== filter.disabled)
                return false;
            return true;
        });
    }
    /**
     * Dispatch an event to all registered hooks.
     */
    async dispatch(payload) {
        const hooks = this.getHooks(payload.type);
        for (const hook of hooks) {
            try {
                await Promise.resolve(hook.handler(payload));
            }
            catch (error) {
                console.error(`Hook ${hook.id} failed for ${payload.type}:`, error);
            }
        }
    }
    /**
     * Clear all hooks (for testing).
     */
    clear() {
        this.hooks.clear();
        this.nextId = 1;
    }
}
// Global singleton instance
let globalRegistry = null;
export function initHooks() {
    if (!globalRegistry) {
        globalRegistry = new HookRegistry();
    }
    return globalRegistry;
}
export function getHookRegistry() {
    if (!globalRegistry) {
        throw new Error('Hook registry not initialized. Call initHooks() first.');
    }
    return globalRegistry;
}
export { HookRegistry };
