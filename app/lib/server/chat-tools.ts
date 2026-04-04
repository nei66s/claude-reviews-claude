import crypto from "node:crypto";

import {
  clearWorkflowState,
  getWorkflowState,
  saveWorkflowState,
  type StoredWorkflow,
  type WorkflowStep,
  type WorkflowStepStatus,
} from "./store";
import {
  copyFileSystemEntry,
  createDirectory,
  deleteFileSystemEntry,
  listFileEntries,
  moveFileSystemEntry,
  readFileForPreview,
  writeFileContents,
} from "./files";
import type { SessionUser } from "./auth";

export const chatToolDefinitions = [
  {
    type: "function",
    name: "file_read",
    description: "Ler um arquivo de texto ou inspecionar preview de arquivo.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do arquivo." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "ls_safe",
    description: "Listar arquivos e pastas em um diretorio.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho da pasta." },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "file_write",
    description: "Salvar conteudo em um arquivo.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do arquivo." },
        content: { type: "string", description: "Conteudo textual." },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "directory_create",
    description: "Criar uma pasta.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho da pasta." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "file_move",
    description: "Mover ou renomear arquivo/pasta.",
    parameters: {
      type: "object",
      properties: {
        from_path: { type: "string", description: "Origem." },
        to_path: { type: "string", description: "Destino." },
      },
      required: ["from_path", "to_path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "file_copy",
    description: "Copiar arquivo ou pasta.",
    parameters: {
      type: "object",
      properties: {
        from_path: { type: "string", description: "Origem." },
        to_path: { type: "string", description: "Destino." },
      },
      required: ["from_path", "to_path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "file_delete",
    description: "Apagar arquivo ou pasta.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do item." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "workflow_get",
    description: "Obter o workflow atual da conversa.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "workflow_replace",
    description: "Criar ou substituir o workflow da conversa.",
    parameters: {
      type: "object",
      properties: {
        goal: { type: "string" },
        summary: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed"],
              },
            },
            required: ["text"],
            additionalProperties: false,
          },
        },
      },
      required: ["goal", "steps"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "workflow_update_step",
    description: "Atualizar uma etapa do workflow.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        text: { type: "string" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed"],
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "workflow_clear",
    description: "Limpar o workflow da conversa.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
] as const;

function normalizeWorkflowStep(step: unknown, index: number): WorkflowStep {
  const input = step as Partial<WorkflowStep> | null;
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (!text) {
    throw new Error(`workflow step ${index + 1} missing text`);
  }
  const status: WorkflowStepStatus =
    input?.status === "in_progress" || input?.status === "completed" ? input.status : "pending";
  return {
    id: typeof input?.id === "string" && input.id.trim() ? input.id.trim() : crypto.randomUUID(),
    text,
    status,
  };
}

export async function runChatTool(
  user: SessionUser,
  chatId: string,
  toolName: string,
  input: Record<string, unknown>,
) {
  if (toolName === "file_read") {
    return readFileForPreview(String(input.path || ""));
  }

  if (toolName === "ls_safe") {
    return listFileEntries(String(input.path || "."));
  }

  if (toolName === "file_write") {
    return writeFileContents(String(input.path || ""), String(input.content || ""));
  }

  if (toolName === "directory_create") {
    return createDirectory(String(input.path || ""));
  }

  if (toolName === "file_move") {
    return moveFileSystemEntry(String(input.from_path || ""), String(input.to_path || ""));
  }

  if (toolName === "file_copy") {
    return copyFileSystemEntry(String(input.from_path || ""), String(input.to_path || ""));
  }

  if (toolName === "file_delete") {
    return deleteFileSystemEntry(String(input.path || ""));
  }

  if (toolName === "workflow_get") {
    return getWorkflowState(user, chatId);
  }

  if (toolName === "workflow_replace") {
    const goal = String(input.goal || "").trim();
    const steps = Array.isArray(input.steps) ? input.steps.map(normalizeWorkflowStep) : [];
    if (!goal) throw new Error("goal required");
    if (steps.length === 0) throw new Error("steps required");

    const now = new Date().toISOString();
    const workflow: StoredWorkflow = {
      chatId,
      goal,
      summary: typeof input.summary === "string" && input.summary.trim() ? input.summary.trim() : undefined,
      createdAt: now,
      updatedAt: now,
      steps,
    };
    return saveWorkflowState(user, workflow);
  }

  if (toolName === "workflow_update_step") {
    const workflow = await getWorkflowState(user, chatId);
    if (!workflow) {
      throw new Error("no active workflow");
    }
    const stepId = String(input.id || "").trim();
    if (!stepId) throw new Error("id required");

    const updatedWorkflow: StoredWorkflow = {
      ...workflow,
      updatedAt: new Date().toISOString(),
      steps: workflow.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              text: typeof input.text === "string" && input.text.trim() ? input.text.trim() : step.text,
              status:
                input.status === "pending" || input.status === "in_progress" || input.status === "completed"
                  ? input.status
                  : step.status,
            }
          : step,
      ),
    };
    return saveWorkflowState(user, updatedWorkflow);
  }

  if (toolName === "workflow_clear") {
    return clearWorkflowState(user, chatId);
  }

  throw new Error(`unknown tool: ${toolName}`);
}
