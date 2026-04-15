import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/request";
import { generateKittyInterpretation, getFeedbackHistory } from "@/lib/server/doutora-kitty";
import { getPsychologicalProfile } from "@/lib/server/psychological-profile";

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(request);
    // LOGS DE DEPURAÇÃO
    console.log("[Kitty] Authorization header:", request.headers.get("authorization"));
    console.log("[Kitty] Resolved user:", user);

    let userId = user?.id;

    // Se não estiver autenticado, usar demo-user
    if (!userId) {
      userId = "demo-user";
    }

    // Buscar perfil psicológico do usuário
    let profile = await getPsychologicalProfile(userId);

    // Se não houver perfil do usuário, tentar buscar perfil demo
    if (!profile && userId !== "demo-user") {
      profile = await getPsychologicalProfile("demo-user");
    }

    // Buscar histórico de feedback
    let feedbackHistory = await getFeedbackHistory(userId);

    // Se não houver feedback do usuário, buscar feedback demo
    if ((!feedbackHistory || (feedbackHistory.totalLikes === 0 && feedbackHistory.totalDislikes === 0)) && userId !== "demo-user") {
      feedbackHistory = await getFeedbackHistory("demo-user");
    }

    // Se ainda não houver perfil, retornar um mock
    if (!profile) {
      return NextResponse.json({
        profile: {
          userId: userId,
          tonalPreference: "balanced",
          depthPreference: "balanced",
          structurePreference: "mixed",
          pacePreference: "balanced",
          exampleType: "mixed",
          responseLength: "balanced",
          confidenceScore: 0,
          totalFeedback: 0,
          likeCount: 0,
          dislikeCount: 0,
          lastUpdated: new Date(),
        },
        summary: "👀 Ainda não tenho dados suficientes para analisar seu perfil. Deixa você dar alguns feedbacks que vou aprender!",
        strengths: ["⭐ Pode começar a dar feedback pra eu entender você melhor!"],
        suggestions: ["Dá alguns likes e dislikes em minhas respostas pra eu aprender suas preferências!"],
        preferenceInsights: {
          tonal: "📊 Sem dados ainda",
          depth: "📊 Sem dados ainda",
          structure: "📊 Sem dados ainda",
          pace: "📊 Sem dados ainda",
          exampleType: "📊 Sem dados ainda",
          responseLength: "📊 Sem dados ainda",
        },
        feedbackStats: {
          totalFeedback: 0,
          totalLikes: 0,
          totalDislikes: 0,
          likePercentage: 0,
          recentTrend: "stable" as const,
          consistencyScore: 0,
        },
      });
    }

    // Gerar interpretação
    const interpretation = await generateKittyInterpretation(
      profile,
      feedbackHistory,
    );

    const response = NextResponse.json(interpretation);
    
    // Disable caching to show updated analysis
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error("Error generating Doutora Kitty interpretation:", error);
    return NextResponse.json(
      { error: "Falha ao gerar interpretação" },
      { status: 500 },
    );
  }
}
