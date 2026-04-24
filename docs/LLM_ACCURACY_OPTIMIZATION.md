# Optimizing LLM Accuracy
## How to maximize correctness and consistent behavior when working with LLMs

Optimizing LLMs is hard. This document provides a mental model for optimizing LLMs for accuracy and behavior, exploring methods like prompt engineering, retrieval-augmented generation (RAG), and fine-tuning.

---

## 1. LLM Optimization Context

Optimization is not a simple linear flow. It is better framed as a matrix of **Context Optimization** vs. **LLM Optimization**.

### The Accuracy Matrix

![Accuracy mental model diagram](https://cdn.openai.com/API/docs/images/diagram-optimizing-accuracy-01.png)

- **Context Optimization:** Used when the model lacks contextual knowledge (out of date, proprietary info, etc). Maximizes **response accuracy**.
- **LLM Optimization:** Used when the model produces inconsistent results (formatting, tone, logic failures). Maximizes **consistency of behavior**.

### The Optimization Journey

Typically, tasks start with prompt engineering to get a baseline. Once failures are identified, one of the levers (Context or LLM) is pulled.

![Accuracy mental model journey diagram](https://cdn.openai.com/API/docs/images/diagram-optimizing-accuracy-02.png)

**Typical Flow:**
1. Begin with a prompt and evaluate.
2. Add static few-shot examples (improves consistency).
3. Add a retrieval step (boosts performance with relevant context).
4. Prepare a dataset (50+ examples) and fine-tune (increases consistency).
5. Tune retrieval and add fact-checking (reduces hallucinations).

---

## 2. Optimization Methods

### Phase 1: Prompt Engineering
The best place to start. It forces you to define what "accuracy" means for your use case.

| Strategy                                  | Context optimization | LLM optimization |
| ----------------------------------------- | :------------------: | :--------------: |
| Write clear instructions                  |                      |        X         |
| Split complex tasks into simpler subtasks |          X           |        X         |
| Give GPTs time to "think"                 |                      |        X         |
| Test changes systematically               |          X           |        X         |
| Provide reference text                    |          X           |                  |
| Use external tools                        |          X           |                  |

### Phase 2: Retrieval-Augmented Generation (RAG)
Used to solve **in-context memory** problems by giving the model access to domain-specific context.

![RAG evaluation diagram](https://cdn.openai.com/API/docs/images/diagram-optimizing-accuracy-05.png)

- **Retrieval Failures:** Wrong context supplied or too much noise. *Resolution: Tune search/chunking.*
- **LLM Failures:** Right context but wrong action. *Resolution: Improve instructions or fine-tune.*

### Phase 3: Fine-Tuning
Used to solve **learned memory** problems by training on a domain-specific dataset.

**Best Practices:**
- Start small (50+ high-quality examples).
- Ensure examples are representative of production inputs.
- Use "prompt baking" (logging production inputs/outputs) to build datasets.

---

## 3. Measuring "Good Enough" for Production

LLMs rarely hit 99.999% accuracy. Decisions must be grounded in business and technical reality.

### Business Cost Model
Identify primary success/failure cases and assign costs.

| Event                   | Value | Description |
| ----------------------- | ----- | ----------- |
| AI success              | +$20  | Case solved without human intervention. |
| AI failure (escalation) | -$40  | Cost of human intervention. |
| AI failure (churn)      | -$1000| Cost of a frustrated customer leaving. |

**Break-even Accuracy:** The point where the operational savings match the failure costs (e.g., ~81.5% in the example above).

### Technical Mitigation
- **Prompt Engineering:** Ask for more info if confidence is low.
- **UX Design:** Allow second-line assistants to pass cases back for re-determination.
- **Human-in-the-loop:** Handoff to human if intent is unclear.

---

## Summary of Case Study (Icelandic Correction)

| Method                                      | Bleu Score |
| ------------------------------------------- | ---------- |
| GPT-4 Zero-shot                            | 62         |
| GPT-4 3 Few-shot examples                  | 70         |
| GPT-3.5 Fine-tuned (1000 examples)         | 78         |
| GPT-4 Fine-tuned (1000 examples)            | 87         |
| **GPT-4 Fine-tuned + RAG**                  | **83**     |

*Observation: RAG can sometimes decrease accuracy if it adds noise to a model that has already learned the behavior via fine-tuning.*
