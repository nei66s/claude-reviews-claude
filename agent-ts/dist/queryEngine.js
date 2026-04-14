/**
 * Query Engine — Optimizes context assembly and compression
 *
 * Responsibilities:
 * - Assemble conversation context efficiently
 * - Compress old messages with intelligent summarization
 * - Cache file contents (LRU)
 * - Create compact context for token budgets
 */
import { query } from './db.js';
import { estimateTokens } from './tokenManager.js';
const MAX_CONTEXT_TOKENS = 100_000; // Safety limit for full context
const COMPRESS_THRESHOLD_MESSAGES = 20; // After N messages, consider compacting
const COMPRESSION_RATIO = 0.3; // Try to keep only 30% of original content
/**
 * Simple LRU cache for file contents
 */
class FileContentCache {
    cache = new Map();
    maxSize = 50;
    ttl = 5 * 60 * 1000; // 5 minutes
    get(path) {
        const entry = this.cache.get(path);
        if (!entry)
            return null;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(path);
            return null;
        }
        return entry.content;
    }
    set(path, content) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        this.cache.set(path, { content, timestamp: Date.now() });
    }
    clear() {
        this.cache.clear();
    }
    cacheSize() {
        return this.cache.size;
    }
}
export const fileCache = new FileContentCache();
/**
 * Create a summary of messages (mock implementation - in production, use Claude API)
 */
function summarizeMessages(messages) {
    if (messages.length === 0)
        return '';
    const actions = messages.filter((m) => m.trace && m.trace.length > 0);
    const userQuestions = messages.filter((m) => m.role === 'user');
    let summary = `[Previous conversation context]\n`;
    if (userQuestions.length > 0) {
        const topics = userQuestions
            .slice(-3)
            .map((m) => m.content.substring(0, 100))
            .filter((t) => t.length > 0);
        if (topics.length > 0) {
            summary += `Topics discussed: ${topics.join('; ')}\n`;
        }
    }
    if (actions.length > 0) {
        const actionList = actions
            .slice(-3)
            .map((m) => {
            const toolNames = m.trace
                ?.filter((t) => t.type === 'tool_call')
                .map((t) => t.name)
                .filter((n, i, arr) => arr.indexOf(n) === i);
            return toolNames?.join(', ');
        })
            .filter(Boolean);
        if (actionList.length > 0) {
            summary += `Recent actions: ${actionList.join('; ')}\n`;
        }
    }
    return summary.trim();
}
/**
 * Compress old messages into a summary
 */
export function compressMessages(messages) {
    if (messages.length < COMPRESS_THRESHOLD_MESSAGES) {
        return null;
    }
    const originalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const summaryText = summarizeMessages(messages.slice(0, -5)); // Keep last 5 messages
    const summaryTokens = estimateTokens(summaryText);
    if (originalTokens <= summaryTokens) {
        return null; // Compression didn't help
    }
    return {
        originalMessages: messages.slice(0, -5),
        compressedMessage: {
            role: 'agent',
            content: summaryText,
            trace: [],
            attachments: [],
        },
        tokensReduced: originalTokens - summaryTokens,
    };
}
/**
 * Assemble context with smart compression
 */
export async function assembleContext(messages, systemPrompt, maxTokens = MAX_CONTEXT_TOKENS) {
    let workingMessages = [...messages];
    let hadCompression = false;
    const originalCount = workingMessages.length;
    // Try compression if we have many messages
    if (workingMessages.length >= COMPRESS_THRESHOLD_MESSAGES) {
        const oldMessageThreshold = Math.floor(workingMessages.length * 0.5);
        const oldMessages = workingMessages.slice(0, oldMessageThreshold);
        const compression = compressMessages(oldMessages);
        if (compression && compression.tokensReduced > 0) {
            workingMessages = [compression.compressedMessage, ...workingMessages.slice(oldMessageThreshold)];
            hadCompression = true;
        }
    }
    // Build output
    const outputMessages = [];
    let totalTokens = estimateTokens(systemPrompt);
    // We always want the last N messages (recency bias)
    const recentMessages = workingMessages.slice(-10); // Keep at least 10 recent
    // Add recent messages
    for (const msg of recentMessages) {
        const msgTokens = estimateTokens(msg.content);
        if (totalTokens + msgTokens > maxTokens) {
            break;
        }
        outputMessages.push({
            role: msg.role,
            content: msg.content,
        });
        totalTokens += msgTokens;
    }
    // Add any middle messages that fit
    const middleMessages = workingMessages.slice(0, -10).slice(-5);
    for (const msg of middleMessages) {
        const msgTokens = estimateTokens(msg.content);
        if (totalTokens + msgTokens > maxTokens) {
            break;
        }
        const insert = outputMessages.findIndex((m) => outputMessages.indexOf(m) > 0);
        if (insert >= 0) {
            outputMessages.splice(insert, 0, { role: msg.role, content: msg.content });
        }
        totalTokens += msgTokens;
    }
    return {
        systemPrompt,
        messages: outputMessages,
        estimatedTokens: totalTokens,
        hadCompression,
        originalMessageCount: originalCount,
        compressedMessageCount: outputMessages.length,
    };
}
/**
 * Build optimized context for API call
 */
export async function buildOptimizedContext(chatId, userBudgetTokens) {
    // Fetch conversation messages
    const result = await query(`SELECT m.role, m.content, m.trace_json 
     FROM messages m 
     WHERE m.conversation_id = $1
     ORDER BY m.sort_order ASC`, [chatId]);
    const messages = result.rows.map((row) => ({
        role: row.role,
        content: row.content,
        trace: row.trace_json,
        attachments: [],
    }));
    if (messages.length === 0) {
        return null;
    }
    const systemPrompt = 'You are Chocks, a practical local coding agent.';
    return assembleContext(messages, systemPrompt, userBudgetTokens);
}
/**
 * Get cache stats
 */
export function getCacheStats() {
    return {
        filesCached: fileCache.cacheSize(),
        maxCacheSize: 50,
    };
}
