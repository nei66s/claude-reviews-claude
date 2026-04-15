/**
 * Context Persistence System
 * Persists conversation context, API responses, agent responses, support chains, and interactions
 */
import { query } from './db';
// ============================================================================
// API Cache Functions
// ============================================================================
export async function cacheApiCall(conversationId, userId, apiName, endpoint, requestParams, responseData, sourceAgent, statusCode, errorMessage, expiresIn // milliseconds
) {
    const id = `cache-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : null;
    await query(`INSERT INTO api_calls_cache (
      id, conversation_id, user_id, api_name, endpoint, request_params, 
      response_data, status_code, error_message, source_agent, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (conversation_id, api_name, endpoint, request_params) 
    DO UPDATE SET
      response_data = $7,
      status_code = $8,
      error_message = $9,
      cached_at = NOW(),
      expires_at = $11
    `, [
        id,
        conversationId,
        userId,
        apiName,
        endpoint,
        JSON.stringify(requestParams),
        JSON.stringify(responseData),
        statusCode,
        errorMessage,
        sourceAgent,
        expiresAt?.toISOString(),
    ]);
    return id;
}
export async function getApiCacheEntry(conversationId, apiName, endpoint, requestParams) {
    const result = await query(`SELECT id, response_data, status_code, error_message, source_agent, cached_at
     FROM api_calls_cache
     WHERE conversation_id = $1 
       AND api_name = $2 
       AND endpoint = $3 
       AND request_params = $4
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`, [conversationId, apiName, endpoint, JSON.stringify(requestParams)]);
    if (result.rows.length === 0)
        return null;
    const row = result.rows[0];
    return {
        id: row.id,
        responseData: row.response_data,
        statusCode: row.status_code,
        errorMessage: row.error_message,
        sourceAgent: row.source_agent,
        cachedAt: row.cached_at,
    };
}
// ============================================================================
// Agent Response Tracking Functions
// ============================================================================
/**
 * Registra quem respondeu uma mensagem
 */
export async function recordAgentResponse(messageId, conversationId, userId, respondingAgent, agentRole, responseType = 'direct', isPrimaryResponder = true, confidenceLevel, sourceData) {
    const id = `response-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await query(`INSERT INTO agent_response_history (
      id, message_id, conversation_id, user_id, responding_agent, agent_role,
      response_type, is_primary_responder, confidence_level, response_source_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
        id,
        messageId,
        conversationId,
        userId,
        respondingAgent,
        agentRole,
        responseType,
        isPrimaryResponder,
        confidenceLevel,
        sourceData ? JSON.stringify(sourceData) : null,
    ]);
    return id;
}
/**
 * Recupera quem respondeu uma mensagem
 */
export async function getMessageResponders(conversationId, messageId) {
    const result = await query(`SELECT responding_agent, agent_role, response_type, is_primary_responder, 
            confidence_level, response_source_data, created_at
     FROM agent_response_history
     WHERE conversation_id = $1 AND message_id = $2
     ORDER BY is_primary_responder DESC, created_at ASC`, [conversationId, messageId]);
    return result.rows.map(row => ({
        respondingAgent: row.responding_agent,
        agentRole: row.agent_role,
        responseType: row.response_type,
        isPrimaryResponder: row.is_primary_responder,
        confidenceLevel: row.confidence_level,
        sourceData: row.response_source_data,
        createdAt: row.created_at,
    }));
}
// ============================================================================
// Agent Support Chain Functions
// ============================================================================
/**
 * Registra quem suportou a resposta de quem
 */
export async function recordAgentSupport(conversationId, userId, messageId, primaryAgent, supportingAgent, supportType, supportContent, supportData, feedbackType) {
    const id = `support-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await query(`INSERT INTO agent_support_chain (
      id, conversation_id, user_id, message_id, primary_agent, supporting_agent,
      support_type, support_content, support_data, feedback_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
        id,
        conversationId,
        userId,
        messageId,
        primaryAgent,
        supportingAgent,
        supportType,
        supportContent,
        supportData ? JSON.stringify(supportData) : null,
        feedbackType,
    ]);
    return id;
}
/**
 * Recupera toda cadeia de suporte para uma mensagem
 */
export async function getSupportChain(conversationId, messageId) {
    const result = await query(`SELECT primary_agent, supporting_agent, support_type, support_content, 
            support_data, feedback_type, created_at
     FROM agent_support_chain
     WHERE conversation_id = $1 AND message_id = $2
     ORDER BY created_at ASC`, [conversationId, messageId]);
    return result.rows.map(row => ({
        primaryAgent: row.primary_agent,
        supportingAgent: row.supporting_agent,
        supportType: row.support_type,
        supportContent: row.support_content,
        supportData: row.support_data,
        feedbackType: row.feedback_type,
        createdAt: row.created_at,
    }));
}
/**
 * Resumo de quem apoiou quem durante a conversa
 */
export async function getAgentSupportSummary(conversationId) {
    const result = await query(`SELECT primary_agent, supporting_agent, support_type, COUNT(*) as count
     FROM agent_support_chain
     WHERE conversation_id = $1
     GROUP BY primary_agent, supporting_agent, support_type
     ORDER BY count DESC`, [conversationId]);
    return result.rows;
}
// ============================================================================
// Conversation Context Functions
// ============================================================================
export async function setContextValue(conversationId, userId, contextType, key, value, expiresIn // milliseconds
) {
    const id = `ctx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : null;
    await query(`INSERT INTO conversation_context (
      id, conversation_id, owner_id, context_type, key, value, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (conversation_id, context_type, key)
    DO UPDATE SET
      value = $6,
      expires_at = $7,
      updated_at = NOW()
    `, [
        id,
        conversationId,
        userId,
        contextType,
        key,
        JSON.stringify(value),
        expiresAt?.toISOString(),
    ]);
    return id;
}
export async function getContextValue(conversationId, contextType, key) {
    const result = await query(`SELECT id, value, updated_at
     FROM conversation_context
     WHERE conversation_id = $1
       AND context_type = $2
       AND key = $3
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`, [conversationId, contextType, key]);
    if (result.rows.length === 0)
        return null;
    return {
        id: result.rows[0].id,
        value: result.rows[0].value,
        updatedAt: result.rows[0].updated_at,
    };
}
export async function getAllContextByType(conversationId, contextType) {
    const result = await query(`SELECT key, value, updated_at
     FROM conversation_context
     WHERE conversation_id = $1
       AND context_type = $2
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY updated_at DESC`, [conversationId, contextType]);
    return result.rows.map(row => ({
        key: row.key,
        value: row.value,
        updatedAt: row.updated_at,
    }));
}
// ============================================================================
// Agent Conversational State Functions
// ============================================================================
/**
 * Atualiza o estado conversacional de um agente durante a conversa
 */
export async function updateAgentConversationalState(conversationId, userId, agentName, updates) {
    const result = await query(`SELECT id FROM agent_conversational_state 
     WHERE conversation_id = $1 AND agent_name = $2
     LIMIT 1`, [conversationId, agentName]);
    if (result.rows.length === 0) {
        // Create new
        const id = `agent-conv-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        await query(`INSERT INTO agent_conversational_state (
        id, conversation_id, user_id, agent_name, agent_role, agent_emoji, is_active,
        last_message_index, personality_state, expertise_context, recent_decisions,
        confidence_score, mood_indicator, support_provided_count, corrections_made
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, [
            id,
            conversationId,
            userId,
            agentName,
            updates.agentRole,
            updates.agentEmoji,
            updates.isActive ?? false,
            updates.lastMessageIndex,
            updates.personalityState ? JSON.stringify(updates.personalityState) : null,
            updates.expertiseContext ? JSON.stringify(updates.expertiseContext) : null,
            updates.recentDecisions ? JSON.stringify(updates.recentDecisions) : null,
            updates.confidenceScore,
            updates.moodIndicator,
            updates.supportProvidedCount ?? 0,
            updates.correctionsMade ?? 0,
        ]);
    }
    else {
        // Update existing
        await query(`UPDATE agent_conversational_state SET
        agent_role = COALESCE($3, agent_role),
        agent_emoji = COALESCE($4, agent_emoji),
        is_active = COALESCE($5, is_active),
        last_message_index = COALESCE($6, last_message_index),
        personality_state = COALESCE($7, personality_state),
        expertise_context = COALESCE($8, expertise_context),
        recent_decisions = COALESCE($9, recent_decisions),
        confidence_score = COALESCE($10, confidence_score),
        mood_indicator = COALESCE($11, mood_indicator),
        support_provided_count = COALESCE($12, support_provided_count),
        corrections_made = COALESCE($13, corrections_made),
        updated_at = NOW()
      WHERE conversation_id = $1 AND agent_name = $2`, [
            conversationId,
            agentName,
            updates.agentRole,
            updates.agentEmoji,
            updates.isActive,
            updates.lastMessageIndex,
            updates.personalityState ? JSON.stringify(updates.personalityState) : null,
            updates.expertiseContext ? JSON.stringify(updates.expertiseContext) : null,
            updates.recentDecisions ? JSON.stringify(updates.recentDecisions) : null,
            updates.confidenceScore,
            updates.moodIndicator,
            updates.supportProvidedCount,
            updates.correctionsMade,
        ]);
    }
}
export async function getAgentConversationalState(conversationId, agentName) {
    const result = await query(`SELECT id, agent_role, agent_emoji, is_active, last_message_index, personality_state,
            expertise_context, recent_decisions, confidence_score, mood_indicator,
            support_provided_count, corrections_made, updated_at
     FROM agent_conversational_state
     WHERE conversation_id = $1 AND agent_name = $2
     LIMIT 1`, [conversationId, agentName]);
    if (result.rows.length === 0)
        return null;
    return {
        agentRole: result.rows[0].agent_role,
        agentEmoji: result.rows[0].agent_emoji,
        isActive: result.rows[0].is_active,
        lastMessageIndex: result.rows[0].last_message_index,
        personalityState: result.rows[0].personality_state,
        expertiseContext: result.rows[0].expertise_context,
        recentDecisions: result.rows[0].recent_decisions,
        confidenceScore: result.rows[0].confidence_score,
        moodIndicator: result.rows[0].mood_indicator,
        supportProvidedCount: result.rows[0].support_provided_count,
        correctionsMade: result.rows[0].corrections_made,
        updatedAt: result.rows[0].updated_at,
    };
}
export async function getAllAgentConversationalStates(conversationId) {
    const result = await query(`SELECT agent_name, agent_role, agent_emoji, is_active, last_message_index, personality_state,
            expertise_context, recent_decisions, confidence_score, mood_indicator,
            support_provided_count, corrections_made, updated_at
     FROM agent_conversational_state
     WHERE conversation_id = $1
     ORDER BY is_active DESC, updated_at DESC`, [conversationId]);
    return result.rows.map(row => ({
        agentName: row.agent_name,
        agentRole: row.agent_role,
        agentEmoji: row.agent_emoji,
        isActive: row.is_active,
        lastMessageIndex: row.last_message_index,
        personalityState: row.personality_state,
        expertiseContext: row.expertise_context,
        recentDecisions: row.recent_decisions,
        confidenceScore: row.confidence_score,
        moodIndicator: row.mood_indicator,
        supportProvidedCount: row.support_provided_count,
        correctionsMade: row.corrections_made,
        updatedAt: row.updated_at,
    }));
}
// ============================================================================
// Agent Interaction Graph Functions
// ============================================================================
/**
 * Registra uma interação entre dois agentes
 */
export async function recordAgentInteraction(conversationId, userId, fromAgent, toAgent, interactionType, lastInteractionMessageIndex, contextOfInteraction) {
    // Check if interaction exists
    const result = await query(`SELECT id FROM agent_interaction_graph
     WHERE conversation_id = $1 AND from_agent = $2 AND to_agent = $3 AND interaction_type = $4
     LIMIT 1`, [conversationId, fromAgent, toAgent, interactionType]);
    if (result.rows.length === 0) {
        // Create new
        const id = `interaction-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        await query(`INSERT INTO agent_interaction_graph (
        id, conversation_id, user_id, from_agent, to_agent, interaction_type,
        last_interaction_message_index, context_of_interaction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            id,
            conversationId,
            userId,
            fromAgent,
            toAgent,
            interactionType,
            lastInteractionMessageIndex,
            contextOfInteraction,
        ]);
    }
    else {
        // Increment count
        await query(`UPDATE agent_interaction_graph SET
        interaction_count = interaction_count + 1,
        last_interaction_message_index = COALESCE($3, last_interaction_message_index),
        context_of_interaction = COALESCE($4, context_of_interaction),
        updated_at = NOW()
      WHERE conversation_id = $1 AND from_agent = $2 AND to_agent = $5 AND interaction_type = $6`, [
            conversationId,
            fromAgent,
            lastInteractionMessageIndex,
            contextOfInteraction,
            toAgent,
            interactionType,
        ]);
    }
}
export async function getAgentInteractions(conversationId, filterAgent) {
    let query_str = `SELECT from_agent, to_agent, interaction_type, interaction_count, 
                          last_interaction_message_index, context_of_interaction, updated_at
                   FROM agent_interaction_graph
                   WHERE conversation_id = $1`;
    const params = [conversationId];
    if (filterAgent) {
        query_str += ` AND (from_agent = $2 OR to_agent = $2)`;
        params.push(filterAgent);
    }
    query_str += ` ORDER BY interaction_count DESC, updated_at DESC`;
    const result = await query(query_str, params);
    return result.rows.map(row => ({
        fromAgent: row.from_agent,
        toAgent: row.to_agent,
        interactionType: row.interaction_type,
        interactionCount: row.interaction_count,
        lastInteractionMessageIndex: row.last_interaction_message_index,
        contextOfInteraction: row.context_of_interaction,
        updatedAt: row.updated_at,
    }));
}
// ============================================================================
// Message Trace Functions
// ============================================================================
export async function storeMessageTrace(messageId, conversationId, userId, respondingAgent, supportingAgents, toolCalls, agentReasoning, apiCalls, performanceMetrics) {
    const id = `trace-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await query(`INSERT INTO message_traces (
      id, message_id, conversation_id, user_id, responding_agent, supporting_agents,
      tool_calls, agent_reasoning, api_calls, performance_metrics
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
        id,
        messageId,
        conversationId,
        userId,
        respondingAgent,
        supportingAgents ? JSON.stringify(supportingAgents) : null,
        toolCalls ? JSON.stringify(toolCalls) : null,
        agentReasoning ? JSON.stringify(agentReasoning) : null,
        apiCalls ? JSON.stringify(apiCalls) : null,
        performanceMetrics ? JSON.stringify(performanceMetrics) : null,
    ]);
    return id;
}
export async function getMessageTrace(messageId) {
    const result = await query(`SELECT id, responding_agent, supporting_agents, tool_calls, agent_reasoning, 
            api_calls, performance_metrics, created_at
     FROM message_traces
     WHERE message_id = $1
     LIMIT 1`, [messageId]);
    if (result.rows.length === 0)
        return null;
    return {
        id: result.rows[0].id,
        respondingAgent: result.rows[0].responding_agent,
        supportingAgents: result.rows[0].supporting_agents || [],
        toolCalls: result.rows[0].tool_calls,
        agentReasoning: result.rows[0].agent_reasoning,
        apiCalls: result.rows[0].api_calls,
        performanceMetrics: result.rows[0].performance_metrics,
        createdAt: result.rows[0].created_at,
    };
}
// ============================================================================
// Conversation Metadata Functions
// ============================================================================
export async function updateConversationMetadata(conversationId, userId, updates) {
    const result = await query(`SELECT * FROM conversation_metadata WHERE conversation_id = $1`, [conversationId]);
    if (result.rows.length === 0) {
        // Create new metadata
        await query(`INSERT INTO conversation_metadata (
        conversation_id, user_id, last_accessed_agent, active_agents, agent_sequence,
        agent_participation_count, agent_support_map, context_summary, important_facts, user_preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
            conversationId,
            userId,
            updates.lastAccessedAgent || null,
            updates.activeAgents || [],
            updates.agentSequence || [],
            updates.agentParticipationCount ? JSON.stringify(updates.agentParticipationCount) : null,
            updates.agentSupportMap ? JSON.stringify(updates.agentSupportMap) : null,
            updates.contextSummary || null,
            updates.importantFacts ? JSON.stringify(updates.importantFacts) : null,
            updates.userPreferences ? JSON.stringify(updates.userPreferences) : null,
        ]);
    }
    else {
        // Update existing metadata
        await query(`UPDATE conversation_metadata SET
        last_accessed_agent = COALESCE($2, last_accessed_agent),
        active_agents = COALESCE($3, active_agents),
        agent_sequence = COALESCE($4, agent_sequence),
        agent_participation_count = COALESCE($5, agent_participation_count),
        agent_support_map = COALESCE($6, agent_support_map),
        context_summary = COALESCE($7, context_summary),
        important_facts = COALESCE($8, important_facts),
        user_preferences = COALESCE($9, user_preferences),
        updated_at = NOW()
      WHERE conversation_id = $1`, [
            conversationId,
            updates.lastAccessedAgent,
            updates.activeAgents ? JSON.stringify(updates.activeAgents) : null,
            updates.agentSequence ? JSON.stringify(updates.agentSequence) : null,
            updates.agentParticipationCount ? JSON.stringify(updates.agentParticipationCount) : null,
            updates.agentSupportMap ? JSON.stringify(updates.agentSupportMap) : null,
            updates.contextSummary,
            updates.importantFacts ? JSON.stringify(updates.importantFacts) : null,
            updates.userPreferences ? JSON.stringify(updates.userPreferences) : null,
        ]);
    }
}
export async function getConversationMetadata(conversationId) {
    const result = await query(`SELECT last_accessed_agent, active_agents, agent_sequence, agent_participation_count, agent_support_map,
            context_summary, important_facts, user_preferences, updated_at
     FROM conversation_metadata
     WHERE conversation_id = $1
     LIMIT 1`, [conversationId]);
    if (result.rows.length === 0)
        return null;
    return {
        lastAccessedAgent: result.rows[0].last_accessed_agent,
        activeAgents: result.rows[0].active_agents || [],
        agentSequence: result.rows[0].agent_sequence || [],
        agentParticipationCount: result.rows[0].agent_participation_count || {},
        agentSupportMap: result.rows[0].agent_support_map || {},
        contextSummary: result.rows[0].context_summary,
        importantFacts: result.rows[0].important_facts,
        userPreferences: result.rows[0].user_preferences,
        updatedAt: result.rows[0].updated_at,
    };
}
// ============================================================================
// Bulk Context Retrieval
// ============================================================================
/**
 * Restaura TUDO da conversa: agentes, suportes, interações, dados de API, etc
 */
export async function loadFullConversationContext(conversationId) {
    return {
        metadata: await getConversationMetadata(conversationId),
        agentStates: await getAllAgentConversationalStates(conversationId),
        agentInteractions: await getAgentInteractions(conversationId),
        supportSummary: await getAgentSupportSummary(conversationId),
        context: {
            exchangeRates: await getAllContextByType(conversationId, 'exchange_rate'),
            userPreferences: await getAllContextByType(conversationId, 'user_preference'),
            apiResponses: await getAllContextByType(conversationId, 'api_response'),
            metadata: await getAllContextByType(conversationId, 'metadata'),
        },
    };
}
/**
 * Recupera resumo visual de toda a dinâmica da conversa
 */
export async function getConversationDynamicsSummary(conversationId) {
    const metadata = await getConversationMetadata(conversationId);
    const allAgents = await getAllAgentConversationalStates(conversationId);
    const interactions = await getAgentInteractions(conversationId);
    const supportMap = await getAgentSupportSummary(conversationId);
    return {
        metadata,
        agents: allAgents,
        interactions,
        supportMap,
        statistics: {
            totalAgentsInvolved: allAgents.length,
            totalInteractions: interactions.reduce((sum, i) => sum + i.interactionCount, 0),
            primaryInteractionType: interactions[0]?.interactionType || null,
            agentMostActive: allAgents.sort((a, b) => (b.supportProvidedCount || 0) - (a.supportProvidedCount || 0))[0]?.agentName || null,
        }
    };
}
// ============================================================================
// Cache Cleanup Functions
// ============================================================================
export async function cleanupExpiredContext() {
    await query(`DELETE FROM conversation_context WHERE expires_at < NOW()`);
    await query(`DELETE FROM api_calls_cache WHERE expires_at < NOW()`);
}
export async function cleanupConversationContext(conversationId) {
    await query(`DELETE FROM api_calls_cache WHERE conversation_id = $1`, [conversationId]);
    await query(`DELETE FROM conversation_context WHERE conversation_id = $1`, [conversationId]);
    await query(`DELETE FROM agent_conversational_state WHERE conversation_id = $1`, [conversationId]);
    await query(`DELETE FROM agent_response_history WHERE conversation_id = $1`, [conversationId]);
    await query(`DELETE FROM agent_support_chain WHERE conversation_id = $1`, [conversationId]);
    await query(`DELETE FROM agent_interaction_graph WHERE conversation_id = $1`, [conversationId]);
    await query(`DELETE FROM message_traces WHERE conversation_id = $1`, [conversationId]);
    await query(`DELETE FROM conversation_metadata WHERE conversation_id = $1`, [conversationId]);
}
