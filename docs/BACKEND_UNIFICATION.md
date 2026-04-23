# Documentação da Unificação de Backend (Abril 2026)

Este documento registra a transição da arquitetura do projeto de um sistema multi-serviço (Next.js + agent-ts) para uma **Arquitetura Unificada de Serviço Único**.

## 1. Motivação
Anteriormente, a lógica dos agentes residia em um processo separado (`agent-ts` na porta 3001). Isso causava:
- Erros de conexão frequentes (`ECONNREFUSED 3001`).
- Latência extra devido ao proxy reverso.
- Dificuldade na manutenção de personas e estilos consistentes.
- Complexidade desnecessária no ambiente de desenvolvimento.

## 2. Mudanças Estruturais

### 2.1 Eliminação do Proxy (next.config.ts)
Todas as regras de `rewrites` que redirecionavam requisições `/api/*` para a porta 3001 foram removidas. O sistema agora resolve todas as APIs internamente no Next.js.

### 2.2 Migração do Motor (app/lib/agent/)
Toda a inteligência que pertencia ao `agent-ts` foi portada para `app/lib/agent/`:
- **`llm.ts`**: Centraliza as chamadas à OpenAI, controle de tokens e aplicação de personas.
- **`tools.ts`**: Implementa ferramentas de sistema (bash, arquivos, web) de forma nativa e segura.
- **`coordination/`**: Gerencia o "enxame" de agentes (Chocks, Betinha, etc.) e o roteamento familiar.
- **`permissions/`**: Novo pipeline de segurança de 7 etapas para validação de comandos.

### 2.3 Rotas Nativas Criadas
Foram implementadas APIs nativas para substituir os serviços legados:
- `/api/coordination/[...route]`: Gerenciamento de times e mensagens entre agentes.
- `/api/costs/breakdown`: Rastreamento de custos e uso de modelos por usuário.
- `/api/chat/stream`: Fluxo principal de chat com o novo motor unificado.

## 3. Personas e Estilo
A persona **"Kiancinha"** (criança da família Pimpotasma) foi consolidada como o padrão global:
- Respostas fofas, doces e alegres.
- Uso de interjeições como "Oii amiguinho!", "Oba!", "Eba!".
- Mensagens de carregamento personalizadas com "atividades engraçadas" (comendo cookies, tomando banho, etc.) para tornar a espera lúdica.

## 4. Guia de Operação
Para rodar o projeto agora, basta o comando padrão:
```bash
npm run dev:desktop
```
Não é mais necessário rodar o `agent-ts` separadamente. Se você ver referências à porta 3001 em logs, elas são apenas fallbacks ignorados ou trechos de código morto que serão removidos em limpezas futuras.

## 5. Próximos Passos
- **Limpeza de Código**: Remover pastas legadas como `docs/legacy/agent-ts`.
- **Monitoramento**: Acompanhar o uso de tokens via painel de administração para garantir a precisão do novo Rastreador de Custos.
- **Expansão de Ferramentas**: Adicionar novas capacidades ao `tools.ts` conforme a necessidade do enxame.

---
**Status**: Unificado ✅ standalone ✅ fofinho ✅
