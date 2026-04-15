/**
 * Circuit Breaker — Protective reflexes when limits are hit
 * Prevents meltdowns, cascading failures, and runaway costs
 */
const DEFAULT_POLICY = {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeout: 60_000, // 1 minute
};
export class CircuitBreakerManager {
    breakers = new Map();
    policies = new Map();
    constructor() {
        // Initialize default circuit breakers
        this.registerBreaker('token_limit', DEFAULT_POLICY);
        this.registerBreaker('cost_limit', DEFAULT_POLICY);
        this.registerBreaker('rate_limit', DEFAULT_POLICY);
        this.registerBreaker('lru_cache_overload', {
            ...DEFAULT_POLICY,
            failureThreshold: 3,
        });
    }
    /**
     * Register a circuit breaker with policy
     */
    registerBreaker(id, policy = {}) {
        const finalPolicy = { ...DEFAULT_POLICY, ...policy };
        this.policies.set(id, finalPolicy);
        this.breakers.set(id, {
            id,
            state: 'closed',
            failureCount: 0,
            successCount: 0,
            resetTimeout: finalPolicy.resetTimeout,
        });
    }
    /**
     * Check if a circuit is open (should reject)
     */
    isOpen(id) {
        const breaker = this.breakers.get(id);
        if (!breaker)
            return false;
        if (breaker.state === 'open') {
            // Check if we should try half-open recovery
            const now = Date.now();
            const timeSinceFailure = breaker.lastFailure
                ? now - breaker.lastFailure.getTime()
                : breaker.resetTimeout;
            if (timeSinceFailure > breaker.resetTimeout) {
                breaker.state = 'half-open';
                breaker.failureCount = 0;
                breaker.successCount = 0;
                return false; // Allow one request through
            }
            return true; // Still open
        }
        return false;
    }
    /**
     * Record a failure (increments failure counter)
     */
    recordFailure(id) {
        const breaker = this.breakers.get(id);
        if (!breaker)
            return;
        breaker.failureCount++;
        breaker.lastFailure = new Date();
        const policy = this.policies.get(id) || DEFAULT_POLICY;
        if (breaker.failureCount >= policy.failureThreshold) {
            breaker.state = 'open';
            console.warn(`⚠️ Circuit breaker OPEN: ${id} (failures: ${breaker.failureCount})`);
        }
    }
    /**
     * Record a success (increments success counter, may reset)
     */
    recordSuccess(id) {
        const breaker = this.breakers.get(id);
        if (!breaker)
            return;
        breaker.successCount++;
        const policy = this.policies.get(id) || DEFAULT_POLICY;
        if (breaker.state === 'half-open' && breaker.successCount >= policy.successThreshold) {
            breaker.state = 'closed';
            breaker.failureCount = 0;
            console.log(`✅ Circuit breaker CLOSED: ${id}`);
        }
    }
    /**
     * Manually reset a breaker
     */
    reset(id) {
        const breaker = this.breakers.get(id);
        if (breaker) {
            breaker.state = 'closed';
            breaker.failureCount = 0;
            breaker.successCount = 0;
            console.log(`🔄 Circuit breaker reset: ${id}`);
        }
    }
    /**
     * Get status of all breakers
     */
    getStatus() {
        const status = {};
        for (const [id, breaker] of this.breakers.entries()) {
            status[id] = {
                state: breaker.state,
                failures: breaker.failureCount,
                successes: breaker.successCount,
            };
        }
        return status;
    }
}
export const circuitBreakerManager = new CircuitBreakerManager();
