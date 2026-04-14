import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";
import { createConversation, saveWorkflowState } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const chatId = `demo-workflow-${crypto.randomUUID().slice(0, 8)}`;
  const title = "Exemplo: Migração de Banco de Dados";
  const now = new Date().toISOString();

  await createConversation(user, { id: chatId, title });

  await saveWorkflowState(user, {
    chatId,
    goal: "Migrar banco de dados da v1 para v2 sem downtime",
    summary: "Migração progressiva com rollback automático. Janela de manutenção: sábado 02h–04h.",
    createdAt: now,
    updatedAt: now,
    steps: [
      { id: crypto.randomUUID(), text: "Fazer backup completo do banco de produção", status: "completed" },
      { id: crypto.randomUUID(), text: "Rodar migrations em ambiente de staging e validar", status: "completed" },
      { id: crypto.randomUUID(), text: "Ativar modo de leitura (read-only) no app", status: "in_progress" },
      { id: crypto.randomUUID(), text: "Executar migrations em produção", status: "pending" },
      { id: crypto.randomUUID(), text: "Validar integridade dos dados pós-migração", status: "pending" },
      { id: crypto.randomUUID(), text: "Reativar escrita e monitorar por 30 minutos", status: "pending" },
      { id: crypto.randomUUID(), text: "Remover código de compatibilidade com schema antigo", status: "pending" },
    ],
  });

  return NextResponse.json({ chatId, title });
}

