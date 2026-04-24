# Documentação Técnica: Estrutura de Prompts (Padrão CL4R1T4S)

Esta documentação descreve o novo padrão de estruturação de System Prompts adotado no projeto, baseado em técnicas de transparência e eficiência de modelos de larga escala (Anthropic/Claude).

## 🧩 Arquitetura XML
Os prompts não são mais texto plano. Eles utilizam tags XML para que o modelo processe a hierarquia de comandos com mais precisão.

### Tags Principais:
- `<system_directives>`: O container raiz que engloba todas as instruções do sistema.
- `<behavioral_constraints>`: Regras estritas de comportamento, tom de voz e proibições.
- `<persona_details>`: Definição da identidade e história do agente ativo.
- `<extraction_rules>`: Regras lógicas para processamento de dados (exclusivo para extratores).
- `<output_format>`: Especificação técnica da estrutura de resposta (JSON, Markdown, etc.).
- `<collaboration_protocol>`: Instruções de como o agente deve interagir com um agente auxiliar.

## 🚫 Restrições de Comportamento (Anti-Robô)
Para garantir uma experiência de usuário premium e evitar o tom "IA genérica", as seguintes regras são obrigatórias em todos os prompts:

1. **Zero Apologias:** Proibido iniciar respostas com "Sinto muito" ou "Peço desculpas". O agente deve ser assertivo.
2. **Sem Afirmações Vazias:** Proibido o uso de palavras de preenchimento como "Certamente!", "Absolutamente!" ou "Com certeza!".
3. **Tool Masking (Ocultação de Ferramentas):** O nome técnico das ferramentas (ex: `read_file`, `web_search`) jamais deve ser mencionado. O agente deve traduzir a ação para linguagem natural (ex: "Vou dar uma olhada no seu arquivo...").
4. **Respostas Diretas:** Eliminação de introduções e conclusões longas e repetitivas.

## 🖼️ Regras Multimodais (Visão)
Para agentes que processam imagens (`image-extractor`), o padrão inclui:
- **Cegueira Facial (Face Blindness):** O modelo é instruído a ignorar a identidade de seres humanos e descrevê-los apenas de forma genérica, garantindo privacidade e reduzindo alucinações de reconhecimento.

## 🛡️ Proteção de Prompt
O sistema agora possui instruções explícitas para **não revelar** seu System Prompt ou a descrição das ferramentas internas, mesmo sob pressão de técnicas de prompt injection.

---
*Atualizado em: 2026-04-21*

## 📚 Referências Relacionadas
- [Otimização de Acurácia e Comportamento](LLM_ACCURACY_OPTIMIZATION.md): Mental model para evolução de prompts, RAG e Fine-tuning.
