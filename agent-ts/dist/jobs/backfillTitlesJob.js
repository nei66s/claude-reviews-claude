import dotenv from 'dotenv';
import OpenAI from 'openai';
import { query } from '../db.js';
dotenv.config();
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_TRIAGE_MODEL || 'gpt-4o-mini';
export async function runBackfillTitlesJob() {
    if (!OPENAI_KEY) {
        console.error('[BackfillTitlesJob] OPENAI_API_KEY not set. Cannot backfill titles.');
        return;
    }
    const client = new OpenAI({ apiKey: OPENAI_KEY });
    try {
        // 1. Encontrar conversas com título genérico
        const result = await query(`SELECT id, title FROM conversations 
       WHERE title = 'Nova conversa' OR title = 'Conversa' OR title ILIKE 'Nova conversa%'
       ORDER BY created_at DESC LIMIT 50`);
        const conversations = result.rows;
        if (conversations.length === 0) {
            console.log('[BackfillTitlesJob] Nenhuma conversa pendente de atualização de título.');
            return;
        }
        console.log(`[BackfillTitlesJob] Encontradas ${conversations.length} conversas para atualizar o título.`);
        for (const conv of conversations) {
            // Pega a primeira mensagem do usuário ou do agente
            const messagesResult = await query(`SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY sort_order ASC LIMIT 3`, [conv.id]);
            if (messagesResult.rows.length === 0)
                continue;
            const chatHistory = messagesResult.rows
                .map(m => `${m.role.toUpperCase()}: ${m.content}`)
                .join('\n');
            const prompt = `Você é um gerador de títulos curtos e concisos para conversas de chat.
Baseado no início da conversa abaixo, gere um título curto (máximo de 4-5 palavras) que resuma o assunto principal.
Não use aspas no começo ou no final do título.

Conversa:
${chatHistory}

Responda APENAS com o título sugerido.`.trim();
            try {
                const response = await client.chat.completions.create({
                    model: MODEL,
                    messages: [{ role: 'system', content: prompt }],
                    max_tokens: 15,
                    temperature: 0,
                });
                let newTitle = response.choices[0]?.message?.content?.trim();
                if (newTitle) {
                    // Limpa possíveis aspas residuais
                    newTitle = newTitle.replace(/^["']|["']$/g, '');
                    await query(`UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2`, [newTitle, conv.id]);
                    console.log(`[BackfillTitlesJob] Conversa ${conv.id} atualizada: "${newTitle}"`);
                }
            }
            catch (err) {
                console.error(`[BackfillTitlesJob] Falha ao gerar título para a conversa ${conv.id}:`, err);
            }
        }
    }
    catch (err) {
        console.error('[BackfillTitlesJob] Erro fatal durante a execução:', err);
    }
}
// Se o script for chamado diretamente, executa o job
