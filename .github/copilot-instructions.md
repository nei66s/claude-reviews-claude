---
name: project-agent-instructions
description: Preferências curtas para interações com o agente neste repositório.
applyTo:
  - "**/*"
---

- **Preferências principais**: TypeScript/Node (Bun ok); usar API OpenAI (chave em `.env`); não commitar `.env`.
- **Estilo de resposta**: sempre resumido — respostas curtas (máx. 4 linhas) e passos numerados.
- **Código**: evitar variáveis de uma letra; preferir tipos explícitos; mudanças pequenas e focadas.
- **Segurança**: não imprimir chaves; validar entradas; aplicar moderação quando necessário.
- **Fluxo**: ao propor mudanças, incluir 1) objetivo curto, 2) arquivos a alterar, 3) comandos para testar.

- **Prompt de exemplo**: "Implementar protótipo TypeScript: servidor HTTP com `/chat` e `/tools/run` usando `OPENAI_API_KEY`. Resuma em 5 passos e liste os arquivos."

-- FIM --
