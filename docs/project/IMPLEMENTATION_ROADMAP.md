# Chocks — Implementation Roadmap (Full Architecture)

**Goal**: Implementar tudo da arquitetura do Claude Code, adaptado para uso corporativo com poucas pessoas.

---

## Fases de Implementação

### **Fase 1: MVP Funcional + UI Polida** (2-3 semanas)
*Status atual*: ~60% completo

**Objetivos**:
- ✅ File preview & editor
- ✅ File actions (copy, duplicate, create, delete)
- ✅ Workflow operacional (reset, archive, resume, edit steps)
- ✅ Permissions UX básica (ask/auto/read_only)
- ✅ Chat com sugestões funcionais
- ✅ Build estável + no regressions

**Arquivos-chave a completar**:
- `src/server.ts` — adicionar `/workflow/update-step` endpoint
- `src/tools.ts` — file_move, file_rename handlers
- `public/index.html` — polish final, acessibilidade AA

**Saída**: Chatbot pronto para operação básica com permissões simples.

---

### **Fase 2: Permission Pipeline + Hook System** (3-4 semanas)
*Valor*: 10x mais poder de controle

**Objetivos**:
- Implementar 7-step permission gauntlet
- Deny/ask/allow rules por ferramentaou caminho
- Hook System básico (20 eventos)
- Content-aware permission checks
- Audit logging

**Arquivos novos**:
- `src/permissions/pipeline.ts` — 7-step gauntlet
- `src/permissions/rules.ts` — deny/ask/allow rule engine
- `src/hooks/index.ts` — hook registry + dispatch
- `src/hooks/events.ts` — 20 event types
- `src/audit/logger.ts` — audit trail

**Saída**: Controle fino de quem pode fazer o quê, quando e com quais caminhos.

---

### **Fase 3: Bash Security (AST + Sandbox)** (2-3 semanas)
*Valor*: Executar comandos shell com segurança

**Objetivos**:
- Parse AST de comandos bash (tree-sitter)
- Classificação de comandos (read-only, destructive, etc)
- Sandbox com bubblewrap (Linux) / seatbelt (macOS)
- Safe sed edit preview
- Command history + replay

**Arquivos novos**:
- `src/bash/ast.ts` — bash AST parsing
- `src/bash/classifier.ts` — command classification
- `src/bash/sandbox.ts` — sandbox adapter
- `src/bash/sedParser.ts` — sed -i simulation
- `src/bash/engine.ts` — full bash execution

**Saída**: Executar qualquer comando shell com sandbox automático e aprovação granular.

---

### **Fase 4: Plugin System Simplificado** (3-4 semanas)
*Valor*: Estender capacidades sem tocar o core

**Objetivos**:
- Plugin manifest (JSON schema)
- Plugin loader + hot-reload
- Plugin types: tools, hooks, skills, agents
- Dependency resolution
- Plugin storage (Postgres)

**Arquivos novos**:
- `src/plugins/manifest.ts` — schema + validation
- `src/plugins/loader.ts` — dynamic loading
- `src/plugins/registry.ts` — plugin lifecycle
- `src/plugins/storage.ts` — DB persistence

**Saída**: Poder adicionar novos agentes, tools, hooks via plugins.

---

### **Fase 5: QueryEngine Sofisticado** (2-3 semanas)
*Valor*: Contexto eficiente, custo otimizado

**Objetivos**:
- Auto-compactação de conversa (resumo inteligente)
- Token budgeting por conversa/usuário
- File content caching (LRU)
- Streaming aprimorado
- Cost tracking

**Arquivos novos**:
- `src/engine/compaction.ts` — resumo automático
- `src/engine/budgeting.ts` — token + cost limits
- `src/engine/cache.ts` — file content LRU
- `src/engine/streaming.ts` — improved streaming

**Saída**: Conversas longas eficientes, custo controlado.

---

### **Fase 6: Coordinator Mode** (3-4 semanas)
*Valor*: Multi-agent orchestration

**Objetivos**:
- Coordinator agent (dispatcher)
- Worker agents (specialistas)
- Message routing entre agents
- Task decomposition
- Result synthesis

**Arquivos novos**:
- `src/coordinator/index.ts` — coordinator logic
- `src/coordinator/workers.ts` — worker pool
- `src/coordinator/routing.ts` — message routing
- `src/coordinator/tasks.ts` — task decomposition

**Saída**: Um coordinator que delega trabalho para múltiplos workers especializados.

---

## Timeline Realista

```
Mar 2026  |████████ Fase 1 (MVP)
          |████████████ Fase 2 (Permissions + Hooks)
Abr 2026  |████████ Fase 3 (Bash Security)
          |████████████ Fase 4 (Plugins)
Mai 2026  |████████ Fase 5 (QueryEngine)
          |████████████ Fase 6 (Coordinator)
```

**Total**: ~4-5 meses para feature-complete.

---

## Prioridades de Implementação

1. **Crítica** (para MVP funcional):
   - Fase 1 completa
   - Permission Pipeline básica (Fase 2)
   
2. **Alta** (próximos meses):
   - Hook System (Fase 2)
   - Bash Security (Fase 3)
   
3. **Média** (roadmap 6+ meses):
   - Plugin System
   - QueryEngine
   
4. **Futura** (nice-to-have):
   - Coordinator Mode
   - MCP integration

---

## Métricas de Sucesso

- ✅ Zero regressions após cada fase
- ✅ Build + tests passando
- ✅ Documentação atualizada
- ✅ Funcionários podem usar dia 1
- ✅ Extensibilidade clara (hooks + plugins)

