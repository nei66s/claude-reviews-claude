import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/request";
import { generateKittyInterpretation, getFeedbackHistory } from "@/lib/server/doutora-kitty";
import { getPsychologicalProfile } from "@/lib/server/psychological-profile";
import { getUserProfile } from "@/lib/server/memory/repository";

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(request);
    
    let userId = user?.id;
    
    // Se não estiver autenticado, usar demo-user
    if (!userId) {
      userId = "demo-user";
    }

    // Buscar perfil psicológico do usuário (feedbacks)
    let profile = await getPsychologicalProfile(userId);

    // Buscar perfil de memória do usuário (fatos/preferências de longo prazo)
    let memoryProfile = await getUserProfile(userId);

    // Se não houver perfil do usuário, tentar buscar perfil demo
    if (!profile && userId !== "demo-user") {
      profile = await getPsychologicalProfile("demo-user");
    }
    if (!memoryProfile && userId !== "demo-user") {
      memoryProfile = await getUserProfile("demo-user");
    }

    // Buscar histórico de feedback
    let feedbackHistory = await getFeedbackHistory(userId);

    // Se não houver feedback do usuário, buscar feedback demo
    if ((!feedbackHistory || (feedbackHistory.totalLikes === 0 && feedbackHistory.totalDislikes === 0)) && userId !== "demo-user") {
      feedbackHistory = await getFeedbackHistory("demo-user");
    }

    // Se ainda não houver perfil psicométrico, mas houver memória, criamos um mock básico para o resto
    if (!profile) {
      // Mock básico
      profile = {
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
      };
    }

    // Gerar interpretação enriquecida com memórias
    const interpretation = await generateKittyInterpretation(
      profile,
      feedbackHistory,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memoryProfile as any
    );

    return NextResponse.json(interpretation);
  } catch (error) {
    console.error("Error generating Doutora Kitty interpretation:", error);
    return NextResponse.json(
      { error: "Falha ao gerar interpretação" },
      { status: 500 },
    );
  }
}
