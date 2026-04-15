import { getDb, hasDatabase } from "./db";
import { callOpenAI } from "./openai";

export type FeedbackType = "like" | "dislike" | null;

export type PsychologicalProfile = {
  userId: string;
  tonalPreference: "formal" | "casual" | "balanced"; // Preferência de tom
  depthPreference: "simplified" | "technical" | "balanced"; // Nível de detalhe
  structurePreference: "narrative" | "list" | "mixed"; // Formato de resposta
  pacePreference: "fast" | "detailed" | "balanced"; // Velocidade
  exampleType: "code" | "conceptual" | "mixed"; // Tipo de exemplo
  responseLength: "brief" | "comprehensive" | "balanced"; // Tamanho da resposta
  confidenceScore: number; // 0-1: confiança na análise
  totalFeedback: number;
  likeCount: number;
  dislikeCount: number;
  lastUpdated: Date;
};

export type MessageFeedback = {
  messageId: string;
  conversationId: string;
  userId: string;
  feedback: FeedbackType;
  feedbackText?: string;
  createdAt: Date;
  retryCount?: number;
};

/**
 * Salvar feedback de uma mensagem
 */
export async function saveFeedback(
  userId: string,
  conversationId: string,
  messageId: string,
  feedback: FeedbackType,
  feedbackText?: string,
): Promise<MessageFeedback> {
  if (!hasDatabase()) {
    // Local storage fallback
    return {
      messageId,
      conversationId,
      userId,
      feedback,
      feedbackText,
      createdAt: new Date(),
    };
  }

  const db = getDb();

  // Tentar obter o message_number (ID numérico da mensagem)
  // Se messageId é numérico (string que parece número), usar diretamente
  let messageNumber: number | null = null;
  
  if (/^\d+$/.test(messageId)) {
    // messageId é numérico
    messageNumber = parseInt(messageId, 10);
  }

  // Salvar feedback com message_id (texto) e message_number (numérico se disponível)
  await db.query(
    `INSERT INTO public.message_feedback (message_id, message_number, conversation_id, user_id, feedback, feedback_text)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (message_id, user_id) DO UPDATE SET
       message_number = $2,
       feedback = $5,
       feedback_text = $6,
       updated_at = NOW()`,
    [messageId, messageNumber, conversationId, userId, feedback, feedbackText || null],
  );

  // Atualizar perfil psicológico
  await updatePsychologicalProfile(userId);

  console.log(`[Feedback] Saved: messageId=${messageId}, messageNumber=${messageNumber}, feedback=${feedback}`);

  return {
    messageId,
    conversationId,
    userId,
    feedback,
    feedbackText,
    createdAt: new Date(),
  };
}

/**
 * Analisar padrões de feedback e atualizar perfil
 */
export async function updatePsychologicalProfile(
  userId: string,
): Promise<PsychologicalProfile> {
  if (!hasDatabase()) {
    return getMockProfile(userId);
  }

  const db = getDb();

  // Pegar últimos 50 feedbacks
  const feedbackResult = await db.query<{
    feedback: string;
    feedback_text: string;
  }>(
    `SELECT 
      mf.feedback,
      mf.feedback_text
     FROM public.message_feedback mf
     WHERE mf.user_id = $1
     ORDER BY mf.created_at DESC
     LIMIT 50`,
    [userId],
  );

  const feedbacks = feedbackResult.rows;
  const likeCount = feedbacks.filter((f) => f.feedback === "like").length;
  const dislikeCount = feedbacks.filter((f) => f.feedback === "dislike").length;
  const totalFeedback = feedbacks.length;

  // Analisar padrões com OpenAI se houver feedback
  const profile = totalFeedback > 0 
    ? await analyzeWithOpenAI(feedbacks, likeCount, dislikeCount, totalFeedback)
    : analyzePatterns(feedbacks, likeCount, dislikeCount, totalFeedback);

  // Salvar no banco
  if (totalFeedback > 0) {
    await db.query(
      `INSERT INTO public.user_psychological_profiles (user_id, tonal_preference, depth_preference, structure_preference, pace_preference, example_type, response_length, confidence_score, total_feedback, like_count, dislike_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id) DO UPDATE SET
         tonal_preference = $2,
         depth_preference = $3,
         structure_preference = $4,
         pace_preference = $5,
         example_type = $6,
         response_length = $7,
         confidence_score = $8,
         total_feedback = $9,
         like_count = $10,
         dislike_count = $11,
         updated_at = NOW()`,
      [
        userId,
        profile.tonalPreference,
        profile.depthPreference,
        profile.structurePreference,
        profile.pacePreference,
        profile.exampleType,
        profile.responseLength,
        profile.confidenceScore,
        totalFeedback,
        likeCount,
        dislikeCount,
      ],
    );
  }

  return {
    ...profile,
    userId,
    lastUpdated: new Date(),
  };
}

/**
 * Buscar perfil psicológico do usuário
 */
export async function getPsychologicalProfile(
  userId: string,
): Promise<PsychologicalProfile | null> {
  if (!hasDatabase()) {
    return getMockProfile(userId);
  }

  const db = getDb();

  const result = await db.query<{
    tonal_preference: string;
    depth_preference: string;
    structure_preference: string;
    pace_preference: string;
    example_type: string;
    response_length: string;
    confidence_score: number;
    total_feedback: number;
    like_count: number;
    dislike_count: number;
    updated_at: string;
  }>(
    `SELECT tonal_preference, depth_preference, structure_preference, pace_preference, example_type, response_length, confidence_score, total_feedback, like_count, dislike_count, updated_at
     FROM public.user_psychological_profiles
     WHERE user_id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    userId,
    tonalPreference: row.tonal_preference as any,
    depthPreference: row.depth_preference as any,
    structurePreference: row.structure_preference as any,
    pacePreference: row.pace_preference as any,
    exampleType: row.example_type as any,
    responseLength: row.response_length as any,
    confidenceScore: row.confidence_score,
    totalFeedback: row.total_feedback,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count,
    lastUpdated: new Date(row.updated_at),
  };
}

/**
 * Analisar padrões com OpenAI
 */
async function analyzeWithOpenAI(
  feedbacks: Array<{ feedback: string; feedback_text: string }>,
  likeCount: number,
  dislikeCount: number,
  totalFeedback: number,
): Promise<Omit<PsychologicalProfile, "userId" | "lastUpdated">> {
  if (totalFeedback === 0) {
    return {
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
    };
  }

  try {
    const dislikeFeedbacks = feedbacks
      .filter((f) => f.feedback === "dislike" && f.feedback_text)
      .map((f) => f.feedback_text);

    const prompt = `Você é um analista de psicologia digital. Baseado no seguinte feedback de um usuário, determine suas preferências:

Estatísticas:
- Total de feedbacks: ${totalFeedback}
- Likes: ${likeCount}
- Dislikes: ${dislikeCount}
- Taxa de satisfação: ${((likeCount / totalFeedback) * 100).toFixed(0)}%

Feedback negativo (dislikes com explicações):
${dislikeFeedbacks.length > 0 ? dislikeFeedbacks.map((f, i) => `${i + 1}. "${f}"`).join("\n") : "Nenhum feedback negativo com explicação"}

Baseado nisso, retorne um JSON com as preferências do usuário:
{
  "tonalPreference": "formal" | "casual" | "balanced",
  "depthPreference": "simplified" | "technical" | "balanced",
  "structurePreference": "narrative" | "list" | "mixed",
  "pacePreference": "fast" | "detailed" | "balanced",
  "exampleType": "code" | "conceptual" | "mixed",
  "responseLength": "brief" | "comprehensive" | "balanced",
  "reasoning": "Breve explicação"
}

Retorne APENAS o JSON, sem markdown.`;

    const response = await callOpenAI(prompt, 0.7);

    // Parse JSON response
    let profile;
    try {
      profile = JSON.parse(response);
    } catch {
      // Se falhar parse, usar heurística
      return analyzePatterns(feedbacks, likeCount, dislikeCount, totalFeedback);
    }

    // Confiança aumenta com mais feedback e análise OpenAI
    const confidenceScore = Math.min((totalFeedback + 5) / 25, 1);

    return {
      tonalPreference: profile.tonalPreference || "balanced",
      depthPreference: profile.depthPreference || "balanced",
      structurePreference: profile.structurePreference || "mixed",
      pacePreference: profile.pacePreference || "balanced",
      exampleType: profile.exampleType || "mixed",
      responseLength: profile.responseLength || "balanced",
      confidenceScore,
      totalFeedback,
      likeCount,
      dislikeCount,
    };
  } catch (error) {
    console.error("Error analyzing profile with OpenAI:", error);
    // Fallback para heurística
    return analyzePatterns(feedbacks, likeCount, dislikeCount, totalFeedback);
  }
}

/**
 * Analisar padrões de feedback
 */
function analyzePatterns(
  feedbacks: Array<{ feedback: string; feedback_text: string }>,
  likeCount: number,
  dislikeCount: number,
  totalFeedback: number,
): Omit<PsychologicalProfile, "userId" | "lastUpdated"> {
  if (totalFeedback === 0) {
    return {
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
    };
  }

  // Calcular taxa de satisfação
  const satisfactionRate = likeCount / totalFeedback;

  // Análise heurística baseada em feedback_text
  let tonalPreference: "formal" | "casual" | "balanced" = "balanced";
  let depthPreference: "simplified" | "technical" | "balanced" = "balanced";
  let structurePreference: "narrative" | "list" | "mixed" = "mixed";
  let pacePreference: "fast" | "detailed" | "balanced" = "balanced";
  let exampleType: "code" | "conceptual" | "mixed" = "mixed";
  let responseLength: "brief" | "comprehensive" | "balanced" = "balanced";

  // Analisar texto dos dislikes
  const dislikeFeedbacks = feedbacks
    .filter((f) => f.feedback === "dislike")
    .map((f) => f.feedback_text?.toLowerCase() || "");

  // Analisar preferências baseado em padrões
  if (dislikeFeedbacks.join(" ").includes("formal")) {
    tonalPreference = "casual";
  } else if (dislikeFeedbacks.join(" ").includes("casual")) {
    tonalPreference = "formal";
  }

  if (
    dislikeFeedbacks.join(" ").includes("complexo") ||
    dislikeFeedbacks.join(" ").includes("muito técnico")
  ) {
    depthPreference = "simplified";
  } else if (
    dislikeFeedbacks.join(" ").includes("simpl") ||
    dislikeFeedbacks.join(" ").includes("superficial")
  ) {
    depthPreference = "technical";
  }

  if (
    dislikeFeedbacks.join(" ").includes("lista") ||
    dislikeFeedbacks.join(" ").includes("bullet")
  ) {
    structurePreference = "narrative";
  } else if (
    dislikeFeedbacks.join(" ").includes("narrativa") ||
    dislikeFeedbacks.join(" ").includes("parágrafo")
  ) {
    structurePreference = "list";
  }

  if (
    dislikeFeedbacks.join(" ").includes("rápido") ||
    dislikeFeedbacks.join(" ").includes("curto")
  ) {
    pacePreference = "detailed";
  } else if (
    dislikeFeedbacks.join(" ").includes("longo") ||
    dislikeFeedbacks.join(" ").includes("detalhado")
  ) {
    pacePreference = "fast";
  }

  if (
    dislikeFeedbacks.join(" ").includes("código") ||
    dislikeFeedbacks.join(" ").includes("código")
  ) {
    exampleType = "conceptual";
  } else if (dislikeFeedbacks.join(" ").includes("conceitual")) {
    exampleType = "code";
  }

  if (
    dislikeFeedbacks.join(" ").includes("longo") ||
    dislikeFeedbacks.join(" ").includes("muito texto")
  ) {
    responseLength = "brief";
  } else if (
    dislikeFeedbacks.join(" ").includes("breve") ||
    dislikeFeedbacks.join(" ").includes("curto")
  ) {
    responseLength = "comprehensive";
  }

  // Confiança aumenta com mais feedback
  const confidenceScore = Math.min(totalFeedback / 20, 1);

  return {
    tonalPreference,
    depthPreference,
    structurePreference,
    pacePreference,
    exampleType,
    responseLength,
    confidenceScore,
    totalFeedback,
    likeCount,
    dislikeCount,
  };
}

/**
 * Mock profile para quando não há banco de dados
 */
function getMockProfile(userId: string): PsychologicalProfile {
  return {
    userId,
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

/**
 * Gerar instrução de prompt baseado no perfil
 */
export function generateProfilePrompt(profile: PsychologicalProfile): string {
  if (profile.totalFeedback === 0) {
    return "";
  }

  const parts: string[] = [];

  parts.push("## Preferências do usuário (baseado em histórico)");

  if (profile.tonalPreference === "formal") {
    parts.push("- Usar tom formal e profissional");
  } else if (profile.tonalPreference === "casual") {
    parts.push("- Usar tom casual e amigável");
  }

  if (profile.depthPreference === "simplified") {
    parts.push("- Explicar de forma simplificada e acessível");
  } else if (profile.depthPreference === "technical") {
    parts.push("- Aprofundar em detalhes técnicos");
  }

  if (profile.structurePreference === "list") {
    parts.push("- Usar listas e bullet points");
  } else if (profile.structurePreference === "narrative") {
    parts.push("- Usar formato narrativo e em parágrafo");
  }

  if (profile.pacePreference === "fast") {
    parts.push("- Ser conciso e ir direto ao ponto");
  } else if (profile.pacePreference === "detailed") {
    parts.push("- Ser detalhado e explorar todos os ângulos");
  }

  if (profile.exampleType === "code") {
    parts.push("- Fornecer exemplos de código quando possível");
  } else if (profile.exampleType === "conceptual") {
    parts.push("- Focar em conceitos e explicações teóricas");
  }

  if (profile.responseLength === "brief") {
    parts.push("- Manter respostas breves e objetivas");
  } else if (profile.responseLength === "comprehensive") {
    parts.push("- Fornecer respostas completas e abrangentes");
  }

  return parts.join("\n");
}
