import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/lib/server/request";
import {
  clearWorkflowState,
  saveWorkflowState,
  type StoredWorkflow,
  type WorkflowStep,
  type WorkflowStepStatus,
} from "@/app/lib/server/store";

function normalizeStep(step: unknown, index: number): WorkflowStep {
  const input = step as Partial<WorkflowStep> | null;
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (!text) {
    throw new Error(`step ${index + 1} missing text`);
  }

  const rawStatus = input?.status;
  const status: WorkflowStepStatus =
    rawStatus === "in_progress" || rawStatus === "completed" ? rawStatus : "pending";

  return {
    id: typeof input?.id === "string" && input.id.trim() ? input.id.trim() : crypto.randomUUID(),
    text,
    status,
  };
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" ? body.chatId.trim() : "";
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  const summary =
    typeof body?.summary === "string" && body.summary.trim() ? body.summary.trim() : undefined;
  const rawSteps = Array.isArray(body?.steps) ? body.steps : [];

  if (!chatId) {
    return NextResponse.json({ error: "chatId required" }, { status: 400 });
  }

  if (!goal) {
    return NextResponse.json({ error: "goal required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const workflow: StoredWorkflow = {
    chatId,
    goal,
    summary,
    createdAt: typeof body?.createdAt === "string" ? body.createdAt : now,
    updatedAt: now,
    steps: rawSteps.map(normalizeStep),
  };

  return NextResponse.json({
    workflow: await saveWorkflowState(user, workflow),
  });
}

export async function DELETE(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const chatId = request.nextUrl.searchParams.get("chatId")?.trim() || "";
  if (!chatId) {
    return NextResponse.json({ error: "chatId required" }, { status: 400 });
  }

  return NextResponse.json(await clearWorkflowState(user, chatId));
}
