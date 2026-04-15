# PROMPT COMPLETO - IMPLEMENTAR TUDO

Copie e cole este prompt completo em outro chat (Claude Sonnet recomendado):

---

```text
Você é um expert em React, Next.js, TypeScript, TailwindCSS e sistemas complexos.

## CONTEXTO DO PROJETO

Stack:
- Frontend: Next.js 16.2.2, TypeScript, React, TailwindCSS dark theme (slate colors)
- Backend: Express.js (porta 3001), PostgreSQL, Redis
- API: OpenAI streaming (`gpt-4-mini`), function_calling (`tool_use`)
- Sistema de Tools: `chat-tools.ts` com tool definitions e handlers
- UI Components: `MessageBubble`, `AppShell`, `CommandAutocomplete` (já existe)

Arquivos principais existentes:
- `app/lib/server/chat-tools.ts` (define todas as tools)
- `app/api/chat/stream/route.ts` (streaming endpoint com OpenAI)
- `app/components/AppShell.tsx` (shell principal)
- `app/components/MessageBubble.tsx` (renderiza mensagens + código)
- `app/styles/components.css` (styles globais)
- `agent-ts/src/server.ts` (backend Express)

## ROADMAP COMPLETO

[COLE AQUI TODO O CONTEÚDO DO ARQUIVO IMPLEMENTATION_ROADMAP.md]

## MISSÃO: IMPLEMENTAR 4 HIGH PRIORITY FEATURES

Você deve implementar tudo de uma vez (4 features):

### 1. ARTIFACT PANEL
Long-form output em um side panel separado para código, markdown, JSON e HTML.
- Detectar artifacts automaticamente
- Botões de copy, expand e fullscreen
- Syntax highlighting
- Consistência com dark theme
- Layout side-by-side com o chat

### 2. WEB SEARCH INTEGRATION
Agentes conseguem buscar web em tempo real.
- Nova tool: `web_search()`
- Rate limiting + caching (TTL de 30 min)
- Display de sources/citations
- Integração com o sistema atual de tools
- Permission gate (`WEB_FETCH_ALLOWLIST` no `.env`)

### 3. CODE BLOCK ACTIONS
Botões em code blocks: Copy, Create File, Run
- Copy to clipboard
- Create File -> salvar na workspace com modal/input de path
- Run -> executar código com auto-detect de linguagem + mostrar output
- Loading states + error handling
- Toast notifications

### 4. COMMAND PALETTE (Cmd/Ctrl+K)
Modal global com busca de tools/actions
- Global hotkey listener
- Lista pesquisável de comandos
- Categorias: Chat, Files, Coordination, Memory etc.
- Recent actions (MRU)
- Keyboard nav: ↑ ↓ Enter Esc
- Executar ação sem precisar digitar no chat

## DELIVERABLES

Para cada feature, forneça:

### 1. Artifact Panel
- [ ] `app/components/ArtifactPanel.tsx` (component completo)
- [ ] `app/lib/artifactDetection.ts` (lógica de detecção)
- [ ] `app/styles/artifacts.css` (styles + animações)
- [ ] Modificações em `app/components/MessageBubble.tsx` (integração)
- [ ] Instruções de integração com o chat stream

### 2. Web Search
- [ ] `app/lib/server/search-tools.ts` (tool definition + handler)
- [ ] Modificações em `app/lib/server/chat-tools.ts` (adicionar tool)
- [ ] `app/api/search/route.ts` (search endpoint)
- [ ] Variáveis novas de `.env` (`SEARCH_API_KEY` etc.)
- [ ] Lógica de cache + rate limit
- [ ] Componente de display para citations/sources

### 3. Code Block Actions
- [ ] Modificações em `app/components/MessageBubble.tsx` (adicionar botões)
- [ ] `app/lib/codeActions.ts` (lógica de `copy`, `create`, `run`)
- [ ] `app/api/code/execute/route.ts` (endpoint de execução)
- [ ] `app/components/CodeOutput.tsx` (display do output)
- [ ] `app/styles/code-block.css` (styles dos botões)
- [ ] Helper de toast notifications

### 4. Command Palette
- [ ] `app/components/CommandPalette.tsx` (modal component)
- [ ] `app/hooks/useCommandPalette.ts` (hook)
- [ ] `app/utils/hotkeyListener.ts` (listener de `Cmd/Ctrl+K`)
- [ ] `app/styles/command-palette.css` (modal + animações)
- [ ] Integração com `app/components/AppShell.tsx`
- [ ] Lógica de categorização de tools

## INSTRUÇÕES DE IMPLEMENTAÇÃO

1. Comece pelo contexto: leia o roadmap
2. Ordem de implementação:
   - Artifact Panel (não depende dos outros)
   - Web Search (independente, mas estende tools)
   - Code Block Actions (depende de artifacts estarem ok)
   - Command Palette (integra tudo)

3. Tech requirements:
   - Use ícones do Lucide React (`copy`, `file`, `play`, `search`, `command` etc.)
   - Dark theme: `slate-700`, `slate-800`, `slate-900` e accent colors
   - Animações suaves, sem jank
   - TypeScript forte, sem `any`
   - Error handling com mensagens user-friendly

4. Testing checklist:
   - [ ] Artifacts detectam corretamente (código, markdown, JSON)
   - [ ] Copy button funciona
   - [ ] Web search retorna resultados (mock se não houver API)
   - [ ] Code execution mostra output
   - [ ] Command Palette abre com `Cmd+K` e filtra

5. Dependências para verificar:
   - `lucide-react` (ícones)
   - `react-markdown` (renderização de markdown)
   - `prismjs` ou `react-syntax-highlighter` (syntax highlighting)
   - Para search: SerpAPI, Google Custom Search ou mock data

## FORMATO DE ENTREGA

Para cada arquivo, forneça:
1. Caminho completo: `app/components/ArtifactPanel.tsx`
2. Código completo + comentários
3. Imports necessários
4. Como integrar (instruções claras)
5. Exemplo de uso

Se houver mudanças no `.env`, liste as variáveis novas.

## EXTRA REQUIREMENTS

- [ ] Código production-ready (sem `console.log` deixado)
- [ ] Responsivo: funciona em mobile (artifact panel pode virar drawer)
- [ ] Performance: lazy load components, cache onde fizer sentido
- [ ] Acessibilidade: ARIA labels, keyboard navigation
- [ ] Dark mode only (mantenha consistência com o tema atual)
- [ ] Integração com o styling existente (`app/styles/components.css`)

## COMECE AGORA

1. Confirme que entendeu o contexto (roadmap + stack)
2. Implemente todas as 4 features
3. Forneça todos os arquivos completos
4. Inclua instruções step-by-step de integração

Estou pronto para receber e colar seu código.
```

---

## INSTRUÇÕES DE USO

1. Copie o prompt acima (tudo entre ```text e ```)
2. Em outro chat, cole o prompt
3. Logo após colar, você verá:

```text
[COLE AQUI TODO O CONTEÚDO DO ARQUIVO IMPLEMENTATION_ROADMAP.md]
```

4. Substitua essa linha pelo conteúdo completo do arquivo `IMPLEMENTATION_ROADMAP.md`
5. Envie o prompt e aguarde a implementação completa

---

## CHECKLIST PRÉ-ENVIO

- [ ] Copiei o prompt
- [ ] Colei em outro chat
- [ ] Substituí `[COLE AQUI...]` pelo conteúdo de `IMPLEMENTATION_ROADMAP.md`
- [ ] Enviei o prompt

Depois que receber o código, você terá tudo pronto para colar no projeto.

---

**Estimativa**: 30-40 minutos de processamento para gerar tudo  
**Modelo recomendado**: Claude Sonnet (melhor custo-benefício)  
**Alternativas**: GPT-4 Turbo ou outro modelo forte de coding
