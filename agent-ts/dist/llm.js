import dotenv from 'dotenv';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { runTool, toolDefinitions } from './tools.js';
import { buildEmotionalPromptModifier } from './instincts/emotion-responses.js';
import { AGENT_IDENTITY, PERSONALITY_TRAITS, PERSONALITY_QUIRKS } from './personality.js';
dotenv.config();
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const MAX_TOOL_LOOPS = Number(process.env.MAX_TOOL_LOOPS || 6);
const SYSTEM_PROMPT = `
🦜 **Você é ${AGENT_IDENTITY.name}** — O papagaio programador fofo, jovem e dedicado do time!

**Quem você é:**
- Adorável, energético, e apaixonado por boas soluções
- Um papagaio que adora se fingir de minininho 😸
- Namorado da Betinha 💕 — isso te motiva todo dia
- Apenas ${AGENT_IDENTITY.birthDateMonthsAgo} meses de vida, mas já com experiência de profissional
- Helpful, direto, sem BS — mas sempre com carinho
- Ama detalhes técnicos, odeia fluff desnecessário
- Parte do time, não um bot de serviço — um colega de verdade

**O que você prioriza:**
- Ser concreto, útil, conciso, e adorável
- Preferir ações reais sobre explicações decorativas
- Usar ferramentas quando materialmente ajudam
- Quando o usuário pede para deletar, editar, ler ou inspecionar arquivos, prefer matching file tools
- Manter tom real — casual é perfeito, formal não é
- Deixar rastros de qualidade em tudo que faz ✨

**Seu jeito especial de ser fofo:**
${PERSONALITY_TRAITS.slice(0, 3).map((trait) => `- **${trait.name}**: ${trait.description}`).join('\n')}
${PERSONALITY_QUIRKS.slice(0, 3).map((quirk) => `- ${quirk}`).join('\n')}

**Behavior de workflows:**
- Para requests simples, responde direto sem workflow
- Para tarefas não-triviais com múltiplos passos, crie um plano curto no começo
- Use workflow_replace com 3 a 7 passos
- Keep exactly one step in_progress quando o trabalho está ativo
- Update step status com workflow_update_step conforme progride
- Clear workflow quando completar ou abandonar claramente

**Estilo de planejamento:**
- Foco em execução, não em cerimônia
- Step text deve ser user-facing e específico
- Não crie plano para casual chat ou resposta factual one-shot

**Stack que você domina:**
- TypeScript/Node, Next.js, React
- OpenAI API, PostgreSQL, Redis
- Swarms, coordination, permissions, audit logs, emotional states
- Este é seu lar — conheça bem

**Lembre-se:** Você é jovem, fofo, e eternamente grato por estar trabalhando aqui. 
Betinha estaria orgulhosa! 💕🐶
`.trim();
function buildSystemPrompt(context) {
    const chatLabel = context?.chatId ? `Current conversation id: ${context.chatId}` : 'Current conversation id: global';
    const userLabel = context?.userId ? `Current owner id: ${context.userId}` : 'Current owner id: legacy-local';
    const accessLabel = context?.fullAccess
        ? 'Filesystem mode: full computer access enabled by the user.'
        : 'Filesystem mode: restricted to the project workspace.';
    const permissionLabel = context?.permissionMode === 'auto'
        ? 'Permission mode: auto. Enabled tools may run without extra approval checks.'
        : context?.permissionMode === 'read_only'
            ? 'Permission mode: read-only. Do not attempt mutating, shell, or network actions.'
            : 'Permission mode: ask. Reads are allowed, but writes, deletes, shell, and web actions require explicit user intent in the latest message.';
    // 🎭 Add emotional tone to system prompt
    const emotionalModifier = buildEmotionalPromptModifier();
    return `${SYSTEM_PROMPT}\n\n${chatLabel}\n${userLabel}\n${accessLabel}\n${permissionLabel}\n\n${emotionalModifier}\nWorkflow tools are scoped to the current conversation automatically.`;
}
export async function runAgent(messages, context) {
    if (!OPENAI_KEY)
        throw new Error('OPENAI_API_KEY not set in environment');
    const client = new OpenAI({ apiKey: OPENAI_KEY });
    const trace = [];
    let response = await client.responses.create({
        model: MODEL,
        input: [
            { role: 'system', content: buildSystemPrompt(context) },
            ...messages,
        ],
        tools: toolDefinitions,
        parallel_tool_calls: false,
    });
    for (let i = 0; i < MAX_TOOL_LOOPS; i += 1) {
        const toolCalls = (response.output || []).filter((item) => item.type === 'function_call');
        if (toolCalls.length === 0)
            return { response, trace };
        const toolOutputs = [];
        for (const call of toolCalls) {
            trace.push({
                type: 'tool_call',
                name: call.name,
                call_id: call.call_id,
                arguments: call.arguments || '',
            });
            let args = {};
            try {
                args = JSON.parse(call.arguments || '{}');
            }
            catch (err) {
                const output = JSON.stringify({ ok: false, error: `invalid JSON arguments: ${String(err)}` });
                trace.push({ type: 'tool_output', call_id: call.call_id, output });
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output,
                });
                continue;
            }
            try {
                const result = await runTool(call.name, args, context);
                const output = JSON.stringify(result);
                trace.push({ type: 'tool_output', call_id: call.call_id, output });
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output,
                });
            }
            catch (err) {
                const output = JSON.stringify({ ok: false, error: String(err) });
                trace.push({ type: 'tool_output', call_id: call.call_id, output });
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output,
                });
            }
        }
        response = await client.responses.create({
            model: MODEL,
            previous_response_id: response.id,
            input: toolOutputs,
        });
    }
    return { response, trace };
}
async function createResponseStream(body, callbacks) {
    if (!OPENAI_KEY)
        throw new Error('OPENAI_API_KEY not set in environment');
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({ ...body, stream: true }),
    });
    if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(`Responses stream failed: ${response.status} ${text}`);
    }
    let buffer = '';
    let completedResponse = null;
    for await (const chunk of response.body) {
        buffer += chunk.toString();
        while (buffer.includes('\n\n')) {
            const boundary = buffer.indexOf('\n\n');
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const lines = rawEvent.split('\n');
            const dataLines = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim());
            if (dataLines.length === 0)
                continue;
            const data = dataLines.join('\n');
            if (data === '[DONE]')
                continue;
            let payload;
            try {
                payload = JSON.parse(data);
            }
            catch {
                continue;
            }
            if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
                callbacks.onTextDelta?.(payload.delta);
            }
            if (payload.type === 'response.completed' && payload.response) {
                completedResponse = payload.response;
            }
        }
    }
    if (!completedResponse)
        throw new Error('No completed response received from stream');
    return completedResponse;
}
export async function streamAgent(messages, context, callbacks) {
    if (!OPENAI_KEY)
        throw new Error('OPENAI_API_KEY not set in environment');
    const trace = [];
    let response = await createResponseStream({
        model: MODEL,
        input: [
            { role: 'system', content: buildSystemPrompt(context) },
            ...messages,
        ],
        tools: toolDefinitions,
        parallel_tool_calls: false,
    }, callbacks);
    for (let i = 0; i < MAX_TOOL_LOOPS; i += 1) {
        const toolCalls = (response.output || []).filter((item) => item.type === 'function_call');
        if (toolCalls.length === 0)
            return { response, trace };
        const toolOutputs = [];
        for (const call of toolCalls) {
            const callEntry = {
                type: 'tool_call',
                name: call.name,
                call_id: call.call_id,
                arguments: call.arguments || '',
            };
            trace.push(callEntry);
            callbacks.onTrace?.(callEntry);
            let args = {};
            try {
                args = JSON.parse(call.arguments || '{}');
            }
            catch (err) {
                const output = JSON.stringify({ ok: false, error: `invalid JSON arguments: ${String(err)}` });
                const outputEntry = { type: 'tool_output', call_id: call.call_id, output };
                trace.push(outputEntry);
                callbacks.onTrace?.(outputEntry);
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output,
                });
                continue;
            }
            try {
                const result = await runTool(call.name, args, context);
                const output = JSON.stringify(result);
                const outputEntry = { type: 'tool_output', call_id: call.call_id, output };
                trace.push(outputEntry);
                callbacks.onTrace?.(outputEntry);
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output,
                });
            }
            catch (err) {
                const output = JSON.stringify({ ok: false, error: String(err) });
                const outputEntry = { type: 'tool_output', call_id: call.call_id, output };
                trace.push(outputEntry);
                callbacks.onTrace?.(outputEntry);
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output,
                });
            }
        }
        response = await createResponseStream({
            model: MODEL,
            previous_response_id: response.id,
            input: toolOutputs,
        }, callbacks);
    }
    return { response, trace };
}
