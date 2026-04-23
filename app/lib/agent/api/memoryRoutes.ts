import { Router, Request, Response } from 'express'
import { query } from '../db'
import crypto from 'crypto'

const router = Router()

// GET /memory/users - List all registered users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id as user_id FROM public.app_users ORDER BY id ASC`
    )
    res.json({ users: result.rows.map(r => r.user_id) })
  } catch (error) {
    console.error('[memory] Failed to list users:', error)
    res.status(500).json({ error: 'Falha ao listar usuários.' })
  }
})

// Temporary maintenance route to force rich re-compilation
router.get('/debug/recompile/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const itemsResult = await query(
      `select content, type, normalized_value from public.user_memory_items where user_id = $1 and status = 'active'`,
      [userId]
    )
    
    const facts = itemsResult.rows.filter(r => r.type === 'declared_fact').map(r => r.content)
    const preferences = itemsResult.rows.filter(r => r.type === 'preference').map(r => r.content)
    const goals = itemsResult.rows.filter(r => r.type === 'goal').map(r => r.content)
    const constraints = itemsResult.rows.filter(r => r.type === 'constraint').map(r => r.content)
    const style = itemsResult.rows.filter(r => r.type === 'interaction_style').map(r => r.content)
    
    const summaryShort = [
      `${facts.length} fatos`,
      preferences.length ? `${preferences.length} preferências` : '',
      goals.length ? `${goals.length} objetivos` : '',
      constraints.length ? `${constraints.length} restrições` : '',
    ].filter(Boolean).join(', ')
    
    const finalSummaryShort = `Perfil com ${summaryShort}.`
    
    const summaryLongParts = ['# Perfil do usuário', '']
    if (facts.length) {
      summaryLongParts.push('## Fatos e traços')
      facts.forEach(f => summaryLongParts.push(`- ${f}`))
    }
    if (goals.length) {
      summaryLongParts.push('\n## Objetivos')
      goals.forEach(g => summaryLongParts.push(`- ${g}`))
    }
    if (preferences.length) {
      summaryLongParts.push('\n## Preferências')
      preferences.forEach(p => summaryLongParts.push(`- ${p}`))
    }
    if (constraints.length) {
      summaryLongParts.push('\n## Restrições')
      constraints.forEach(c => summaryLongParts.push(`- ${c}`))
    }
    if (style.length) {
      summaryLongParts.push('\n## Estilo de Interação')
      style.forEach(s => summaryLongParts.push(`- ${s}`))
    }

    const summaryLong = summaryLongParts.join('\n').trim()
    
    await query(
      `insert into public.user_profile (
         user_id, summary_short, summary_long, last_compiled_at, updated_at
       ) values ($1, $2, $3, now(), now())
       on conflict (user_id) do update set
         summary_short = excluded.summary_short,
         summary_long = excluded.summary_long,
         last_compiled_at = excluded.last_compiled_at,
         updated_at = now()`,
      [userId, finalSummaryShort, summaryLong]
    )
    res.json({ success: true, userId });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /memory/users/:userId/profile
router.get('/users/:userId/profile', async (req: Request, res: Response) => {
  const { userId } = req.params
  try {
    const result = await query(
      `select * from public.user_profile where user_id = $1 limit 1`,
      [userId]
    )
    
    if (result.rows.length === 0) {
      // Return empty profile instead of 404 to allow initialization
      return res.json({ 
        userId, 
        profile: {
          userId,
          summaryShort: '',
          summaryLong: '',
          interactionPreferences: {},
          recurringTopics: [],
          activeGoals: [],
          knownConstraints: [],
          keyFacts: [],
          profileVersion: 1
        } 
      })
    }
    
    const row = result.rows[0]
    res.json({
      userId,
      profile: {
        userId: row.user_id,
        summaryShort: row.summary_short,
        summaryLong: row.summary_long,
        interactionPreferences: row.interaction_preferences,
        recurringTopics: row.recurring_topics,
        activeGoals: row.active_goals,
        knownConstraints: row.known_constraints,
        keyFacts: row.key_facts,
        profileVersion: row.profile_version,
        lastCompiledAt: row.last_compiled_at,
        updatedAt: row.updated_at
      }
    })
  } catch (error) {
    console.error('[memory] Failed to get profile:', error)
    res.status(500).json({ error: 'Falha ao buscar perfil de memória.' })
  }
})

// GET /memory/users/:userId/items
router.get('/users/:userId/items', async (req: Request, res: Response) => {
  const { userId } = req.params
  const status = req.query.status as string | undefined
  const type = req.query.type as string | undefined
  const limit = parseInt(req.query.limit as string) || 50

  const params: any[] = [userId]
  const where: string[] = ['user_id = $1']

  if (status) {
    params.push(status)
    where.push(`status = $${params.length}`)
  }

  if (type) {
    params.push(type)
    where.push(`type = $${params.length}`)
  }

  params.push(limit)

  try {
    const result = await query(
      `select * from public.user_memory_items 
       where ${where.join(' and ')}
       order by updated_at desc, created_at desc
       limit $${params.length}`,
      params
    )
    
    res.json({
      userId,
      items: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        category: row.category,
        content: row.content,
        normalizedValue: row.normalized_value,
        sourceConversationId: row.source_conversation_id,
        sourceMessageId: row.source_message_id ? Number(row.source_message_id) : null,
        confidenceScore: Number(row.confidence_score),
        relevanceScore: Number(row.relevance_score),
        sensitivityLevel: row.sensitivity_level,
        status: row.status,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    })
  } catch (error) {
    console.error('[memory] Failed to list items:', error)
    res.status(500).json({ error: 'Falha ao listar itens de memória.' })
  }
})

// GET /memory/users/:userId/audit
router.get('/users/:userId/audit', async (req: Request, res: Response) => {
  const { userId } = req.params
  const limit = parseInt(req.query.limit as string) || 50
  
  try {
    // 1. Get events list
    const eventsResult = await query(
      `select 
         al.*,
         umi.type as item_type,
         umi.status as item_status,
         left(umi.content, 140) as item_content_preview
       from public.memory_audit_log al
       left join public.user_memory_items umi 
         on umi.id = al.memory_item_id and umi.user_id = al.user_id
       where al.user_id = $1
       order by al.created_at desc
       limit $2`,
      [userId, limit]
    )

    // 2. Calculate summary statistics
    const statsResult = await query(
      `select 
         min(created_at) as first_event_at,
         count(*) filter (where action in ('created', 'promoted') and actor != 'admin') as automatic_captures,
         count(*) filter (where action in ('contradicted', 'archived', 'deleted', 'updated') and actor = 'admin') as manual_corrections,
         count(*) filter (where action = 'archived') as archived_count,
         count(*) filter (where action = 'contradicted') as contradicted_count,
         count(*) filter (where action = 'deleted') as deleted_count
       from public.memory_audit_log
       where user_id = $1`,
      [userId]
    )

    const stats = statsResult.rows[0] || {}
    
    res.json({
      userId,
      summary: {
        userId,
        firstEventAt: stats.first_event_at,
        automaticCaptures: parseInt(stats.automatic_captures || '0'),
        manualCorrections: parseInt(stats.manual_corrections || '0'),
        archived: parseInt(stats.archived_count || '0'),
        contradicted: parseInt(stats.contradicted_count || '0'),
        deleted: parseInt(stats.deleted_count || '0')
      },
      events: eventsResult.rows.map(row => ({
        id: Number(row.id),
        memoryItemId: row.memory_item_id,
        userId: row.user_id,
        action: row.action,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        reason: row.reason,
        actor: row.actor,
        createdAt: row.created_at,
        itemType: row.item_type,
        itemStatus: row.item_status,
        itemContentPreview: row.item_content_preview
      }))
    })
  } catch (error) {
    console.error('[memory] Failed to get audit log:', error)
    res.status(500).json({ error: 'Falha ao buscar logs de auditoria de memória.' })
  }
})

// --- Graph Helpers ---
function sha1Short(input: string) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10)
}

function normalizeStrings(values: any, limit: number): string[] {
  const arr = Array.isArray(values) ? values : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of arr) {
    const text = String(raw || '').trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= limit) break
  }
  return out
}

function extractLikelyName(profile: any, items: any[], fallback?: string) {
  const fromKeyFacts = normalizeStrings(profile?.keyFacts ?? [], 30)
  const candidates = [
    ...fromKeyFacts,
    ...items.map(item => item.content)
  ]
  for (const fact of candidates) {
    const match = /^nome\s*:\s*(.+)$/i.exec(String(fact).trim())
    if (match?.[1]) return match[1].trim()
  }
  return fallback
}

// GET /memory/users/:userId/graph
router.get('/users/:userId/graph', async (req: Request, res: Response) => {
  const { userId } = req.params
  try {
    const profileResult = await query(`select * from public.user_profile where user_id = $1 limit 1`, [userId])
    const itemsResult = await query(`select * from public.user_memory_items where user_id = $1 and status = 'active' limit 500`, [userId])
    
    const profile = profileResult.rows[0] || null
    const items = itemsResult.rows
    
    const nodes: any[] = []
    const edges: any[] = []
    const nodeSeen = new Set<string>()
    const edgeSeen = new Set<string>()

    const orchestratorNodeId = 'memory-orchestrator'
    const usersRootNodeId = 'users-root'
    const userNodeId = `user-${userId}`
    const identityNodeId = `user-${userId}-identity`
    const preferencesNodeId = `user-${userId}-preferences`
    const goalsNodeId = `user-${userId}-goals`
    const topicsNodeId = `user-${userId}-topics`

    const addNode = (n: any) => { if (!nodeSeen.has(n.id)) { nodeSeen.add(n.id); nodes.push(n) } }
    const addEdge = (s: string, t: string, k = 'contains') => {
      const id = `${s}::${t}::${k}`
      if (!edgeSeen.has(id)) { edgeSeen.add(id); edges.push({ id, source: s, target: t, kind: k }) }
    }

    addNode({ id: orchestratorNodeId, label: 'Memory Orchestrator', kind: 'root', source: 'system' })
    addNode({ id: usersRootNodeId, label: 'Usuários', kind: 'group', source: 'system' })
    
    const userLabel = extractLikelyName(profile, items) ? `${extractLikelyName(profile, items)} / ${userId}` : userId
    addNode({ id: userNodeId, label: userLabel, kind: 'user', userId, source: 'system', payload: { summaryShort: profile?.summary_short || '' } })
    
    addNode({ id: identityNodeId, label: 'Identidade', kind: 'section', userId, source: 'system' })
    addNode({ id: preferencesNodeId, label: 'Preferências', kind: 'section', userId, source: 'system' })
    addNode({ id: goalsNodeId, label: 'Objetivos', kind: 'section', userId, source: 'system' })
    addNode({ id: topicsNodeId, label: 'Temas recorrentes', kind: 'section', userId, source: 'system' })

    addEdge(orchestratorNodeId, usersRootNodeId)
    addEdge(usersRootNodeId, userNodeId)
    addEdge(userNodeId, identityNodeId)
    addEdge(userNodeId, preferencesNodeId)
    addEdge(userNodeId, goalsNodeId)
    addEdge(userNodeId, topicsNodeId)

    // Identity traits from profile
    const identityTraits = normalizeStrings(profile?.key_facts || [], 12)
    if (profile?.summary_short) identityTraits.unshift(`Resumo: ${profile.summary_short}`)
    
    for (const val of identityTraits) {
      const traitId = `user-${userId}-trait-${sha1Short('id:' + val)}`
      addNode({ id: traitId, label: val, kind: 'trait', userId, source: 'user_profile', payload: { value: val } })
      addEdge(identityNodeId, traitId)
    }

    // Items into sections
    for (const item of items) {
      const label = item.content.trim().slice(0, 120) || '(vazio)'
      const itemNodeId = `user-${userId}-memory-${sha1Short('item:' + item.id)}`
      addNode({
        id: itemNodeId, label, kind: 'memory_item', userId, source: 'user_memory_items',
        payload: { memoryItemId: item.id, type: item.type, category: item.category, status: item.status }
      })
      
      if (item.type === 'goal') addEdge(goalsNodeId, itemNodeId)
      else if (item.type === 'preference' || item.type === 'interaction_style') addEdge(preferencesNodeId, itemNodeId)
      else addEdge(identityNodeId, itemNodeId)
    }

    res.json({
      meta: { userId, generatedAt: new Date().toISOString(), memoryItemsTotal: items.length, memoryItemsIncluded: items.length },
      nodes,
      edges
    })
  } catch (error) {
    console.error('[memory] Failed to generate graph:', error)
    res.status(500).json({ error: 'Falha ao gerar grafo de memória.' })
  }
})

// PATCH /memory/users/:userId/items/:itemId
router.patch('/users/:userId/items/:itemId', async (req: Request, res: Response) => {
  const { userId, itemId } = req.params
  const { status, category, content, reason } = req.body
  
  try {
    const currentResult = await query(
      `select status from public.user_memory_items where id = $1 and user_id = $2 limit 1`,
      [itemId, userId]
    )
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' })
    }
    
    const previousStatus = currentResult.rows[0].status
    const nextStatus = status || previousStatus
    
    const updateResult = await query(
      `update public.user_memory_items
       set status = $3,
           category = coalesce($4, category),
           content = coalesce($5, content),
           updated_at = now()
       where id = $1 and user_id = $2
       returning *`,
      [itemId, userId, nextStatus, category || null, content || null]
    )
    
    const updatedItem = updateResult.rows[0]
    
    // Log audit
    if (status && status !== previousStatus) {
      // Determine semantic action from status or fallback to updated
      let action = 'updated'
      if (nextStatus === 'contradicted') action = 'contradicted'
      else if (nextStatus === 'archived') action = 'archived'
      else if (nextStatus === 'deleted') action = 'deleted'
      else if (nextStatus === 'active' && previousStatus === 'candidate') action = 'promoted'

      await query(
        `insert into public.memory_audit_log (
           memory_item_id, user_id, action, previous_status, new_status, reason, actor
         ) values ($1, $2, $3, $4, $5, $6, $7)`,
        [itemId, userId, action, previousStatus, nextStatus, reason || 'manual_admin', 'admin']
      )
    }
    
    res.json({
      item: {
        id: updatedItem.id,
        status: updatedItem.status,
        category: updatedItem.category,
        content: updatedItem.content,
        updatedAt: updatedItem.updated_at
      }
    })

    // Trigger profile re-compilation in the background after change
    try {
      const itemsResult = await query(
        `select content, type, normalized_value from public.user_memory_items where user_id = $1 and status = 'active'`,
        [userId]
      )
      
      const facts = itemsResult.rows.filter(r => r.type === 'declared_fact').map(r => r.content)
      const preferences = itemsResult.rows.filter(r => r.type === 'preference').map(r => r.content)
      const goals = itemsResult.rows.filter(r => r.type === 'goal').map(r => r.content)
      const constraints = itemsResult.rows.filter(r => r.type === 'constraint').map(r => r.content)
      const style = itemsResult.rows.filter(r => r.type === 'interaction_style').map(r => r.content)
      
      const summaryShort = [
        `${facts.length} fatos`,
        preferences.length ? `${preferences.length} preferências` : '',
        goals.length ? `${goals.length} objetivos` : '',
        constraints.length ? `${constraints.length} restrições` : '',
      ].filter(Boolean).join(', ')
      
      const finalSummaryShort = `Perfil com ${summaryShort}.`
      
      const summaryLongParts = ['# Perfil do usuário', '']
      if (facts.length) {
        summaryLongParts.push('## Fatos e traços')
        facts.forEach(f => summaryLongParts.push(`- ${f}`))
      }
      if (goals.length) {
        summaryLongParts.push('\n## Objetivos')
        goals.forEach(g => summaryLongParts.push(`- ${g}`))
      }
      if (preferences.length) {
        summaryLongParts.push('\n## Preferências')
        preferences.forEach(p => summaryLongParts.push(`- ${p}`))
      }
      if (constraints.length) {
        summaryLongParts.push('\n## Restrições')
        constraints.forEach(c => summaryLongParts.push(`- ${c}`))
      }
      if (style.length) {
        summaryLongParts.push('\n## Estilo de Interação')
        style.forEach(s => summaryLongParts.push(`- ${s}`))
      }

      const summaryLong = summaryLongParts.join('\n').trim()
      
      await query(
        `insert into public.user_profile (
           user_id, summary_short, summary_long, last_compiled_at, updated_at
         ) values ($1, $2, $3, now(), now())
         on conflict (user_id) do update set
           summary_short = excluded.summary_short,
           summary_long = excluded.summary_long,
           last_compiled_at = excluded.last_compiled_at,
           updated_at = now()`,
        [userId, finalSummaryShort, summaryLong]
      )
    } catch (e) {
      console.error('[memory] Background profile recompile failed:', e)
    }
  } catch (error) {
    console.error('[memory] Failed to update item:', error)
    res.status(500).json({ error: 'Falha ao atualizar item de memória.' })
  }
})

// POST /memory/profile/compile
router.post('/profile/compile', async (req: Request, res: Response) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId is required' })
  
  // Basic mock implementation for now to satisfy the frontend call
  try {
    const itemsResult = await query(
      `select content from public.user_memory_items where user_id = $1 and status = 'active'`,
      [userId]
    )
    
    const summary = `Compiled profile with ${itemsResult.rows.length} active facts.`
    
    const upsertResult = await query(
      `insert into public.user_profile (
         user_id, summary_short, summary_long, last_compiled_at, updated_at
       ) values ($1, $2, $2, now(), now())
       on conflict (user_id) do update set
         summary_short = excluded.summary_short,
         summary_long = excluded.summary_long,
         last_compiled_at = excluded.last_compiled_at,
         updated_at = now()
       returning *`,
      [userId, summary]
    )
    
    res.json({
      success: true,
      profile: upsertResult.rows[0]
    })
  } catch (error) {
    console.error('[memory] Failed to compile profile:', error)
    res.status(500).json({ error: 'Falha ao compilar perfil.' })
  }
})

export default router
