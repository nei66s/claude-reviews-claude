# Roadmap de Comportamento dos Agentes (Prompt Engineering)

Este roadmap define as etapas para integrar as melhores práticas de Engenharia de Prompt extraídas de sistemas de IA líderes de mercado (Anthropic e Cursor) aos nossos próprios agentes e Orquestrador de Memória.

---

## 🎯 Fase 1: Higiene e Estruturação de Prompts (Quick Wins)
**Status:** ✅ Concluída  
**Objetivo:** Refatorar nossos `System Prompts` atuais para torná-los mais obedientes, concisos e naturais.

- [x] **Migração para Tags XML:** Envolver todos os nossos prompts de sistema atuais (ex: `llm-extractor.ts`, Agentes) em blocos XML rigorosos (`<agent_directive>`, `<extraction_rules>`, etc.) para separar contexto de instruções operacionais.
- [x] **Limpeza de Vícios de Linguagem:** Adicionar a regra estrita: *"Nunca inicie respostas pedindo desculpas (I'm sorry/I apologize). Nunca use palavras de preenchimento como 'Certainly!', 'Of course!' ou 'Great!'."*
- [x] **Ocultação do Motor (Tool Hiding):** Instruir o agente a nunca revelar o nome técnico de suas ferramentas (ex: "vou usar a ferramenta web_search"). Ele deve simplesmente falar *"Vou pesquisar sobre isso"* ou ir direto ao ponto.

---

## 🛡️ Fase 2: Segurança e Anti-Trava (Loop Prevention)
**Status:** ✅ Concluída  
**Objetivo:** Evitar que o agente entre em loops infinitos de erro e proteger o sistema contra extração de diretrizes.

- [x] **Regra dos 3 erros (Anti-looping):** Implementado rastreador de erros no `route.ts`. Injetada a regra de que, se uma ferramenta falhar 3 vezes com o mesmo erro, o agente deve parar, explicar o problema tecnicamente e pedir ajuda humana.
- [x] **Proteção do System Prompt (Prompt Shield):** Adicionada diretriz de segurança que proíbe o agente de revelar suas regras internas ou detalhes técnicos de arquitetura, mesmo sob pressão (*Prompt Injection*).
- [x] **Cegueira Facial Programada (Face Blindness):** Injetar a diretriz nos agentes multimodais de que, ao receber uma imagem, eles jamais devem nomear ou identificar características exclusivas que reconheçam um humano (evita falsos positivos e passivos de privacidade).

---

## 🧠 Fase 3: Modos de Personalidade Restritos (Memory Orchestrator)
**Status:** 🟡 A fazer  
**Objetivo:** Ligar os aprendizados das IAs de mercado à funcionalidade que já temos no Orquestrador de Memória.

- [ ] **Mapeamento de UserStyles:** Criar definições granulares baseadas nos vazamentos da Anthropic:
  - `Concise Mode`: Foco absolutista em precisão técnica, listas diretas, sem nenhuma introdução afável.
  - `Explanatory Mode`: Modo tutorial/professor. Passo-a-passo e uso de analogias.
  - `Formal Mode`: Comunicação polida "corp", ideal para geração de documentos.
- [ ] **Injeção de Perfil:** Quando o Memory Orchestrator registrar que a preferência do usuário é uma dessas três opções, o sistema injeta *exatamente* o trecho do prompt referente àquele comportamento, evitando "vazamento de personalidade".

---

## 🖥️ Fase 4: Heurística de Artefatos UI
**Status:** 🟡 A fazer  
**Objetivo:** Estruturar regras lógicas e claras para exibição de componentes fora do chat padrão.

- [ ] **Regra dos 15+ Linhas:** Ensinar o modelo que códigos ou textos menores devem ser mandados direto no fluxo de chat.
- [ ] **Tags de Rendering:** Padronizar as tags que o modelo deve emitir caso queira renderizar algo externo (ex: gráficos Mermaid, componentes React ou documentos Markdown pesados) seguindo o padrão de "Good Artifact vs Bad Artifact".
- [ ] **Feedback visual no Client:** O front-end deverá ler o chunk do "Artifact" vindo da stream e separar a visualização numa janela lateral, preservando a imersão da conversa.
