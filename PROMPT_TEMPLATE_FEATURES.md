# PROMPT TEMPLATE - Use em outro chat

Copie e cole um dos prompts abaixo conforme o que quiser implementar:

---

## ARTIFACT PANEL IMPLEMENTATION

```text
Você é um expert em UI/UX e React. Quero implementar um painel de Artifacts similar ao Claude/ChatGPT.

Contexto:
- Next.js 16 app, TypeScript, Tailwind CSS
- Stack: React + Next.js 16 + TypeScript + Tailwind
- Tenho um sistema de chat com mensagens
- Utilizo streaming de OpenAI API
- Tema: dark mode (slate colors: slate-700, slate-800, slate-900)

Objetivo:
Criar um componente que mostra long-form responses (código, markdown, documentos) em um painel lado a lado com o chat.

Requisitos:
1. Detectar quando OpenAI retorna artifact (código, markdown, JSON, HTML)
2. Renderizar em painel separado com:
   - Syntax highlighting (código)
   - Markdown parsing e renderização
   - Copy to clipboard button
   - Expand/fullscreen action
   - Close button
3. Integrar com o componente atual `MessageBubble`
4. Manter consistência com o dark theme

O que preciso de você:
1. Código completo do `ArtifactPanel.tsx`
2. Lógica de detecção de artifacts (`artifactDetection.ts`)
3. Styles/CSS para o painel e animações
4. Instruções de integração com `MessageBubble`
5. Exemplos de uso

Arquivos do projeto: [AQUI VOCÊ COLA O CONTEÚDO DO ARQUIVO]
```

---

## WEB SEARCH INTEGRATION

```text
Quero adicionar web search em um sistema de chat com multi-agent coordination.

Contexto:
- Backend: Express.js (porta 3001), TypeScript
- Frontend: Next.js 16 com OpenAI API streaming
- Sistema de tools: agentes chamam tools via function_calling (`tool_use`)
- Tenho `chat-tools.ts` com definição de tools disponíveis

Objetivo:
Implementar uma tool de web search que:
1. Permita que agentes busquem informações atualizadas
2. Retorne resultados com citations (source, URL, snippet)
3. Tenha rate limiting (máx X requests/dia por usuário)
4. Tenha cache de resultados (TTL de 30 min)
5. Só busque se `WEB_FETCH_ALLOWLIST=true` no `.env`

Requisitos técnicos:
- Use SerpAPI ou Google Custom Search API
- Retornar: `[{ title, url, snippet, date }]`
- Integrar com o sistema existente de token/cost tracking
- Exibir sources no chat como footnotes

O que preciso:
1. Tool definition completa (parâmetros, description)
2. Handler function (`web_search`)
3. Variáveis necessárias no `.env`
4. Lógica de cache + rate limit
5. Exemplo de uso no chat

Roadmap: [COLA O CONTEÚDO DO ARQUIVO]
```

---

## CODE BLOCK ACTIONS (COPY + RUN)

```text
Vou implementar botões em code blocks: Copy, Create File, Run

Contexto:
- Next.js 16 + TypeScript + Tailwind
- O componente `MessageBubble` renderiza código
- Tema dark (slate-800, slate-900)
- O backend tem ability de executar bash, node e python

Objetivo:
Adicionar 3 botões em code blocks:
1. Copy -> copiar código para o clipboard (com toast "Copied!")
2. Create File -> salvar código como novo arquivo na workspace
3. Run -> executar código (detecta linguagem) e mostrar output

Requisitos:
- Ícones do Lucide React
- Toast notifications (sucesso/erro)
- Auto-detect de linguagem (js, ts, py, bash etc.)
- Create file: pedir path ao usuário (modal ou input)
- Run: mostrar output inline + stderr em vermelho
- Loading state durante a execução

O que preciso:
1. Componente `CodeBlock.tsx` com esses botões
2. `codeActions.ts` com lógica (`copy`, `create`, `run`)
3. API endpoint para executar código (`/api/code/execute`)
4. CSS/animações para os botões
5. Error handling + user feedback

Roadmap: [COLA O CONTEÚDO DO ARQUIVO]
```

---

## COMMAND PALETTE

```text
Quero implementar Command Palette estilo VS Code + GitHub Copilot.

Contexto:
- Next.js 16, TypeScript, Tailwind
- Tenho `CommandAutocomplete` para slash commands já
- Sistema de tools implementado
- Usuários chamam ferramentas via chat ou menu

Objetivo:
Global hotkey (`Cmd+K` / `Ctrl+K`) abre modal com:
1. Search box (filter tools)
2. Categorias: Chat, Files, Coordination, Memory etc.
3. Recent actions (MRU)
4. Keyboard nav: ↑ ↓ para navegar, Enter para executar, Esc para fechar
5. Executar a ação sem digitar comando no chat

Requisitos:
- Ouvir `Cmd/Ctrl+K` globalmente
- Lista pesquisável de tools
- Ícones + descriptions
- Preview do que vai fazer
- Dark theme + animações

O que preciso:
1. `CommandPalette.tsx` (modal component)
2. `useCommandPalette()` hook
3. `hotkeyListener.ts` (global event)
4. CSS com animações (`slideDown`, blur background)
5. Integração com chat context

Roadmap: [COLA O CONTEÚDO DO ARQUIVO]
```

---

## CONVERSATION SEARCH & EXPORT

```text
Preciso de search + export para histórico de conversas.

Contexto:
- Next.js chat app, backend PostgreSQL (`conversations` table)
- TypeScript, Tailwind CSS

Objetivo:
1. Search Panel: filtro por keywords, date range e agente
2. Export: formatos Markdown, PDF e JSON
3. Share link (gerar conversas públicas opcionais)

O que preciso:
1. `SearchPanel.tsx` component
2. Backend search API
3. Export logic (Markdown, geração de PDF)
4. UI de filtros

Roadmap: [COLA O CONTEÚDO DO ARQUIVO]
```

---

## SMART CONVERSATION TITLES

```text
Quero auto-renomear conversas baseado no contexto da 1ª mensagem.

Objetivo:
- Primeira mensagem -> OpenAI gera título resumido (5-8 palavras)
- Armazena em BD
- Atualiza na sidebar automaticamente

Requisitos:
- Chamada rápida (não bloqueia o chat)
- Detectar tema: código, bug fix, explicação etc.
- Prefixo opcional por categoria (ex.: bug, ideia, documentação)

O que preciso:
- `titleGeneration.ts` com função `generateTitle()`
- API endpoint
- Integração com conversation creation

Roadmap: [COLA O CONTEÚDO DO ARQUIVO]
```

---

## Como usar esses prompts

1. Escolha qual feature quer implementar (ex.: Artifact Panel)
2. Copie o prompt correspondente
3. Em outro chat (Claude, ChatGPT etc.):
   - Cole o prompt
   - Onde diz `[AQUI VOCÊ COLA O CONTEÚDO DO ARQUIVO]`, cole o arquivo `IMPLEMENTATION_ROADMAP.md`
   - Opcionalmente, cole também arquivos existentes (`chat-tools.ts`, `AppShell.tsx` etc.)
4. Aguarde instruções detalhadas do chat para aquela feature

---

## Pro Tips

- Use o prompt com o modelo de sua preferência (Claude Sonnet costuma funcionar muito bem)
- Sempre inclua contexto do projeto, requisitos e stack
- Colar o arquivo `IMPLEMENTATION_ROADMAP.md` dá contexto completo
- Se tiver dúvidas sobre a implementação, cole também o arquivo atual que você quer modificar

---

**Última atualização**: April 13, 2026
