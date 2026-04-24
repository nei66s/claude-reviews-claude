# Documentação: Sistema de Contagem de Tokens (Responses API)

Este documento descreve a implementação do sistema de contagem exata de tokens baseado no novo endpoint da OpenAI (`/v1/responses/input_tokens`). O sistema permite que tanto o usuário quanto os agentes tenham visibilidade do consumo de recursos antes da execução de uma interação.

## 🚀 Visão Geral

O sistema de contagem substitui estimativas baseadas em caracteres ou bibliotecas locais (como `tiktoken`) por uma consulta direta à API da OpenAI. Isso garante precisão total, especialmente em casos complexos que envolvem:
- **Imagens e Arquivos**: Contagem precisa baseada em resolução e detalhamento.
- **Ferramentas (Tools)**: Inclusão dos tokens consumidos pelas definições JSON das funções.
- **Contexto Dinâmico**: Inclusão automática de prompts de sistema, perfis psicológicos e memórias injetadas.

## 🛠️ Implementação Técnica

### 1. Núcleo de Contagem (`app/lib/agent/llm.ts`)
A função `countInputTokens` é o motor principal. Ela reconstrói o payload exatamente como será enviado para o modelo, mas redireciona para o endpoint de contagem.
- **Endpoint**: `https://api.openai.com/v1/responses/input_tokens`
- **Adaptação de Schema**: O endpoint exige o campo `input` (do padrão Responses API) em vez de `messages`. As ferramentas também são convertidas para um formato "flat" (sem o wrapper `function`).

### 2. Rota de API (`app/api/chat/tokens/count/route.ts`)
Um proxy seguro que permite ao frontend solicitar contagens sem expor chaves de API ou lógica de construção de prompt de sistema.
- **Segurança**: Exige autenticação do usuário.
- **Contexto**: Injeta automaticamente o prompt de sistema configurado para o agente selecionado.

### 3. Componente de UI (`app/components/TokenCounter.tsx`)
Um componente React focado em UX premium e performance.
- **Debounce de 1s**: Evita chamadas excessivas enquanto o usuário digita.
- **Estabilidade de Payload**: Utiliza `JSON.stringify` para comparar o conteúdo real antes de disparar novas consultas, ignorando re-renderizações irrelevantes do React.
- **Design**: Integrado ao sistema de temas Pimpotasma, com animações suaves e modo loading.

## 📊 Vantagens da Responses API

| Antigo (Local/Tiktoken) | Novo (OpenAI Input Tokens API) |
| :--- | :--- |
| **Impreciso** com ferramentas e imagens. | **Precisão de 100%** conforme o billing da OpenAI. |
| Exige bibliotecas pesadas no bundle. | **Custo zero de bundle**, usa `fetch` nativo. |
| Não considera prompts de sistema dinâmicos. | **Contexto Completo**: Inclui memórias e instruções. |

## 🧪 Verificação de Funcionamento

O sistema foi testado e validado em **23 de Abril de 2026**.
- **Teste de Carga**: Resolvido o problema de múltiplas requisições redundantes.
- **Precisão**: Confirmada a paridade entre a contagem estimada e o uso real reportado no meta-dado final das mensagens.

## 📖 Como Usar na Interface

O contador aparece automaticamente abaixo do campo de texto em:
1. **Welcome Screen**: Ao iniciar uma nova conversa.
2. **Chat Ativo**: Em todas as interações continuadas.

O selo `🪙 Tokens estimados: XXX` fornece feedback visual imediato sobre a complexidade da mensagem e dos arquivos anexados.

---
*Documentação gerada pelo ecossistema Pimpotasma (Chocks).*
