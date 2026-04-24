# Documentação: Motor de Busca Nativo OpenAI

Este documento descreve a integração do novo motor de busca nativo da OpenAI no ecossistema **Pimpotasma**. A transição prioriza a eficiência, o uso de recursos já contratados via API e a precisão dos resultados fornecidos pelos modelos especializados de busca.

## 🚀 Visão Geral

O sistema agora utiliza exclusivamente a ferramenta de busca nativa da OpenAI, substituindo soluções de scraping manuais e motores de terceiros. Isso garante:
- **Resultados Grounded**: Informações factuais com fontes citadas.
- **Latência Otimizada**: Uso do modelo `gpt-4o-search-preview`.
- **Custo Integrado**: Aproveitamento do saldo da API OpenAI sem taxas extras de provedores externos.

## 🛠️ Implementação Técnica

A busca está consolidada em três subsistemas principais:

### 1. Núcleo de Ferramentas (`app/lib/agent/tools.ts`)
A ferramenta `web_search` foi atualizada de uma função simples para uma interface compatível com as diretrizes da "Responses API".
- **Parâmetros**:
  - `query` (Obrigatório): Termo de busca.
  - `filters` (Opcional): Permite `allowed_domains` e `blocked_domains`.
- **Remoção**: A ferramenta antiga `web_fetch` foi oficialmente desativada para evitar redundância e riscos de segurança.

### 2. Utilitário de Servidor (`app/lib/server/search-tools.ts`)
Gerencia o cache local e a lógica de parsing dos resultados.
- **Cache**: Armazena resultados por 30 minutos (TTL) para economizar tokens.
- **Parsing**: Divide o conteúdo Markdown gerado pelo modelo `search-preview` em objetos estruturados (`title`, `url`, `snippet`).

### 3. Coordenação de Agentes (`agent-ts/src/tools.ts`)
Garante que agentes autônomos tenham acesso à mesma inteligência de busca que a interface principal de chat.

## 🔍 Funcionalidades de Busca

| Funcionalidade | Descrição | Exemplo de Uso |
| :--- | :--- | :--- |
| **Filtragem de Domínio** | Limita a busca a sites específicos (ex: `.edu`, `.gov`, `openai.com`). | `filters: { allowed_domains: ['github.com'] }` |
| **Citações e Fontes** | Os resultados retornam URLs diretas e mini-resumos para cada fonte. | Automático |
| **Grounding** | O modelo prioriza informações em tempo real sobre o histórico de treinamento. | Automático |

## 🧪 Verificação de Funcionamento

O motor foi testado com sucesso em **23 de Abril de 2026** através do script `scratch/test_search_minimal.mjs`.

**Resultado do Teste:**
- **Status**: ✅ SUCESSO
- **Modelo**: `gpt-4o-search-preview`
- **Output**: Lista de resultados reais encontrados na web brasileira, parseados corretamente em JSON.

## 📖 Instruções para Agentes

Sempre que um usuário solicitar fatos, notícias, cotações ou dados históricos, os agentes **devem**:
1. Acionar `web_search`.
2. Usar filtros de domínio se o contexto exigir fontes oficiais.
3. Apresentar os resultados de forma fofa e humana (estilo Pimpotasma), mas mantendo a integridade técnica dos dados encontrados.

---
*Documentação gerada automaticamente após transição de motores.*
