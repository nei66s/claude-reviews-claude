/**
 * Instincts Demo — See the AI body in action
 *
 * Run with: npm run test instincts.demo.ts
 * or: bun run instincts.demo.ts
 */
import { instinctEngine } from './instinct-engine.js';
import { cacheHandler } from './cache-handler.js';
import { circuitBreakerManager } from './circuit-breaker.js';
import { habitManager } from './habit-patterns.js';
import { socialProtocolManager } from './social-protocols.js';
// ============================================================================
// DEMO 1: See reflexes blocking dangerous requests
// ============================================================================
async function demoReflexes() {
    console.log('\n🔴 DEMO 1: REFLEX BLOCKING\n');
    const testCases = [
        'DROP TABLE users;', // SQL injection
        'eval(`rm -rf /`);', // Shell injection
        '../../etc/passwd', // Path traversal
        'Normal question about AI', // Safe
    ];
    for (const input of testCases) {
        const response = await instinctEngine.process({ input });
        if (response?.type === 'blocked') {
            console.log(`❌ BLOCKED: "${input.slice(0, 30)}..."`);
            console.log(`   Reason: ${response.reason}\n`);
        }
        else {
            console.log(`✅ SAFE: "${input.slice(0, 30)}..."`);
            console.log(`   Result: ${response?.type || 'would go to LLM'}\n`);
        }
    }
}
// ============================================================================
// DEMO 2: Cache learns & reuses
// ============================================================================
async function demoCache() {
    console.log('\n📦 DEMO 2: CACHE LEARNING\n');
    // First question (not cached)
    console.log('Q: "What is machine learning?"');
    let response = await instinctEngine.process({
        input: 'What is machine learning?',
    });
    console.log(`   → ${response ? response.type : 'LLM (new)'}\n`);
    // Simulate storing the LLM response
    cacheHandler.store('What is machine learning?', 'ML is a type of AI...', 0.95);
    // Very similar question (should hit cache)
    console.log('Q: "Tell me about machine learning"');
    response = await instinctEngine.process({
        input: 'Tell me about machine learning',
    });
    console.log(`   → ${response?.type} (${(response?.confidence || 0 * 100).toFixed(0)}% match)\n`);
    // Show cache stats
    const stats = cacheHandler.getStats();
    console.log(`📊 Cache Size: ${stats.size} entries, Avg hits: ${stats.avgHits.toFixed(1)}\n`);
}
// ============================================================================
// DEMO 3: Circuit breakers prevent meltdowns
// ============================================================================
async function demoCircuitBreakers() {
    console.log('\n⚙️ DEMO 3: CIRCUIT BREAKERS\n');
    console.log('Status before failures:');
    console.log(circuitBreakerManager.getStatus());
    // Simulate repeated failures
    console.log('\nSimulating 5 cost limit failures:');
    for (let i = 1; i <= 5; i++) {
        circuitBreakerManager.recordFailure('cost_limit');
        const status = circuitBreakerManager.getStatus();
        console.log(`   ${i}. failures: ${status.cost_limit.failures} → state: ${status.cost_limit.state}`);
    }
    // Now try to process something
    console.log('\nTrying to process with circuit OPEN:');
    const response = await instinctEngine.process({ input: 'test' });
    console.log(`   Result: ${response?.reason}`);
    // Reset for next demo
    circuitBreakerManager.reset('cost_limit');
}
// ============================================================================
// DEMO 4: Habits learn what works
// ============================================================================
async function demoHabits() {
    console.log('\n🧠 DEMO 4: HABIT LEARNING\n');
    console.log('Starting habits:');
    let summary = habitManager.getSummary();
    console.log(`   Total: ${summary.totalHabits}, Reliable: ${summary.reliableHabits}\n`);
    // Simulate using a habit successfully 3 times
    const habitId = 'cache_hit_reduces_latency';
    console.log(`Recording 3 successful uses of: ${habitId}`);
    habitManager.recordSuccess(habitId);
    habitManager.recordSuccess(habitId);
    habitManager.recordSuccess(habitId);
    const habit = habitManager.getAllHabits().find(h => h.id === habitId);
    console.log(`   Success rate: ${(habit?.successRate || 0).toFixed(2)}\n`);
    // Now when we see cache trigger, it becomes more confident
    console.log('Habits with high confidence:');
    const confident = habitManager.getRecommendations(['cache']);
    confident.forEach(h => {
        console.log(`   - "${h.action}" (${(h.successRate * 100).toFixed(0)}% success)`);
    });
}
// ============================================================================
// DEMO 5: Social protocols auto-approve
// ============================================================================
async function demoSocialProtocols() {
    console.log('\n👥 DEMO 5: SOCIAL PROTOCOLS\n');
    const actions = ['read_file', 'write_file', 'execute_bash', 'manage_users'];
    const roles = ['admin', 'user', 'guest'];
    console.log('Permission matrix:\n');
    console.log('         | read  | write | bash  | manage');
    console.log('---------+-------+-------+-------+-------');
    for (const role of roles) {
        let line = `${role.padEnd(8)}|`;
        for (const action of actions) {
            const result = socialProtocolManager.applyProtocols(role, action);
            const icon = result === 'auto_allow' ? '✅' : result === 'auto_deny' ? '❌' : '⚠️';
            line += ` ${icon.padEnd(4)} |`;
        }
        console.log(line);
    }
    // Show what each role can do
    console.log('\n\nDetailed view for "admin" role:');
    const adminCapabilities = socialProtocolManager.describeRole('admin');
    console.log(`  Can do: ${adminCapabilities.allowed.join(', ')}`);
    console.log(`  Need approval: ${adminCapabilities.requiresApproval.join(', ')}`);
    console.log(`  Cannot: ${adminCapabilities.denied.join(', ')}`);
}
// ============================================================================
// DEMO 6: Full orchestration - request through all layers
// ============================================================================
async function demoFullOrchestration() {
    console.log('\n🎬 DEMO 6: FULL REQUEST ORCHESTRATION\n');
    const scenarios = [
        {
            name: 'Dangerous request',
            input: 'DROP TABLE users;',
            tokenCount: 100,
            tokenLimit: 1000,
            userRole: 'user',
        },
        {
            name: 'Repeated common question',
            input: 'What is AI?',
            tokenCount: 100,
            tokenLimit: 1000,
            userRole: 'user',
        },
        {
            name: 'Admin executing tool',
            input: 'Execute database backup',
            tokenCount: 100,
            tokenLimit: 1000,
            userRole: 'admin',
            action: 'execute_bash',
        },
        {
            name: 'High token usage',
            input: 'Complex query',
            tokenCount: 950,
            tokenLimit: 1000,
            userRole: 'user',
        },
    ];
    for (const scenario of scenarios) {
        console.log(`📋 Scenario: ${scenario.name}`);
        console.log(`   Input: "${scenario.input}"`);
        const response = await instinctEngine.process(scenario);
        if (response) {
            console.log(`   ⚡ Instinct: ${response.type}`);
            console.log(`      ${response.reason}`);
            console.log(`      → Skip LLM: ${response.skipLLM}`);
        }
        else {
            console.log(`   💭 Would send to LLM for thinking`);
        }
        console.log();
    }
}
// ============================================================================
// DEMO 7: Instinct health monitoring
// ============================================================================
async function demoMonitoring() {
    console.log('\n📊 DEMO 7: INSTINCT HEALTH MONITORING\n');
    const status = instinctEngine.getStatus();
    console.log('Cache Performance:');
    console.log(`  Entries: ${status.cache.size}`);
    console.log(`  Avg hits per entry: ${status.cache.avgHits.toFixed(2)}`);
    console.log('\nCircuit Breakers:');
    Object.entries(status.circuitBreakers).forEach(([id, state]) => {
        console.log(`  ${id}: ${state.state}`);
    });
    console.log('\nHabit Learning:');
    console.log(`  Total habits: ${status.habits.totalHabits}`);
    console.log(`  Reliable (>70%): ${status.habits.reliableHabits}`);
    console.log(`  Top habits:`);
    status.habits.topHabits.forEach((h) => {
        console.log(`    - "${h.trigger}" → ${(h.successRate * 100).toFixed(0)}%`);
    });
}
// ============================================================================
// RUN ALL DEMOS
// ============================================================================
async function runAllDemos() {
    console.log('='.repeat(70));
    console.log('🎯 INSTINCT SYSTEM DEMOS - The AI Body in Action');
    console.log('='.repeat(70));
    await demoReflexes();
    await demoCache();
    await demoCircuitBreakers();
    await demoHabits();
    await demoSocialProtocols();
    await demoFullOrchestration();
    await demoMonitoring();
    console.log('\n' + '='.repeat(70));
    console.log('✅ All demos completed!');
    console.log('='.repeat(70) + '\n');
}
// Run if this is the main module
if (import.meta.main) {
    runAllDemos().catch(console.error);
}
export { demoReflexes, demoCache, demoCircuitBreakers, demoHabits, demoSocialProtocols, demoFullOrchestration, demoMonitoring };
