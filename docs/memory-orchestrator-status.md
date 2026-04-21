# Memory Orchestrator — Status e Roadmap

## Objetivo
Construir um sistema de memória centrada no usuário, não no agente.

## Princípios
1. A memória pertence ao usuário.
2. Agentes não possuem memória persistente própria.
3. Agentes apenas consomem contexto montado a partir da memória do usuário.
4. Apenas o Memory Orchestrator escreve na memória oficial.
5. Histórico bruto, memória atômica, perfil consolidado e auditoria são camadas separadas.
6. Inferência não sobrescreve fato declarado.
7. O sistema evolui por fases, com escopo incremental e controlado.

---

## Arquitetura base

### Camadas
1. Histórico bruto
- conversas e mensagens
- usado para persistência, auditoria e origem

2. Memória atômica
- itens pequenos e rastreáveis
- exemplos: nome, preferência, objetivo

3. Perfil consolidado
- síntese recompilada do usuário
- exemplos: `summaryShort`, `keyFacts`, `activeGoals`, `interactionPreferences`

4. Context pack
- recorte contextual para o chat/agente
- usado no read path

5. Auditoria
- trilha de promoção, edição, contradição, arquivamento e deleção

---

## Modelo de dados implementado

### Tabelas principais
- `user_memory_items`
- `user_profile`
- `memory_audit_log`

### Tipos de memória suportados
- `declared_fact`
- `preference`
- `goal`
- `constraint`
- `interaction_style`
- `inferred_trait`

### Status suportados
- `candidate`
- `active`
- `archived`
- `contradicted`
- `deleted`

### Sensibilidade
- `low`
- `medium`
- `high`
- `blocked`

---

## Serviços implementados

### Repository
Responsável por:
- listar memory items
- buscar profile
- upsert profile
- inserir e atualizar itens
- inserir auditoria
- utilitários de acesso ao schema

### Reconciler
Responsável por:
- dedupe simples
- promoção para `active`
- bloqueio/contradição simples
- prioridade entre tipos
- impedir inferência de sobrescrever fatos declarados

### Profile Compiler
Responsável por:
- recompilar `user_profile` a partir de itens ativos
- preencher:
  - `summaryShort`
  - `summaryLong`
  - `keyFacts`
  - `activeGoals`
  - `knownConstraints`
  - `interactionPreferences`
  - `recurringTopics`

### Context Builder
Responsável por:
- montar context pack enxuto a partir do usuário
- devolver:
  - `summaryShort`
  - `keyFacts`
  - `activeGoals`
  - `knownConstraints`
  - `interactionPreferences`
  - poucos `memoryItems` ativos

### Orchestrator
Responsável por:
- receber candidatos
- reconciliar
- persistir
- auditar
- recompilar perfil
- receber mudanças manuais também

---

## Endpoints internos existentes

### Leitura
- `GET /api/memory/users/[id]/profile`
- `GET /api/memory/users/[id]/items`
- `GET /api/memory/users/[id]/audit`

### Escrita/operação
- `POST /api/memory/orchestrate`
- `POST /api/memory/profile/compile`
- `POST /api/memory/context/build`
- `PATCH /api/memory/users/[id]/items/[itemId]`

### Teste interno
- `POST /api/memory/_test/run`

---

## UI existente

### Página interna
- `/memory-admin`

### O que ela já faz
- mostrar `user_profile`
- listar `user_memory_items`
- filtrar por status e tipo
- editar item
- marcar como incorreto
- arquivar
- remover (soft delete)
- mostrar auditoria
- mostrar sinais de qualidade
- mostrar bloco de prontidão para Fase 2

### Bloco de prontidão para Fase 2
Mostra:
- capturas automáticas
- correções manuais
- dias corridos
- estado:
  - cedo demais
  - quase pronto para fase 2
  - pronto para fase 2

---

## Captura automática já implementada

### Local de integração
- `app/api/chat/stream/route.ts`

### Comportamento atual
- após persistir a resposta do chat
- chama extractor determinístico
- chama orchestrator
- roda por feature flag
- não bloqueia a resposta do chat
- registra log
- usa `source_message_id` quando disponível

### Flag de captura
- `ENABLE_MEMORY_ORCHESTRATOR=true`

### Extractor atual
Determinístico, sem LLM.
Detecta:
- `declared_fact`
- `preference`
- `goal`
- `interaction_style`

### Limitações atuais da captura
- heurística simples
- rate-limit ainda process-local
- sem governança persistente no banco
- sem extractor semântico sofisticado

---

## Leitura de memória no chat já implementada

### Local de integração
- `app/api/chat/stream/route.ts`

### Como funciona
- antes de montar as `instructions` do modelo
- chama `buildContextPack(...)`
- injeta um bloco pequeno de memória no prompt/contexto do modelo

### O que entra no contexto
- `summaryShort`
- `keyFacts`
- `activeGoals`
- `interactionPreferences`
- poucos itens ativos
- apenas itens de sensibilidade `low` ou `medium`

### Flag de leitura
- `ENABLE_MEMORY_CONTEXT_READ=true`

### Fallback
- se falhar, o chat continua normalmente
- erro é logado
- contexto de memória fica vazio

---

## O que já foi validado funcionalmente

### Validado ponta a ponta
1. Captura automática de `declared_fact`
   - exemplo: nome do usuário

2. Captura automática de `preference`
   - exemplo: respostas curtas e diretas

3. Captura automática de `goal`
   - exemplo: implementar um Memory Orchestrator centrado no usuário

4. Recompilação do perfil
   - perfil consolidado já é atualizado

5. Auditoria
   - eventos `promoted -> active` funcionando

6. Leitura da memória no chat principal
   - nova conversa já consegue responder:
     - nome do usuário
     - preferência
     - objetivo atual

### Conclusão do estado atual
O write path está funcional.
O read path está funcional.
A Fase 1 está tecnicamente validada e possui evidência suficiente para progressão.
**Pronto para a Fase 2.**
- Capturas automáticas: 59
- Correções manuais: 23
- Dias corridos: 4

---

## Roadmap completo

| Fase | Nome | Status | O que tem | O que falta |
|---|---|---|---|---|
| 0 | Definição arquitetural | Concluída | memória centrada no usuário, separação de camadas, regras estruturais definidas | nada crítico |
| 1 | Base de dados | Concluída | schema, tabelas principais, tipos e enums | nada crítico |
| 2 | Serviços centrais | Concluída | repository, reconciler, profile compiler, context builder, orchestrator | refinamentos futuros |
| 3 | Endpoints internos | Concluída | leitura e operação básica | validação mais profunda de payload, se desejar depois |
| 4 | UI de inspeção | Concluída | `/memory-admin` | drill-down por item é opcional |
| 5 | Smoke test interno | Concluída | rota `_test/run` | pode ficar como utilitário interno |
| 6 | Captura automática mínima | Concluída | integração com chat, feature flag, extractor determinístico | extractor ainda simples |
| 7 | Endurecimento mínimo da ingestão | Concluída | `source_message_id`, rate-limit local, bloco recente, logs | rate-limit ainda é process-local |
| 8 | Auditoria e régua de prontidão | Concluída | auditoria visível, estado de prontidão para fase 2 | observar uso real agora |
| 9 | Leitura da memória no chat | Concluída | context pack injetado nas instructions, flag separada de leitura | ranking por intenção ainda simples |
| 10 | Validação funcional ponta a ponta | Concluída | nome, preferência, objetivo, recall em nova conversa | continuar uso real |
| 11 | Observação real de uso | Concluída | UI mostrando auditoria, prontidão para fase 2, correções manuais disponíveis | evidência de massa crítica atingida (59 capturas, 23 correções) |
| 12 | Governança persistente da ingestão | Em andamento | prompt da fase 2 já preparado | persistir rate-limit/estado de ingestão no banco |
| 13 | Refino de qualidade do contexto | Pendente | base pronta | melhorar seleção do context pack por intenção/taskType, evitar duplicação no summary |
| 14 | Auditoria avançada | Pendente | auditoria básica pronta | drill-down por item, filtros melhores, leitura de padrões de erro |
| 15 | Extração mais inteligente | Pendente | extractor determinístico validado | heurística mais rica ou LLM, só depois de evidência suficiente |
| 16 | Integração maior com ecossistema | Pendente | nenhuma necessária agora | eventual composição com `agent_memories` e perfil psicológico |
| 17 | Camada comercial / produto vendável | Pendente | arquitetura já favorece isso | generalização, multiusuário forte, governança madura |

---

## Fase atual
**Fase 12 — Governança persistente da ingestão**

### Objetivo
- Implementar governança persistente da ingestão (rate-limit/estado no banco).
- **[CONCLUÍDO] Padronização de Prompts (Roadmap Fase 1):** Migração para estrutura XML e remoção de vícios de IA.
- Garantir estabilidade dos sinais ao longo dos dias.
- Observar o que entra automaticamente via chat e o que precisa de correção manual.

### O que já existe
- evidência suficiente da Fase 1 (59 capturas / 23 correções)
- UI de prontidão funcional
- estrutura de auditoria pronta

### O que falta
- persistência do estado de ingestão
- rate-limit distribuído/no banco

---

## Regra atual de execução
Se a tarefa não for explicitamente da Fase 12 em diante, preserve a arquitetura atual e não abra escopo novo.

Ao alterar qualquer coisa:
1. respeitar o estágio atual do roadmap
2. não pular fases
3. propor a menor alteração coerente com o estado atual
4. evitar refatoração grande
5. preservar flags, fallback seguro e separação entre write path e read path

---

## Resumo executivo
Hoje o Memory Orchestrator:
- captura memória automaticamente (59 capturas até agora)
- salva no banco
- audita mudanças
- recompila perfil
- expõe UI de inspeção (com 23 correções manuais realizadas)
- lê memória no chat principal
- usa memória em novas conversas

**Estamos na Fase 2.**
Foco atual: Governança persistente da ingestão.
