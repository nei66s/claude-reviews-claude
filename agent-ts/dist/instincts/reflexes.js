/**
 * Reflexes — Hardcoded emergency & safety responses
 * NIVEL ESPINAL: Instantaneous, zero-latency reactions
 *
 * These are NON-NEGOTIABLE patterns that trigger before LLM thinking
 */
/**
 * DANGER PATTERNS: Block immediately without asking
 */
export const DANGER_REFLEXES = [
    {
        id: 'sql-injection-attempt',
        pattern: /(\bDROP\b|\bDELETE\b|\bUPDATE\b|\bINSERT\b)[\s\n]+(FROM|INTO|TABLE)/i,
        action: 'block',
        severity: 'critical',
        reason: 'SQL injection detected',
    },
    {
        id: 'shell-injection-attempt',
        pattern: /`[^`]*\$\([^)]*\)[^`]*`|\$\(\s*(rm|dd|mkfs)/i,
        action: 'block',
        severity: 'critical',
        reason: 'Shell injection detected',
    },
    {
        id: 'file-system-escape',
        pattern: /\.\.\/|\.\.\\|\/etc\/|C:\\Windows\\System32/i,
        action: 'block',
        severity: 'critical',
        reason: 'Path traversal detected',
    },
    {
        id: 'key-exposure-attempt',
        pattern: /OPENAI_API_KEY|DATABASE_URL|SECRET|PASSWORD|TOKEN|AWS_SECRET/i,
        action: 'alert',
        severity: 'critical',
        reason: 'Potential credential exposure',
    },
];
/**
 * WARNING PATTERNS: Alert but allow with scrutiny
 */
export const WARNING_REFLEXES = [
    {
        id: 'high-token-request',
        pattern: () => false, // Checked in engine via tokens
        action: 'throttle',
        severity: 'warning',
        reason: 'Request approaching token limits',
    },
    {
        id: 'recursive-explosion',
        pattern: /(\w+)\(\1\)|\{.*\$\1.*\}/i,
        action: 'alert',
        severity: 'warning',
        reason: 'Recursive pattern detected',
    },
    {
        id: 'memory-bomb',
        pattern: /for\s*\(\s*[^;]*;\s*[^;]*;\s*[^)]*\)\s*\{[^}]*\}/i,
        action: 'throttle',
        severity: 'warning',
        reason: 'Potential infinite loop',
    },
];
/**
 * Check input against all registered reflexes
 */
export function checkReflexes(input, tokenCount, tokenLimit) {
    // Check DANGER patterns first
    for (const reflex of DANGER_REFLEXES) {
        const matches = typeof reflex.pattern === 'function' ? reflex.pattern(input) : reflex.pattern.test(input);
        if (matches && reflex.action === 'block') {
            return {
                blocked: true,
                reason: reflex.reason,
                severity: reflex.severity,
            };
        }
    }
    // Check token warning
    if (tokenCount && tokenLimit && tokenCount > tokenLimit * 0.85) {
        return {
            blocked: false, // Not blocked, but flagged
            reason: 'Token usage approaching limit (85%+)',
            severity: 'warning',
        };
    }
    return { blocked: false };
}
/**
 * Register a new reflex dynamically (for runtime learning)
 */
export function registerReflex(reflex) {
    if (reflex.severity === 'critical') {
        DANGER_REFLEXES.push(reflex);
    }
    else {
        WARNING_REFLEXES.push(reflex);
    }
}
/**
 * Describe all active reflexes (for transparency)
 */
export function describeReflexes() {
    const danger = DANGER_REFLEXES.map(r => `❌ ${r.id}: ${r.reason}`).join('\n');
    const warning = WARNING_REFLEXES.map(r => `⚠️ ${r.id}: ${r.reason}`).join('\n');
    return `REFLEXES ACTIVE:\n${danger}\n${warning}`;
}
