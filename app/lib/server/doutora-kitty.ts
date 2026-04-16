import { getDb, hasDatabase } from "./db";
import { PsychologicalProfile } from "./psychological-profile";

export type KittyInterpretation = {
  profile: PsychologicalProfile;
  summary: string;
  strengths: string[];
  suggestions: string[];
  preferenceInsights: Record<string, string>;
  feedbackStats: {
    totalFeedback: number;
    totalLikes: number;
    totalDislikes: number;
    likePercentage: number;
    recentTrend: "improving" | "stable" | "needs-work";
    consistencyScore: number; // 0-1
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
      feedback: [],
      topDislikes: [],
    };
  }

  const db = getDb();

  // Buscar últimos 100 feedbacks (com LEFT JOIN para suportardados sem mensagens vinculadas)
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

  // Top dislikes com feedback text
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
 * Gerar interpretação Doutora Kitty do perfil psicológico
 */
export async function generateKittyInterpretation(
  profile: PsychologicalProfile,
  feedbackHistory: Awaited<ReturnType<typeof getFeedbackHistory>>,
): Promise<KittyInterpretation> {
  const total = feedbackHistory.totalLikes + feedbackHistory.totalDislikes;
  const likePercentage = total > 0 ? (feedbackHistory.totalLikes / total) * 100 : 0;

  // Calcular tendência (últimos vs anteriores)
  const recent = feedbackHistory.feedback.slice(0, 10);
  const older = feedbackHistory.feedback.slice(10, 20);
  const recentLikes = recent.filter((f) => f.feedback === "like").length;
  const olderLikes = older.filter((f) => f.feedback === "like").length;
  const recentTrend = recentLikes > olderLikes ? "improving" : recentLikes === olderLikes ? "stable" : "needs-work";

  // Consistência: se sempre dá feedback no mesmo tipo (muito like ou muito dislike)
  const consistencyScore = Math.abs(likePercentage - 50) / 50;

  // Insights por preferência
  const preferenceInsights: Record<string, string> = {
    tonal:
      profile.tonalPreference === "casual"
        ? "🎨 Adorando um tom descontraído e amigável! Prefere conversas naturais."
        : profile.tonalPreference === "formal"
          ? "📋 Prefere um tom profissional e estruturado."
          : "⚖️ Gosta de um equilíbrio entre formal e casual.",

    depth:
      profile.depthPreference === "simplified"
        ? "📚 Prefere explicações claras e diretas, sem jargões técnicos."
        : profile.depthPreference === "technical"
          ? "🔬 Adora mergulhar em detalhes técnicos e conceitos profundos."
          : "🎯 Gosta de profundidade moderada com clareza.",

    structure:
      profile.structurePreference === "list"
        ? "📝 Aprecia informações em listas e bullet points."
        : profile.structurePreference === "narrative"
          ? "📖 Prefere explicações narrativas e contextualizadas."
          : "🔀 Gosta de misturar formatos conforme necessário.",

    pace:
      profile.pacePreference === "fast"
        ? "⚡ Quer respostas rápidas e concisas!"
        : profile.pacePreference === "detailed"
          ? "🐢 Aprecia explicações detalhadas e passo-a-passo."
          : "🏃 Gosta de ritmo equilibrado.",

    exampleType:
      profile.exampleType === "code"
        ? "💻 Prefere exemplos práticos em código."
        : profile.exampleType === "conceptual"
          ? "💡 Prefere conceitos e analogias para entender."
          : "🎨 Gosta de misturar código e conceitos.",

    responseLength:
      profile.responseLength === "brief"
        ? "✂️ Prefere respostas diretas e curtas."
        : profile.responseLength === "comprehensive"
          ? "📚 Adora respostas completas e detalhadas."
          : "📏 Gosta de tamanho equilibrado.",
  };

  // Pontos fortes
  const strengths = [
    profile.confidenceScore > 0.7 ? "🎯 Sabe muito bem o que quer!" : null,
    likePercentage > 70 ? "😊 Está super satisfeito com as respostas!" : null,
    profile.totalFeedback > 10
      ? "💬 Dá feedback consistente - isso ajuda muito a melhorar!"
      : null,
    total > 0 ? "⭐ Engajado em avaliar qualidade" : null,
  ].filter((s) => s !== null) as string[];

  // Sugestões
  const suggestions = [
    profile.confidenceScore < 0.5 && total > 5
      ? "Deixa eu aprender mais com seus feedbacks para ficar melhor! 🧠"
      : null,
    feedbackHistory.totalDislikes > feedbackHistory.totalLikes
      ? "Parece que tem alguns pontos que podem melhorar. Quer que eu foque em algo específico? 🎯"
      : null,
    profile.totalFeedback < 3
      ? "Puxa, tá um pouco difícil aprender sem feedbacks. Avalia mais pra eu ficar fera! 📊"
      : null,
    likePercentage > 80 ? "Que legal! Tá tudo certo. Continue assim! 🚀" : null,
  ].filter((s) => s !== null) as string[];

  const summary =
    likePercentage > 80
      ? `✨ Você é um usuário muito satisfeito! ${feedbackHistory.totalLikes} likes vs ${feedbackHistory.totalDislikes} dislikes. Tá tudo perfeito!`
      : likePercentage > 50
        ? `😊 No geral tá indo bem! ${feedbackHistory.totalLikes} likes vs ${feedbackHistory.totalDislikes} dislikes. Tem espaço pra melhorar.`
        : `🤔 Tem bastante pra melhorar. ${feedbackHistory.totalLikes} likes vs ${feedbackHistory.totalDislikes} dislikes. Vamos caprichar!`;

  return {
    profile,
    summary,
    strengths: strengths.length > 0 ? strengths : ["👀 Pode começar a dar feedback pra eu aprender mais!"],
    suggestions: suggestions.length > 0 ? suggestions : ["Tudo certo! Continue assim! 💚"],
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
