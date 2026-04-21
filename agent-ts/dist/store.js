import { query, withTransaction } from './db.js';
function cloneMessage(message) {
    return {
        role: message.role,
        content: String(message.content || ''),
        trace: Array.isArray(message.trace) ? message.trace : [],
        streaming: !!message.streaming,
        attachments: Array.isArray(message.attachments)
            ? message.attachments.map((attachment) => ({ name: String(attachment.name || '') }))
            : [],
    };
}
async function ensureUser(client, user) {
    await client.query(`
    INSERT INTO app_users (id, display_name, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()
  `, [user.id, user.displayName]);
}
function normalizeConversation(input) {
    const id = String(input?.id || '').trim();
    if (!id)
        throw new Error('conversation.id required');
    const title = String(input?.title || 'Nova conversa').trim() || 'Nova conversa';
    const activeAgent = typeof input?.activeAgent === 'string' ? input.activeAgent : undefined;
    const ownerId = typeof input?.ownerId === 'string' && input.ownerId.trim() ? input.ownerId.trim() : undefined;
    const messages = Array.isArray(input?.messages)
        ? input.messages.map((message) => ({
            role: message?.role === 'agent' ? 'agent' : 'user',
            content: String(message?.content || ''),
            trace: Array.isArray(message?.trace) ? message.trace : [],
            streaming: !!message?.streaming,
            agentId: message?.agentId,
            helperAgentId: message?.helperAgentId,
            handoffLabel: message?.handoffLabel,
            collaborationLabel: message?.collaborationLabel,
            attachments: Array.isArray(message?.attachments)
                ? message.attachments
                    .map((attachment) => ({ name: String(attachment?.name || '').trim() }))
                    .filter((attachment) => attachment.name)
                : [],
        }))
        : [];
    return { id, ownerId, title, activeAgent, messages };
}
function assembleConversations(rows) {
    const conversations = new Map();
    const messageMaps = new Map();
    for (const row of rows) {
        let conversation = conversations.get(row.conversation_id);
        if (!conversation) {
            conversation = {
                id: row.conversation_id,
                ownerId: row.owner_id,
                title: row.title,
                activeAgent: row.active_agent || undefined,
                messages: [],
            };
            conversations.set(row.conversation_id, conversation);
            messageMaps.set(row.conversation_id, new Map());
        }
        if (row.message_order === null || !row.role)
            continue;
        const conversationMessages = messageMaps.get(row.conversation_id);
        let message = conversationMessages.get(row.message_order);
        if (!message) {
            message = {
                role: row.role,
                content: row.content || '',
                trace: Array.isArray(row.trace_json) ? row.trace_json : [],
                streaming: !!row.streaming,
                agentId: row.agent_id || undefined,
                helperAgentId: row.helper_agent_id || undefined,
                handoffLabel: row.handoff_label || undefined,
                collaborationLabel: row.collaboration_label || undefined,
                attachments: [],
            };
            conversationMessages.set(row.message_order, message);
            conversation.messages.push(message);
        }
        if (row.attachment_name) {
            message.attachments = message.attachments || [];
            message.attachments.push({ name: row.attachment_name });
        }
    }
    return Array.from(conversations.values());
}
export async function listConversations(ownerId) {
    const result = await query(`
    SELECT
      c.id AS conversation_id,
      c.owner_id,
      c.title,
      c.active_agent,
      c.created_at,
      c.updated_at,
      m.sort_order AS message_order,
      m.role,
      m.content,
      m.trace_json,
      m.streaming,
      m.agent_id,
      m.helper_agent_id,
      m.handoff_label,
      m.collaboration_label,
      a.name AS attachment_name,
      a.sort_order AS attachment_order
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    LEFT JOIN message_attachments a ON a.message_id = m.id
    WHERE c.owner_id = $1
    ORDER BY c.updated_at DESC, c.created_at DESC, m.sort_order ASC NULLS FIRST, a.sort_order ASC NULLS FIRST
  `, [ownerId]);
    return assembleConversations(result.rows);
}
export async function getConversationById(id, ownerId) {
    const result = await query(`
    SELECT
      c.id AS conversation_id,
      c.owner_id,
      c.title,
      c.active_agent,
      c.created_at,
      c.updated_at,
      m.sort_order AS message_order,
      m.role,
      m.content,
      m.trace_json,
      m.streaming,
      m.agent_id,
      m.helper_agent_id,
      m.handoff_label,
      m.collaboration_label,
      a.name AS attachment_name,
      a.sort_order AS attachment_order
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    LEFT JOIN message_attachments a ON a.message_id = m.id
    WHERE c.id = $1 AND c.owner_id = $2
    ORDER BY m.sort_order ASC NULLS FIRST, a.sort_order ASC NULLS FIRST
  `, [id, ownerId]);
    const items = assembleConversations(result.rows);
    return items[0] || null;
}
async function insertConversationSnapshot(client, conversation, user) {
    await ensureUser(client, user);
    await client.query(`
    INSERT INTO conversations (id, owner_id, title, active_agent, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET 
      owner_id = EXCLUDED.owner_id, 
      title = EXCLUDED.title, 
      active_agent = EXCLUDED.active_agent,
      updated_at = NOW()
  `, [conversation.id, user.id, conversation.title, conversation.activeAgent || null]);
    await client.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversation.id]);
    for (let index = 0; index < conversation.messages.length; index += 1) {
        const message = cloneMessage(conversation.messages[index]);
        const insertMessageResult = await client.query(`
      INSERT INTO messages (conversation_id, sort_order, role, content, trace_json, streaming, agent_id, helper_agent_id, handoff_label, collaboration_label)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
            conversation.id,
            index,
            message.role,
            message.content,
            JSON.stringify(message.trace || []),
            !!message.streaming,
            message.agentId || null,
            message.helperAgentId || null,
            message.handoffLabel || null,
            message.collaborationLabel || null,
        ]);
        const messageId = insertMessageResult.rows[0].id;
        const attachments = Array.isArray(message.attachments) ? message.attachments : [];
        for (let attachmentIndex = 0; attachmentIndex < attachments.length; attachmentIndex += 1) {
            await client.query(`
        INSERT INTO message_attachments (message_id, sort_order, name)
        VALUES ($1, $2, $3)
      `, [messageId, attachmentIndex, attachments[attachmentIndex].name]);
        }
    }
}
export async function saveConversationSnapshot(input, user) {
    const conversation = normalizeConversation(input);
    await withTransaction(async (client) => {
        await insertConversationSnapshot(client, conversation, user);
    });
    return getConversationById(conversation.id, user.id);
}
export async function createConversation(input, user) {
    const conversation = normalizeConversation({ id: input.id, ownerId: user.id, title: input.title, messages: [] });
    await withTransaction(async (client) => {
        await insertConversationSnapshot(client, conversation, user);
    });
    return getConversationById(conversation.id, user.id);
}
export async function renameConversation(id, title, ownerId) {
    await query(`
    UPDATE conversations
    SET title = $2, updated_at = NOW()
    WHERE id = $1 AND owner_id = $3
  `, [id, title, ownerId]);
    return getConversationById(id, ownerId);
}
export async function deleteConversation(id, ownerId) {
    await query(`DELETE FROM conversations WHERE id = $1 AND owner_id = $2`, [id, ownerId]);
    return { deleted: true };
}
export async function duplicateConversation(sourceId, nextId, user) {
    const conversation = await getConversationById(sourceId, user.id);
    if (!conversation)
        throw new Error('conversation not found');
    const workflow = await getWorkflowState(sourceId, user.id);
    const copyTitle = `${conversation.title || 'Nova conversa'} (copia)`;
    const copyConversation = {
        id: nextId,
        title: copyTitle,
        messages: conversation.messages.map(cloneMessage),
    };
    await withTransaction(async (client) => {
        await insertConversationSnapshot(client, copyConversation, user);
        if (workflow) {
            await client.query(`
        INSERT INTO workflow_plans (conversation_id, goal, summary, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [nextId, workflow.goal, workflow.summary || null, workflow.createdAt, workflow.updatedAt]);
            for (let index = 0; index < workflow.steps.length; index += 1) {
                const step = workflow.steps[index];
                await client.query(`
          INSERT INTO workflow_steps (conversation_id, step_id, text, status, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [nextId, step.id, step.text, step.status, index]);
            }
        }
    });
    return getConversationById(nextId, user.id);
}
export async function listTodos(ownerId) {
    const result = await query(`
    SELECT id, text, done, created_at, updated_at
    FROM agent_todos
    WHERE owner_id = $1
    ORDER BY id ASC
  `, [ownerId]);
    return result.rows.map((row) => ({
        id: row.id,
        text: row.text,
        done: row.done,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}
export async function addTodo(text, user) {
    const result = await query(`
    INSERT INTO app_users (id, display_name, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()
  `, [user.id, user.displayName]);
    const insertResult = await query(`
    INSERT INTO agent_todos (owner_id, text, done, created_at, updated_at)
    VALUES ($1, $2, FALSE, NOW(), NOW())
    RETURNING id, text, done, created_at, updated_at
  `, [user.id, text]);
    const row = insertResult.rows[0];
    return {
        id: row.id,
        text: row.text,
        done: row.done,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export async function updateTodo(id, patch, ownerId) {
    const result = await query(`
    UPDATE agent_todos
    SET
      text = COALESCE($2, text),
      done = COALESCE($3, done),
      updated_at = NOW()
    WHERE id = $1 AND owner_id = $4
    RETURNING id, text, done, created_at, updated_at
  `, [
        id,
        typeof patch.text === 'string' ? patch.text : null,
        typeof patch.done === 'boolean' ? patch.done : null,
        ownerId,
    ]);
    if (result.rows.length === 0)
        throw new Error('todo not found');
    const row = result.rows[0];
    return {
        id: row.id,
        text: row.text,
        done: row.done,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export async function getWorkflowState(chatId, ownerId) {
    const normalizedChatId = String(chatId || 'global').trim() || 'global';
    const planResult = await query(`
    SELECT wp.conversation_id, c.owner_id, wp.goal, wp.summary, wp.created_at, wp.updated_at
    FROM workflow_plans wp
    INNER JOIN conversations c ON c.id = wp.conversation_id
    WHERE wp.conversation_id = $1 AND c.owner_id = $2
  `, [normalizedChatId, ownerId]);
    if (planResult.rows.length === 0)
        return null;
    const stepsResult = await query(`
    SELECT step_id, text, status
    FROM workflow_steps
    WHERE conversation_id = $1
    ORDER BY sort_order ASC
  `, [normalizedChatId]);
    const plan = planResult.rows[0];
    return {
        chatId: plan.conversation_id,
        ownerId: plan.owner_id,
        goal: plan.goal,
        summary: plan.summary || undefined,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
        steps: stepsResult.rows.map((step) => ({
            id: step.step_id,
            text: step.text,
            status: step.status,
        })),
    };
}
export async function saveWorkflowState(workflow, user) {
    await withTransaction(async (client) => {
        await ensureUser(client, user);
        await client.query(`
      INSERT INTO conversations (id, owner_id, title, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET owner_id = EXCLUDED.owner_id
    `, [workflow.chatId, user.id, workflow.goal.slice(0, 48) || 'Nova conversa']);
        await client.query(`
      INSERT INTO workflow_plans (conversation_id, goal, summary, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (conversation_id)
      DO UPDATE SET
        goal = EXCLUDED.goal,
        summary = EXCLUDED.summary,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `, [
            workflow.chatId,
            workflow.goal,
            workflow.summary || null,
            workflow.createdAt,
            workflow.updatedAt,
        ]);
        await client.query(`DELETE FROM workflow_steps WHERE conversation_id = $1`, [workflow.chatId]);
        for (let index = 0; index < workflow.steps.length; index += 1) {
            const step = workflow.steps[index];
            await client.query(`
        INSERT INTO workflow_steps (conversation_id, step_id, text, status, sort_order)
        VALUES ($1, $2, $3, $4, $5)
      `, [workflow.chatId, step.id, step.text, step.status, index]);
        }
    });
    return getWorkflowState(workflow.chatId, user.id);
}
export async function clearWorkflowState(chatId, ownerId) {
    const normalizedChatId = String(chatId || 'global').trim() || 'global';
    await query(`
    DELETE FROM workflow_plans wp
    USING conversations c
    WHERE wp.conversation_id = c.id
      AND wp.conversation_id = $1
      AND c.owner_id = $2
  `, [normalizedChatId, ownerId]);
    return { cleared: true };
}
