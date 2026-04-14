"use client";

import { TraceEntry } from "../lib/api";

type WorkflowStepState = "pending" | "in_progress" | "completed" | "error";

type WorkflowStepView = {
  id: string;
  text: string;
  status: WorkflowStepState;
};

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseArgs(payload: unknown): Record<string, unknown> | null {
  const payloadObj = toObject(payload);
  if (!payloadObj || typeof payloadObj.arguments !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(payloadObj.arguments);
    return toObject(parsed);
  } catch {
    return null;
  }
}

function normalizeStatus(value: unknown): WorkflowStepState {
  if (value === "in_progress") return "in_progress";
  if (value === "completed") return "completed";
  if (value === "error") return "error";
  return "pending";
}

function deriveWorkflowSteps(trace: TraceEntry[] | undefined): WorkflowStepView[] {
  if (!Array.isArray(trace) || trace.length === 0) {
    return [];
  }

  const steps = new Map<string, WorkflowStepView>();

  for (const entry of trace) {
    if (entry.label === "workflow_replace") {
      const payloadObj = toObject(entry.payload);
      const outputObj = toObject(payloadObj?.output);
      const source = outputObj ?? parseArgs(entry.payload);
      const sourceSteps = Array.isArray(source?.steps) ? source.steps : [];
      if (sourceSteps.length > 0) {
        steps.clear();
        for (const rawStep of sourceSteps) {
          const stepObj = toObject(rawStep);
          const stepId = typeof stepObj?.id === "string" ? stepObj.id.trim() : "";
          if (!stepId) continue;
          const stepText = typeof stepObj?.text === "string" && stepObj.text.trim()
            ? stepObj.text.trim()
            : `Etapa ${stepId}`;
          const stepStatus = normalizeStatus(stepObj?.status);
          steps.set(stepId, { id: stepId, text: stepText, status: stepStatus });
        }
      }
      continue;
    }

    if (entry.label === "workflow_update_step") {
      const args = parseArgs(entry.payload);
      const stepId = typeof args?.id === "string" ? args.id.trim() : "";
      if (!stepId) continue;
      const previous = steps.get(stepId);
      const nextText = typeof args?.text === "string" && args.text.trim()
        ? args.text.trim()
        : previous?.text || `Etapa ${stepId}`;
      const nextStatus = entry.state === "error"
        ? "error"
        : normalizeStatus(args?.status ?? previous?.status);
      steps.set(stepId, { id: stepId, text: nextText, status: nextStatus });
    }
  }

  return Array.from(steps.values());
}

function statusLabel(status: WorkflowStepState) {
  if (status === "completed") return "concluida";
  if (status === "in_progress") return "em andamento";
  if (status === "error") return "erro";
  return "pendente";
}

function toolActionLabel(label?: string) {
  const map: Record<string, string> = {
    workflow_replace: "Montando plano",
    workflow_update_step: "Atualizando etapa",
    workflow_get: "Lendo workflow",
    ls_safe: "Listando arquivos",
    file_read: "Lendo arquivo",
    file_write: "Escrevendo arquivo",
    pdf_report: "Gerando PDF",
  };
  return map[label || ""] || "Executando etapa";
}

function getCurrentActivity(trace: TraceEntry[] | undefined, streaming: boolean, hasOpenSteps: boolean) {
  if (!streaming && hasOpenSteps) {
    return "Fluxo pausou antes de concluir as etapas.";
  }

  if (!streaming && !hasOpenSteps) {
    return "Workflow concluido.";
  }

  if (!Array.isArray(trace) || trace.length === 0) {
    if (streaming) return "Iniciando processamento...";
    if (hasOpenSteps) return "Fluxo pausou antes de concluir as etapas.";
    return "Workflow concluido.";
  }

  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const entry = trace[index];
    if (entry.state === "pending") {
      return entry.subtitle?.trim() || toolActionLabel(entry.label);
    }
  }

  if (hasOpenSteps) {
    return "Sem atividade no momento; etapas ainda pendentes.";
  }

  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const entry = trace[index];
    if (entry.state === "complete") {
      return entry.subtitle?.trim() || "Etapas concluidas.";
    }
  }

  return "Aguardando atualizacao...";
}

export default function TaskProgressPanel({
  trace,
  streaming,
}: {
  trace?: TraceEntry[];
  streaming?: boolean;
}) {
  const workflowSteps = deriveWorkflowSteps(trace);
  if (workflowSteps.length === 0) {
    return null;
  }

  const completedCount = workflowSteps.filter((step) => step.status === "completed").length;
  const hasOpenSteps = workflowSteps.some((step) => step.status === "pending" || step.status === "in_progress");
  const statusMode = streaming ? "running" : hasOpenSteps ? "stalled" : "done";
  const statusLabelText = streaming ? "executando" : hasOpenSteps ? "incompleto" : "finalizado";
  const activity = getCurrentActivity(trace, Boolean(streaming), hasOpenSteps);

  return (
    <div className="workflow-inline workflow-dock">
      <div className="workflow-inline-head">
        <span className="workflow-inline-title">Tarefas ({completedCount}/{workflowSteps.length})</span>
        <span className={`workflow-inline-live ${statusMode}`}>
          {statusLabelText}
        </span>
      </div>
      <div className="workflow-inline-activity">Agora: {activity}</div>
      <div className="workflow-inline-list">
        {workflowSteps.map((step, index) => (
          <div key={step.id} className="workflow-inline-item">
            <span className={`workflow-inline-dot ${step.status}`} aria-hidden="true" />
            <span className="workflow-inline-text">{index + 1}. {step.text}</span>
            <span className={`workflow-inline-status ${step.status}`}>{statusLabel(step.status)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
