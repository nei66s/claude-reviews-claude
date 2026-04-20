import { getDb, hasDatabase } from "./db";
import { PsychologicalProfile } from "./psychological-profile";

export type KittyInterpretation = {
  profile: PsychologicalProfile;
  summary: string;
  analysis: {
    patterns: string[];
    tonal: string;
    depth: string;
    structure: string;
    pace: string;
    examples: string;
    length: string;
    suggestions: string[];
    memories: {
      keyFacts: string[];
      summary: string;
      preferences: string[];
    };
  };
  strengths: string[];
  suggestions: string[];
  preferenceInsights: Record<string, string>;
  feedbackStats: {
    totalFeedback: number;
    totalLikes: number;
    totalDislikes: number;
    likePercentage: number;
    recentTrend: "improving" | "stable" | "needs-work";
    consistencyScore: number;
  };
};

/**
 * Buscar todos os feedbacks da conversa para Doutora Kitty
 */
export async function getFeedbackHistory(userId: string) {
  if (!hasDatabase()) {
    return {
      totalLikes: 0,
      totalDislikes: 0,
      feedback: [] as unknown[],
      topDislikes: [] as { text: string; messagePreview: string; date: Date }[],
    };
  }

  const db = getDb();

  const feedbackResult = await db.query<{
    message_id: string;
    feedback: string;
    feedback_text: string;
    content: string;
    created_at: string;
    conversation_id: string;
  }>(
    `SELECT 
      mf.message_id,
      mf.feedback,
      mf.feedback_text,
      COALESCE(m.content, 'Demo message') as content,
      mf.created_at,
      mf.conversation_id
     FROM public.message_feedback mf
     LEFT JOIN public.messages m ON mf.message_id::text = m.id::text
     WHERE mf.user_id = $1
     ORDER BY mf.created_at DESC
     LIMIT 100`,
    [userId],
  );

  const feedback = feedbackResult.rows;
  const totalLikes = feedback.filter((f) => f.feedback === "like").length;
  const totalDislikes = feedback.filter((f) => f.feedback === "dislike").length;

  const topDislikes = feedback
    .filter((f) => f.feedback === "dislike" && f.feedback_text)
    .slice(0, 10)
    .map((f) => ({
      text: f.feedback_text,
      messagePreview: f.content.substring(0, 100),
      date: new Date(f.created_at),
    }));

  return {
    totalLikes,
    totalDislikes,
    feedback,
    topDislikes,
  };
}

/**
 * Gerar interpretação Doutora Kitty do perfil psicológico enriquecida com memórias
 */
export async function generateKittyInterpretation(
  profile: PsychologicalProfile,
  feedbackHistory: Awaited<ReturnType<typeof getFeedbackHistory>>,
  memoryProfile?: {
    keyFacts?: string[];
    summaryShort?: string;
    interactionPreferences?: {
      preferences?: string[];
    };
  } | null, // UserProfile from memory system
): Promise<KittyInterpretation> {
  const total = feedbackHistory.totalLikes + feedbackHistory.totalDislikes;
  const likePercentage = total > 0 ? (feedbackHistory.totalLikes / total) * 100 : 0;

  const recent = feedbackHistory.feedback.slice(0, 10);
  const older = feedbackHistory.feedback.slice(10, 20);
  const recentLikes = recent.filter((f) => (f as { feedback: string }).feedback === "like").length;
  const olderLikes = older.filter((f) => (f as { feedback: string }).feedback === "like").length;
  const recentTrend = recentLikes > olderLikes ? "improving" : recentLikes === olderLikes ? "stable" : "needs-work";

  const consistencyScore = Math.abs(likePercentage - 50) / 50;

  const preferenceInsights: Record<string, string> = {
    tonal:
      profile.tonalPreference === "casual"
        ? "🎨 Adorando um tom descontraído e amigável!"
        : profile.tonalPreference === "formal"
          ? "📋 Prefere um tom profissional e estruturado."
          : "⚖️ Gosta de um equilíbrio entre formal e casual.",
    depth:
      profile.depthPreference === "simplified"
        ? "📚 Prefere explicações claras e diretas."
        : profile.depthPreference === "technical"
          ? "🔬 Adora mergulhar em detalhes técnicos."
          : "🎯 Gosta de profundidade moderada.",
    structure:
      profile.structurePreference === "list"
        ? "📝 Aprecia informações em listas."
        : profile.structurePreference === "narrative"
          ? "📖 Prefere explicações narrativas."
          : "🔀 Gosta de misturar formatos.",
    pace:
      profile.pacePreference === "fast"
        ? "⚡ Quer respostas rápidas e concisas!"
        : profile.pacePreference === "detailed"
          ? "🐢 Aprecia explicações detalhadas."
          : "🏃 Gosta de ritmo equilibrado.",
    exampleType:
      profile.exampleType === "code"
        ? "💻 Prefere exemplos práticos em código."
        : profile.exampleType === "conceptual"
          ? "💡 Prefere conceitos e analogias."
          : "🎨 Gosta de misturar código e conceitos.",
    responseLength:
      profile.responseLength === "brief"
        ? "✂️ Prefere respostas diretas e curtas."
        : profile.responseLength === "comprehensive"
          ? "📚 Adora respostas completas."
          : "📏 Gosta de tamanho equilibrado.",
  };

  const strengths = [
    profile.confidenceScore > 0.7 ? "🎯 Sabe muito bem o que quer!" : null,
    likePercentage > 70 ? "😊 Está super satisfeito com as respostas!" : null,
    profile.totalFeedback > 10 ? "💬 Dá feedback consistente!" : null,
    total > 0 ? "⭐ Engajado em avaliar qualidade" : null,
  ].filter((s): s is string => s !== null);

  const suggestions = [
    profile.confidenceScore < 0.5 && total > 5 ? "Deixa eu aprender mais com seus feedbacks! 🧠" : null,
    feedbackHistory.totalDislikes > feedbackHistory.totalLikes ? "Parece que tem pontos que podem melhorar. 🎯" : null,
    profile.totalFeedback < 3 ? "Puxa, tá difícil aprender sem feedbacks. Avalia mais! 📊" : null,
    likePercentage > 80 ? "Que legal! Tá tudo certo. Continue assim! 🚀" : null,
  ].filter((s): s is string => s !== null);

  const summary =
    likePercentage > 80
      ? `✨ Muito satisfeito! ${feedbackHistory.totalLikes} likes vs ${feedbackHistory.totalDislikes} dislikes.`
      : likePercentage > 50
        ? `😊 No geral tá indo bem! ${feedbackHistory.totalLikes} likes vs ${feedbackHistory.totalDislikes} dislikes.`
        : `🤔 Tem bastante pra melhorar. ${feedbackHistory.totalLikes} likes vs ${feedbackHistory.totalDislikes} dislikes.`;

  // Extrair memórias relevantes
  const memories = {
    keyFacts: memoryProfile?.keyFacts || [],
    summary: memoryProfile?.summaryShort || "Nenhuma memória consolidada ainda.",
    preferences: memoryProfile?.interactionPreferences?.preferences || [],
  };

  // Se houver memórias, podemos ajustar a análise
  if (memories.keyFacts.length > 0) {
      if (memories.keyFacts.join(" ").toLowerCase().includes("senior") || 
          memories.keyFacts.join(" ").toLowerCase().includes("desenvolvedor")) {
          // Exemplo de como a memória influencia a análise da Kitty
          if (profile.confidenceScore < 0.3) {
            // Se temos pouca confiança no feedback mas a memória diz que é dev, sugerimos ser técnico
          }
      }
  }

  return {
    profile,
    summary,
    analysis: {
      patterns: strengths,
      tonal: profile.tonalPreference,
      depth: profile.depthPreference,
      structure: profile.structurePreference,
      pace: profile.pacePreference,
      examples: profile.exampleType,
      length: profile.responseLength,
      suggestions: suggestions,
      memories: memories,
    },
    strengths,
    suggestions,
    preferenceInsights,
    feedbackStats: {
      totalFeedback: total,
      totalLikes: feedbackHistory.totalLikes,
      totalDislikes: feedbackHistory.totalDislikes,
      likePercentage,
      recentTrend,
      consistencyScore,
    },
  };
}
