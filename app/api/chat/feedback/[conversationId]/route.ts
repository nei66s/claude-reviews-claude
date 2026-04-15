import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/request";
import { getDb, hasDatabase } from "@/lib/server/db";

/**
 * GET /api/chat/feedback/[conversationId]
 * 
 * Carrega todos os feedbacks do usuário para uma conversa específica
 * Retorna um mapa de messageId -> feedback
 * 
 * Estrutura: usuário > conversa > mensagens > feedbacks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = requireUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { conversationId } = await params;

    if (!conversationId?.trim()) {
      return NextResponse.json(
        { error: "conversationId required" },
        { status: 400 },
      );
    }

    if (!hasDatabase()) {
      // Sem banco, retorna objeto vazio
      return NextResponse.json({ feedbacks: {} });
    }

    const db = getDb();

    // Buscar todos os feedbacks do usuário para esta conversa
    const result = await db.query<{
      message_id: string;
      message_number: number | null;
      feedback: string;
      feedback_text: string | null;
    }>(
      `SELECT 
        mf.message_id,
        mf.message_number,
        mf.feedback,
        mf.feedback_text
       FROM public.message_feedback mf
       WHERE mf.conversation_id = $1 AND mf.user_id = $2
       ORDER BY mf.created_at DESC`,
      [conversationId, user.id],
    );

    // Mapear feedbacks por messageId e messageNumber
    const feedbacks: Record<
      string,
      {
        feedback: "like" | "dislike" | null;
        feedbackText?: string;
      }
    > = {};

    console.log(`[Feedback] Fetching feedbacks for conversation ${conversationId}, user ${user.id}. Found ${result.rows.length} records.`);

    for (const row of result.rows) {
      const feedback = {
        feedback: row.feedback as "like" | "dislike" | null,
        feedbackText: row.feedback_text || undefined,
      };
      
      console.log(`[Feedback] Record: messageId=${row.message_id}, messageNumber=${row.message_number}, feedback=${row.feedback}`);

      // Mapear por ambos message_id e message_number para máxima compatibilidade
      if (row.message_id) {
        feedbacks[row.message_id] = feedback;
      }
      if (row.message_number) {
        feedbacks[String(row.message_number)] = feedback;
      }
    }

    const response = NextResponse.json({ feedbacks });
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching conversation feedback:", errorMessage, error);
    return NextResponse.json(
      {
        error: "Failed to fetch feedback",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
