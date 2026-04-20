import { getDb, hasDatabase } from "./db";

export type FeedbackType = "like" | "dislike" | null;

const TONAL_PREFERENCES = ["formal", "casual", "balanced"] as const;
const DEPTH_PREFERENCES = ["simplified", "technical", "balanced"] as const;
const STRUCTURE_PREFERENCES = ["narrative", "list", "mixed"] as const;
const PACE_PREFERENCES = ["fast", "detailed", "balanced"] as const;
const EXAMPLE_TYPES = ["code", "conceptual", "mixed"] as const;
const RESPONSE_LENGTHS = ["brief", "comprehensive", "balanced"] as const;

function coerceEnum<TAllowed extends readonly string[]>(
  value: string,
  allowed: TAllowed,
  fallback: TAllowed[number],
): TAllowed[number] {
  return (allowed as readonly string[]).includes(value) ? (value as TAllowed[number]) : fallback;
}

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

  await db.query(
    `INSERT INTO public.message_feedback (message_id, conversation_id, user_id, feedback, feedback_text)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (message_id, user_id) DO UPDATE SET
       feedback = $4,
       feedback_text = $5,
       updated_at = NOW()`,
    [messageId, conversationId, userId, feedback, feedbackText || null],
  );

  // Atualizar perfil psicológico
  await updatePsychologicalProfile(userId);

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
    m_content: string;
  }>(
    `SELECT 
      mf.feedback,
      mf.feedback_text,
      m.content as m_content
     FROM public.message_feedback mf
     LEFT JOIN public.messages m ON mf.message_id::text = m.id::text
     WHERE mf.user_id = $1
     ORDER BY mf.created_at DESC
     LIMIT 50`,
    [userId],
  );

  const feedbacks = feedbackResult.rows;
  const likeCount = feedbacks.filter((f) => f.feedback === "like").length;
  const dislikeCount = feedbacks.filter((f) => f.feedback === "dislike").length;
  const totalFeedback = feedbacks.length;

  // Analisar padrões (análise simples baseada em heurística)
  const profile = analyzePatterns(feedbacks, likeCount, dislikeCount, totalFeedback);

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
    tonalPreference: coerceEnum(row.tonal_preference, TONAL_PREFERENCES, "balanced"),
    depthPreference: coerceEnum(row.depth_preference, DEPTH_PREFERENCES, "balanced"),
    structurePreference: coerceEnum(row.structure_preference, STRUCTURE_PREFERENCES, "mixed"),
    pacePreference: coerceEnum(row.pace_preference, PACE_PREFERENCES, "balanced"),
    exampleType: coerceEnum(row.example_type, EXAMPLE_TYPES, "mixed"),
    responseLength: coerceEnum(row.response_length, RESPONSE_LENGTHS, "balanced"),
    confidenceScore: row.confidence_score,
    totalFeedback: row.total_feedback,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count,
    lastUpdated: new Date(row.updated_at),
  };
}

/**
 * Analisar padrões de feedback
 */
function analyzePatterns(
  feedbacks: Array<{ feedback: string; feedback_text: string; m_content: string }>,
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
