import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/request";
import { saveFeedback, getPsychologicalProfile } from "@/lib/server/psychological-profile";
import { appendLog } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  try {
    const user = requireUser(request);
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    
    const body = await request.json();

    const {
      conversationId,
      messageId,
      feedback,
      feedbackText,
    } = body as {
      conversationId: string;
      messageId: string;
      feedback: "like" | "dislike" | null;
      feedbackText?: string;
    };

    if (!conversationId || !messageId || !feedback) {
      return NextResponse.json(
        {
          error: "Missing required fields: conversationId, messageId, feedback",
        },
        { status: 400 },
      );
    }

    // Salvar feedback
    const result = await saveFeedback(
      user.id,
      conversationId,
      messageId,
      feedback,
      feedbackText,
    );

    // Buscar perfil atualizado
    const profile = await getPsychologicalProfile(user.id);

    // Log da ação
    await appendLog(user, "info", "Feedback enviado", {
      conversationId,
      messageId,
      feedback,
      hasText: !!feedbackText,
    });

    return NextResponse.json({
      success: true,
      feedback: result,
      profile,
    });
  } catch (error) {
    console.error("Error saving feedback:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 },
    );
  }
}
