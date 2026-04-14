# 🚀 Chocks - Implementation Roadmap

Data: April 13, 2026  
Status: In Development

---

## 📋 Overview

Sistema de multi-agent coordination com UI moderna, slash commands e integração com OpenAI API.

**Stack**: Next.js 16 + Express (TypeScript) + PostgreSQL + Redis

---

## ✅ IMPLEMENTED FEATURES

### Phase 1: Core Chat + Tools ✅
- ✅ Chat streaming com OpenAI
- ✅ File system tools (read, write, create, delete, move, copy)
- ✅ Memory management (Obsidian vault integration)
- ✅ Workflow system (steps, status tracking)
- ✅ PDF report generation

### Phase 2: Coordination System ✅
- ✅ Multi-agent teams (coordination/spawner)
- ✅ Worker agents with roles (researcher, implementer, tester)
- ✅ Message mailbox system (inter-agent communication)
- ✅ Team CRUD endpoints
- ✅ Coordination Dashboard (Teams, Workflows, Errors tabs)

### Phase 3: Slash Commands ✅
- ✅ `/create-agents` - Spawn coordination teams
- ✅ `/create-workflow` - Assign tasks to teams
- ✅ Command autocomplete menu (↑↓ navigation, filtering)
- ✅ 8 default commands (create, explain, fix, new, search, plan, test)

### Phase 4: Visual Improvements ✅
- ✅ Coordination Dashboard visual fix (responsive grid)
- ✅ Dark theme consistency
- ✅ Command autocomplete dropdown

---

## 🔥 HIGH PRIORITY FEATURES (To Implement)

### 1. **Artifacts / Inline Output Panels** 🌟
**Description**: Long-form respostas em painel separado (lado a lado com chat)  
**Similar to**: Claude, ChatGPT artifacts  
**Why**: Melhor experiência com código gerado, documentos, relatórios  
**Effort**: Medium (5-6 hours)

**What to build**:
- ✓ ArtifactPanel component
- ✓ Detect artifact types (code, markdown, json, html)
- ✓ Copy button, expand, fullscreen actions
- ✓ Syntax highlighting with language detection
- ✓ Integration with PDF reports

**Files to create/modify**:
- `app/components/ArtifactPanel.tsx` (NEW)
- `app/components/MessageBubble.tsx` (MODIFY - add artifact detection)
- `app/styles/artifacts.css` (NEW)
- `app/lib/artifactDetection.ts` (NEW)

---

### 2. **Web Search Real-time (Live Data)** 🌍
**Description**: Agentes podem buscar informações atualizadas da web  
**Similar to**: ChatGPT web search, Claude web access  
**Why**: Respostas com dados atuais, não dependem de treinamento  
**Effort**: Hard (8-10 hours - requer API setup)

**What to build**:
- ✓ Web search tool (use SerpAPI ou Google Custom Search)
- ✓ Limit queries (budget control like token system)
- ✓ Cache resultados (30min TTL)
- ✓ Display search sources/citations
- ✓ Permission check (WEB_FETCH_ALLOWLIST)

**Files to create/modify**:
- `app/lib/server/search-tools.ts` (NEW)
- `app/lib/server/chat-tools.ts` (MODIFY - add web_search tool)
- `app/api/search/route.ts` (NEW)
- `.env` (ADD: SEARCH_ENGINE_API_KEY, SEARCH_ENGINE_ID)

---

### 3. **Code Block Copy + Run Buttons** 💻
**Description**: Buttons em code blocks (Copy, Create File, Run)  
**Similar to**: GitHub Copilot, ChatGPT  
**Why**: Acelera workflow de developers  
**Effort**: Easy (2-3 hours)

**What to build**:
- ✓ Copy to clipboard button
- ✓ "Create File" button → auto-create na workspace
- ✓ "Run" button → detecta linguagem e executa (bash, node, python)
- ✓ Icons + hover effects
- ✓ Toast notifications (copied, created, executed)

**Files to create/modify**:
- `app/components/CodeBlock.tsx` (NEW or MODIFY)
- `app/lib/codeActions.ts` (NEW - copy, create, run logic)
- `app/api/code/execute/route.ts` (NEW - run code endpoint)
- `app/styles/code-block.css` (NEW)

---

### 4. **Quick Actions Command Menu** ⌘K
**Description**: Modal com quick actions (Cmd/Ctrl+K → filter + execute)  
**Similar to**: VS Code command palette, GitHub Copilot  
**Why**: Descoberta de features, UX melhorada  
**Effort**: Medium (4-5 hours)

**What to build**:
- ✓ Global hotkey listener (Cmd+K / Ctrl+K)
- ✓ Modal com searchable list de todas as tools
- ✓ Categorias (Chat, Files, Coordination, Memory, etc)
- ✓ Recent actions (MRU list)
- ✓ Keyboard navigation (↑↓ filtering, Esc close)
- ✓ Execute ação ao selecionar

**Files to create/modify**:
- `app/components/CommandPalette.tsx` (NEW)
- `app/hooks/useCommandPalette.ts` (NEW)
- `app/utils/hotkeyListener.ts` (NEW)
- `app/styles/command-palette.css` (NEW)

---

## 💎 MEDIUM PRIORITY FEATURES

### 5. **Conversation Search & Export** 🔍
**Description**: Buscar no histórico, export a Markdown/PDF  
**Files**: 
- `app/components/SearchPanel.tsx`
- `app/api/conversations/search/route.ts`
- `app/api/conversations/export/route.ts`

---

### 6. **Smart Conversation Titles** 📝
**Description**: Auto-rename chat baseado em contexto (1ª mensagem)  
**Files**:
- `app/lib/server/titleGeneration.ts`
- `app/api/conversations/auto-title/route.ts`

---

### 7. **Code Block Run with Output Display** ▶️
**Description**: Execute código e mostra stdout/stderr inline  
**Files**:
- `app/components/CodeOutput.tsx`
- `app/api/code/execute/route.ts` (ENHANCE)

---

### 8. **Message Reactions & Favorites** ⭐
**Description**: React com emojis, star messages  
**Files**:
- Database schema: messages table → add `reactions`, `starred`
- `app/components/MessageReactions.tsx`
- `app/api/messages/react/route.ts`

---

## 🎯 QUICK WINS (Easy + High Value)

### Theme Toggle Dark/Light 🌓
- ✅ Add toggle button in Topbar
- ✅ Store preference in localStorage
- Duration: 1 hour

### Keyboard Shortcuts Cheat Sheet ⌨️
- Modal com atalhos (Cmd+? para abrir)
- `Cmd+K` = Command palette
- `Cmd+Enter` = Send message
- `Cmd+Shift+N` = New chat
- Duration: 1 hour

### Copy Chat Button 📋
- Copiar conversation thread para clipboard
- Duration: 30 min

---

## 📊 ESTIMATED TIMELINE

| Prioridade | Feature | Esforço | Timeline |
|------------|---------|--------|----------|
| 🔥 High | Artifacts Panel | 5-6h | Week 1 |
| 🔥 High | Web Search | 8-10h | Week 1-2 |
| 🔥 High | Code Block Actions | 2-3h | Week 1 |
| 🔥 High | Command Palette | 4-5h | Week 1 |
| 💎 Medium | Search & Export | 3-4h | Week 2 |
| 💎 Medium | Auto Titles | 2h | Week 2 |
| 💎 Medium | Message Reactions | 3h | Week 2 |
| 🎯 Quick | Theme Toggle | 1h | Any |
| 🎯 Quick | Keyboard Shortcuts | 1h | Any |

**Total Estimated**: 29-34 hours of development

---

## 🔗 Dependencies

### External APIs (if implementing Web Search)
- SerpAPI: $5-50/month (100-300k searches)
- Google Custom Search: $0.50/1000 queries
- Bing Search API: ~$7/month starter

### Database Schema Updates
- `messages` table: add `artifact_type`, `artifact_content` columns
- `conversations` table: add `search_queries`, `web_sources` columns
- `code_executions` table: NEW (track executed code + output)

---

## 🚦 NEXT STEPS

1. **Choose priority feature** from HIGH PRIORITY list
2. **Review architecture impact** (check if needs backend changes)
3. **Create feature branch** (`feature/artifacts`, `feature/web-search`, etc)
4. **Implement + Test** (unit tests, integration tests)
5. **Deploy to staging** and validate

---

## 📝 Notes

- Todas as features mantêm o padrão visual (dark theme + slate colors)
- Respeitar performance (lazy load artifacts, cache search results)
- Adicionar rate limiting para web search e code execution
- Testar em mobile (alguns features podem ser desktop-only no início)

---

**Questions?** Consulte o chat ou a documentação em `/docs/project/`
