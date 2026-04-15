/**
 * Emotion Triggers — Events that trigger emotional responses
 *
 * Maps user/system events to emotional reactions
 */
import { emotionalStateManager } from './emotions.js';
/**
 * Detect success events (increase confidence/happiness)
 */
export function detectSuccess(context) {
    if (context.wasPraised) {
        return {
            type: 'user_praised_response',
            magnitude: 1.0,
            description: 'User explicitly praised response',
        };
    }
    if (context.wasAccepted) {
        return {
            type: 'user_accepted_response',
            magnitude: 0.8,
            description: 'User accepted response without complaint',
        };
    }
    if (context.cacheHit) {
        return {
            type: 'cache_hit_correct',
            magnitude: 0.5,
            description: 'Cache hit validated',
        };
    }
    return null;
}
/**
 * Detect error events (increase frustration)
 */
export function detectError(context) {
    if ((context.sameErrorCount || 0) >= 3) {
        return {
            type: 'user_same_error_repeat',
            magnitude: context.sameErrorCount || 3,
            description: `User repeated same error ${context.sameErrorCount} times`,
        };
    }
    if (context.errorType === 'llm_error') {
        return {
            type: 'llm_returned_error',
            magnitude: 1.0,
            description: 'LLM returned error',
        };
    }
    if (context.userMessage?.includes('no') || context.userMessage?.includes('wrong')) {
        return {
            type: 'user_rejected_response',
            magnitude: 1.0,
            description: 'User rejected response',
        };
    }
    return null;
}
/**
 * Detect engagement events
 */
export function detectEngagement(context) {
    if (context.followupQuickly) {
        return {
            type: 'user_quick_followup',
            magnitude: 1.0,
            description: 'User asked quick follow-up (engaged)',
        };
    }
    if ((context.messageLength || 0) > 200) {
        return {
            type: 'user_asking_complex',
            magnitude: 1.0,
            description: 'Complex/long question (interesting)',
        };
    }
    if ((context.timeSinceLastMessage || 0) > 600_000) {
        // 10 minutes
        return {
            type: 'user_idle',
            magnitude: 1.0,
            description: 'User idle (boredom)',
        };
    }
    return null;
}
/**
 * Process an event and update emotional state
 */
export function processEmotionEvent(event) {
    emotionalStateManager.recordEvent(event.type, event.magnitude);
}
/**
 * Multi-event processor
 */
export function processEmotionEvents(events) {
    for (const event of events) {
        processEmotionEvent(event);
    }
}
/**
 * Passive emotion decay (call periodically)
 */
export function decayEmotionsPassively() {
    emotionalStateManager.decayEmotions(1); // 1 minute decay
}
