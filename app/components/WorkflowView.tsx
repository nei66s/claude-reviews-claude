"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "../lib/api";

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

export default function WorkflowView({
  chatId,
  chatTitle,
}: {
  chatId?: string;
  chatTitle?: string;
}) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [goal, setGoal] = useState("");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

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
      setFeedback(err instanceof Error ? err.message : "Falha ao carregar workflow.");
    } finally {
      setLoading(false);
    }
  }, [chatId, chatTitle]);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow]);

  const canSave = useMemo(() => {
    return Boolean(chatId && goal.trim() && steps.some((step) => step.text.trim()));
  }, [chatId, goal, steps]);

  const updateStep = (id: string, patch: Partial<WorkflowStep>) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { id: crypto.randomUUID(), text: "", status: "pending" }]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id));
  };

  const saveWorkflow = async () => {
    if (!chatId || !canSave) return;

    setSaving(true);
    setFeedback("");
    try {
      const payload = {
        chatId,
        goal: goal.trim(),
        summary: summary.trim(),
        createdAt: workflow?.createdAt,
        steps: steps.filter((step) => step.text.trim()),
      };
      const data = await requestJson("/workflow", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const nextWorkflow = data?.workflow as Workflow;
      setWorkflow(nextWorkflow);
      setGoal(nextWorkflow.goal);
      setSummary(nextWorkflow.summary || "");
      setSteps(nextWorkflow.steps);
      setFeedback("Workflow salvo.");
    } catch (err) {
      console.error("Failed to save workflow:", err);
      setFeedback(err instanceof Error ? err.message : "Falha ao salvar workflow.");
    } finally {
      setSaving(false);
    }
  };

  const clearWorkflow = async () => {
    if (!chatId) return;
    const confirmed = window.confirm("Limpar o workflow desta conversa?");
    if (!confirmed) return;

    setSaving(true);
    setFeedback("");
    try {
      await requestJson(`/workflow?chatId=${encodeURIComponent(chatId)}`, { method: "DELETE" });
      setWorkflow(null);
      setGoal(chatTitle || "");
      setSummary("");
      setSteps([{ id: crypto.randomUUID(), text: "", status: "pending" }]);
      setFeedback("Workflow limpo.");
    } catch (err) {
      console.error("Failed to clear workflow:", err);
      setFeedback(err instanceof Error ? err.message : "Falha ao limpar workflow.");
    } finally {
      setSaving(false);
    }
  };

  if (!chatId) {
    return (
      <div className="view coordinator-view">
        <div className="panel-card">
          <div className="panel-card-title">Workflow</div>
          <div className="panel-card-copy">Selecione uma conversa para montar um plano operacional.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="view coordinator-view">
      <div className="coordinator-shell">
        <div className="panel-card workflow-header">
          <div className="panel-card-title">Workflow da conversa</div>
          <div className="panel-card-copy">
            Planeje, acompanhe e atualize as etapas da conversa atual.
          </div>
          {workflow?.updatedAt && (
            <div className="workflow-meta">
              Ultima atualizacao: {new Date(workflow.updatedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="field-group">
            <label>Objetivo</label>
            <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="O que queremos concluir?" />
          </div>
          <div className="field-group">
            <label>Resumo</label>
            <input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Contexto curto do plano" />
          </div>
          <div className="workflow-actions">
            <button className="menu-item" type="button" onClick={saveWorkflow} disabled={!canSave || saving}>
              {saving ? "Salvando..." : "Salvar workflow"}
            </button>
            <button className="menu-item" type="button" onClick={addStep}>
              Nova etapa
            </button>
            <button className="menu-item danger" type="button" onClick={clearWorkflow} disabled={saving}>
              Limpar
            </button>
          </div>
          {feedback && <div className="panel-card-copy">{feedback}</div>}
        </div>

        <div className="workflow-list">
          {steps.map((step) => (
            <div key={step.id} className={`workflow-step ${step.status}`}>
              <div className="workflow-step-dot"></div>
              <div className="workflow-step-copy" style={{ flex: 1 }}>
                <input
                  value={step.text}
                  onChange={(event) => updateStep(step.id, { text: event.target.value })}
                  placeholder="Descreva a etapa"
                />
                <div className="workflow-step-actions">
                  <select
                    value={step.status}
                    onChange={(event) =>
                      updateStep(step.id, { status: event.target.value as WorkflowStepStatus })
                    }
                  >
                    <option value="pending">pending</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                  </select>
                  <button className="menu-item danger" type="button" onClick={() => removeStep(step.id)}>
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
          {loading && <div className="panel-card-copy">Carregando workflow...</div>}
        </div>
      </div>
    </div>
  );
}
