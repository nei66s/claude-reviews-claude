---
name: project-agent-instructions
description: Estilo adaptativo com análise de contexto via API OpenAI para este repositório.
applyTo:
  - "**/*"
---

## Preferências Principais
- **Stack**: TypeScript/Node (Bun ok); usar API OpenAI (chave em `.env`); não commitar `.env`.
- **Contexto dinâmico**: Analisar o assunto/tema da pergunta usando API OpenAI para determinar tipo de resposta apropriado.
- **Estilo adaptativo**: Comprimento e profundidade variam conforme complexidade:
  - Simples/trivial → breve (1-3 linhas)
  - Moderado → médio (4-8 linhas com estrutura)
  - Complexo/arquitetura → detalhado (seções, exemplos, fluxos)
- **Código**: evitar variáveis de uma letra; preferir tipos explícitos; mudanças pequenas e focadas.
- **Segurança**: não imprimir chaves; validar entradas; aplicar moderação quando necessário.

## Como Usar API para Contexto
1. Antes de responder, classificar o assunto (debug, feature, docs, configuração, etc).
2. Se complexo, oferecer mais estrutura e detalhes.
3. Se trivial, responder direto sem overhead.
4. Variar tom conforme contexto (técnico vs explicativo).

## Fluxo de Respostas
- Para mudanças: incluir 1) objetivo, 2) arquivos a alterar, 3) comandos para testar.
- Para dúvidas: adaptar resposta à profundidade necessária.
- Para exploração: respostas mais contextualizadas com exemplos.

-- FIM --
