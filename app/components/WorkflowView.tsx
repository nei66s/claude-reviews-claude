"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "../lib/api";
import { SkeletonCard } from "./SkeletonLoaders";

type WorkflowStepStatus = "pending" | "in_progress" | "completed";

type WorkflowStep = {
  id: string;
  text: string;
  status: WorkflowStepStatus;
};

type Workflow = {
  chatId: string;
  goal: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
};

const STATUS_CONFIG: Record<WorkflowStepStatus, { label: string; icon: string; color: string; bg: string }> = {
  pending:     { label: "Pendente",    icon: "○", color: "#71717a", bg: "rgba(113,113,122,0.12)" },
  in_progress: { label: "Em progresso", icon: "◑", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  completed:   { label: "Concluída",   icon: "●", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

export default function WorkflowView({
  chatId,
  chatTitle,
  onSelectChat,
}: {
  chatId?: string;
  chatTitle?: string;
  onSelectChat?: (id: string, title: string) => void;
}) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [goal, setGoal] = useState("");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const loadExample = async () => {
    setSeeding(true);
    try {
      const data = await requestJson("/workflow/seed", { method: "POST" }) as { chatId: string; title: string };
      onSelectChat?.(data.chatId, data.title);
    } catch (err) {
      console.error("Failed to seed example:", err);
    } finally {
      setSeeding(false);
    }
  };

  const loadWorkflow = useCallback(async () => {
    if (!chatId) {
      setWorkflow(null);
      setGoal("");
      setSummary("");
      setSteps([]);
      return;
    }
    setLoading(true);
    try {
      const data = await requestJson(`/workflow/status?chatId=${encodeURIComponent(chatId)}`);
      const active = data?.active as Workflow | null;
      setWorkflow(active);
      setGoal(active?.goal || chatTitle || "");
      setSummary(active?.summary || "");
      setSteps(
        Array.isArray(active?.steps) && active?.steps.length > 0
          ? active.steps
          : [{ id: crypto.randomUUID(), text: "", status: "pending" }],
      );
    } catch (err) {
      console.error("Failed to load workflow:", err);
      setFeedback({ msg: err instanceof Error ? err.message : "Falha ao carregar workflow.", ok: false });
    } finally {
      setLoading(false);
    }
  }, [chatId, chatTitle]);

  useEffect(() => { void loadWorkflow(); }, [loadWorkflow]);

  const canSave = useMemo(() =>
    Boolean(chatId && goal.trim() && steps.some((s) => s.text.trim())),
  [chatId, goal, steps]);

  const updateStep = (id: string, patch: Partial<WorkflowStep>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addStep = () =>
    setSteps((prev) => [...prev, { id: crypto.randomUUID(), text: "", status: "pending" }]);

  const removeStep = (id: string) =>
    setSteps((prev) => prev.filter((s) => s.id !== id));

  const cycleStatus = (id: string, current: WorkflowStepStatus) => {
    const order: WorkflowStepStatus[] = ["pending", "in_progress", "completed"];
    const next = order[(order.indexOf(current) + 1) % order.length];
    updateStep(id, { status: next });
  };

  const saveWorkflow = async () => {
    if (!chatId || !canSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        chatId,
        goal: goal.trim(),
        summary: summary.trim(),
        createdAt: workflow?.createdAt,
        steps: steps.filter((s) => s.text.trim()),
      };
      const data = await requestJson("/workflow", { method: "POST", body: JSON.stringify(payload) });
      const next = data?.workflow as Workflow;
      setWorkflow(next);
      setGoal(next.goal);
      setSummary(next.summary || "");
      setSteps(next.steps);
      setFeedback({ msg: "Workflow salvo com sucesso.", ok: true });
    } catch (err) {
      setFeedback({ msg: err instanceof Error ? err.message : "Falha ao salvar.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const clearWorkflow = async () => {
    if (!chatId) return;
    const confirmed = window.confirm("Limpar o workflow desta conversa?");
    if (!confirmed) return;
    setSaving(true);
    setFeedback(null);
    try {
      await requestJson(`/workflow?chatId=${encodeURIComponent(chatId)}`, { method: "DELETE" });
      setWorkflow(null);
      setGoal(chatTitle || "");
      setSummary("");
      setSteps([{ id: crypto.randomUUID(), text: "", status: "pending" }]);
      setFeedback({ msg: "Workflow limpo.", ok: true });
    } catch (err) {
      setFeedback({ msg: err instanceof Error ? err.message : "Falha ao limpar.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const doneCount = steps.filter((s) => s.status === "completed").length;
  const totalCount = steps.filter((s) => s.text.trim()).length;

  if (!chatId) {
    return (
      <div className="view coordinator-view">
        <div className="wf-shell">
          <div className="wf-explain-banner">
            <div className="wf-explain-icon">🗺️</div>
            <div>
              <div className="wf-explain-title">O que é o Workflow?</div>
              <div className="wf-explain-body">
                O Workflow é um <strong>plano de etapas vinculado a uma conversa</strong>. Use-o para organizar o que o Chocks precisa fazer — cada etapa tem um status (pendente, em progresso, concluída) que você atualiza manualmente ou o agente atualiza automaticamente. É útil para tarefas longas como migrações, análises ou automações com múltiplos passos.
              </div>
            </div>
          </div>
          <div className="wf-empty">
            <div className="wf-empty-icon">💬</div>
            <div className="wf-empty-text">Selecione ou inicie uma conversa para criar um plano.</div>
            <button
              className="wf-btn wf-btn-primary"
              onClick={() => void loadExample()}
              disabled={seeding}
            >
              {seeding ? "Criando exemplo..." : "✦ Carregar exemplo"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view coordinator-view">
      <div className="wf-shell">

        {/* Header */}
        <div className="wf-header">
          <div className="wf-header-left">
            <div className="wf-header-icon">🗺️</div>
            <div>
              <div className="wf-header-title">Workflow</div>
              <div className="wf-header-sub">
                {loading ? "Carregando..." : workflow?.updatedAt
                  ? `Salvo em ${new Date(workflow.updatedAt).toLocaleString()}`
                  : "Nenhum plano salvo ainda"}
              </div>
            </div>
          </div>
          {totalCount > 0 && (
            <div className="wf-progress-pill">
              <span className="wf-progress-count">{doneCount}/{totalCount}</span>
              <div className="wf-progress-track">
                <div
                  className="wf-progress-fill"
                  style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
        {/* Explain banner (collapsible hint) */}
        <div className="wf-explain-banner compact">
          <div className="wf-explain-icon">💡</div>
          <div className="wf-explain-body">
            Use o Workflow para <strong>dividir tarefas complexas em etapas</strong>. Clique no ícone de status de cada etapa para alterná-lo entre Pendente → Em progresso → Concluída.
          </div>
        </div>

        {/* Form */}
        <div className="wf-form-card">
          <div className="wf-field">
            <label className="wf-label">Objetivo</label>
            <input
              className="wf-input"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="O que queremos concluir com esta conversa?"
            />
          </div>
          <div className="wf-field">
            <label className="wf-label">Resumo / contexto</label>
            <input
              className="wf-input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Breve descrição do plano ou contexto adicional"
            />
          </div>

          <div className="wf-form-actions">
            <button
              className="wf-btn wf-btn-primary"
              type="button"
              onClick={saveWorkflow}
              disabled={!canSave || saving}
            >
              {saving ? "Salvando..." : "Salvar plano"}
            </button>
            <button className="wf-btn" type="button" onClick={addStep}>
              + Nova etapa
            </button>
            <button className="wf-btn wf-btn-danger" type="button" onClick={clearWorkflow} disabled={saving}>
              Limpar
            </button>
          </div>

          {feedback && (
            <div className={`wf-feedback${feedback.ok ? " ok" : " err"}`}>
              {feedback.ok ? "✓" : "✕"} {feedback.msg}
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="wf-section-label">Etapas</div>
        <div className="wf-steps">
          {steps.map((step, idx) => {
            const cfg = STATUS_CONFIG[step.status];
            return (
              <div key={step.id} className={`wf-step ${step.status}`}>
                <div className="wf-step-left">
                  <button
                    className="wf-step-status-btn"
                    style={{ color: cfg.color, background: cfg.bg }}
                    onClick={() => cycleStatus(step.id, step.status)}
                    title={`Status: ${cfg.label} — clique para avançar`}
                  >
                    {cfg.icon}
                  </button>
                  {idx < steps.length - 1 && <div className="wf-step-line" />}
                </div>
                <div className="wf-step-body">
                  <input
                    className="wf-step-input"
                    value={step.text}
                    onChange={(e) => updateStep(step.id, { text: e.target.value })}
                    placeholder="Descreva a etapa..."
                  />
                  <div className="wf-step-meta">
                    <span className="wf-step-badge" style={{ color: cfg.color, background: cfg.bg }}>
                      {cfg.label}
                    </span>
                    <button
                      className="wf-step-remove"
                      onClick={() => removeStep(step.id)}
                      title="Remover etapa"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="wf-loading">Carregando workflow...</div>
          )}
        </div>
        </>
        )}

      </div>
    </div>
  );
}
