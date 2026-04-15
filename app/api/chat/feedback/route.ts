import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/request";
import { saveFeedback, getPsychologicalProfile } from "@/lib/server/psychological-profile";
import { appendLog } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  console.log("[Feedback] Authorization header:", authHeader);

  try {
    const user = requireUser(request);
    console.log("[Feedback] Resolved user:", user);
    if (!user) {
      console.error("Feedback endpoint: User not authenticated");
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

    console.log(`[Feedback] Saving feedback for message ${messageId} from user ${user.id}`);

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

    const response = NextResponse.json({
      success: true,
      feedback: result,
      profile,
    });
    
    // Disable caching to prevent stale feedback
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error saving feedback:", errorMessage, error);
    return NextResponse.json(
      { 
        error: "Failed to save feedback",
        details: errorMessage
      },
      { status: 500 },
    );
  }
}
