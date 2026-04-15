import { NextRequest, NextResponse } from "next/server";
import { getDb, hasDatabase } from "@/lib/server/db";

/**
 * Endpoint para popular dados mock de feedback para Doutora Kitty
 * Apenas para desenvolvimento/demo
 */
export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json(
        { error: "Banco de dados não disponível" },
        { status: 500 },
      );
    }

    const db = getDb();
    // Use a shared demo user ID that all accounts can use
    const userId = "demo-user";

    // 0. Ensure user exists
    const userRes = await db.query(
      `SELECT id FROM public.app_users WHERE id = $1`,
      [userId],
    );

    if (userRes.rows.length === 0) {
      await db.query(
        `INSERT INTO public.app_users (id, display_name, created_at, updated_at) 
         VALUES ($1, $2, NOW(), NOW())`,
        [userId, "Demo User"],
      );
    }

    // 1. Create feedback table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.message_feedback (
        id BIGSERIAL PRIMARY KEY,
        message_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
        feedback TEXT NOT NULL CHECK (feedback IN ('like', 'dislike', 'neutral')),
        feedback_text TEXT,
        retry_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(message_id, user_id)
      )
    `);

    // 2. Create profile table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.user_psychological_profiles (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
        tonal_preference TEXT NOT NULL DEFAULT 'balanced',
        depth_preference TEXT NOT NULL DEFAULT 'balanced',
        structure_preference TEXT NOT NULL DEFAULT 'mixed',
        pace_preference TEXT NOT NULL DEFAULT 'balanced',
        example_type TEXT NOT NULL DEFAULT 'mixed',
        response_length TEXT NOT NULL DEFAULT 'balanced',
        confidence_score DECIMAL(3, 2) NOT NULL DEFAULT 0.0,
        total_feedback INT NOT NULL DEFAULT 0,
        like_count INT NOT NULL DEFAULT 0,
        dislike_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 3. Insert sample feedbacks
    const feedbacks = [
      { feedback: "like", text: null },
      { feedback: "like", text: null },
      { feedback: "like", text: "Gostei do tom" },
      { feedback: "dislike", text: "Muito formal, prefiro casual" },
      { feedback: "like", text: null },
      { feedback: "like", text: null },
      { feedback: "dislike", text: "Muito longo" },
      { feedback: "dislike", text: "Muito técnico" },
      { feedback: "like", text: "Resposta rápida e direta" },
      { feedback: "like", text: null },
    ];

    let insertedCount = 0;
    for (let i = 0; i < feedbacks.length; i++) {
      const result = await db.query(
        `INSERT INTO public.message_feedback (message_id, conversation_id, user_id, feedback, feedback_text, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [null, "demo-conv-1", userId, feedbacks[i].feedback, feedbacks[i].text],
      );
      if (result.rowCount != null && result.rowCount > 0) insertedCount++;
    }

    // 4. Upsert psychological profile
    await db.query(
      `INSERT INTO public.user_psychological_profiles 
       (user_id, tonal_preference, depth_preference, structure_preference, pace_preference, example_type, response_length, confidence_score, total_feedback, like_count, dislike_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
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
        "casual",
        "simplified",
        "mixed",
        "balanced",
        "mixed",
        "brief",
        0.65,
        10,
        6,
        4,
      ],
    );

    return NextResponse.json({
      success: true,
      message: "Seed data populated successfully",
      feedbackCount: insertedCount,
      profileUpdated: true,
    });
  } catch (error) {
    console.error("Error in seed endpoint:", error);
    return NextResponse.json(
      { error: String(error), message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
