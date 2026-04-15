import { NextRequest, NextResponse } from "next/server";
import { saveFeedback, getPsychologicalProfile } from "@/lib/server/psychological-profile";
import { getDb } from "@/lib/server/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      conversationId,
      messageId,
      feedback,
      feedbackText,
      userId = "test-user-001",
      skipFkCheck = false,
    } = body as {
      conversationId: string;
      messageId: string;
      feedback: "like" | "dislike" | null;
      feedbackText?: string;
      userId?: string;
      skipFkCheck?: boolean;
    };

    if (!conversationId || !messageId || !feedback) {
      return NextResponse.json(
        {
          error: "Missing required fields: conversationId, messageId, feedback",
        },
        { status: 400 },
      );
    }

    let result = null;

    if (skipFkCheck) {
      // Disable FK constraints temporarily
      const db = getDb();
      try {
        await db.query('SET CONSTRAINTS ALL DEFERRED');
        const insertResult = await db.query(
          `INSERT INTO message_feedback (message_id, conversation_id, user_id, feedback, feedback_text, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, now(), now())
           ON CONFLICT (message_id, user_id) DO UPDATE 
           SET feedback = excluded.feedback, feedback_text = excluded.feedback_text, updated_at = now()
           RETURNING *`,
          [messageId, conversationId, userId, feedback, feedbackText || null]
        );
        result = insertResult.rows[0];
        await db.query('SET CONSTRAINTS ALL IMMEDIATE');
      } catch (err) {
        // Fallback: try to disable triggers instead
        console.log('[Feedback] FK constraint failed, trying to disable triggers...');
        try {
          await db.query('ALTER TABLE message_feedback DISABLE TRIGGER ALL');
          const insertResult2 = await db.query(
            `INSERT INTO message_feedback (message_id, conversation_id, user_id, feedback, feedback_text, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, now(), now())
             ON CONFLICT (message_id, user_id) DO UPDATE 
             SET feedback = excluded.feedback, feedback_text = excluded.feedback_text, updated_at = now()
             RETURNING *`,
            [messageId, conversationId, userId, feedback, feedbackText || null]
          );
          result = insertResult2.rows[0];
          await db.query('ALTER TABLE message_feedback ENABLE TRIGGER ALL');
        } catch (err2) {
          console.error('[Feedback] Both methods failed:', err2);
          throw err; // Throw original error
        }
      }
    } else {
      // Use normal saveFeedback (requires FK constraints)
      result = await saveFeedback(
        userId,
        conversationId,
        messageId,
        feedback,
        feedbackText,
      );
    }

    // Buscar perfil atualizado
    const profile = await getPsychologicalProfile(userId);

    return NextResponse.json({
      success: true,
      feedback: result,
      profile,
    });
  } catch (error) {
    console.error("Error saving feedback:", error);
    return NextResponse.json(
      { error: "Failed to save feedback", details: String(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Test feedback endpoint - POST feedback here",
    example: {
      conversationId: "test-convo",
      messageId: "12345",
      feedback: "like",
      feedbackText: "Great!",
      userId: "test-user-001",
      skipFkCheck: true, // Set to true to skip FK validation for testing
    },
  });
}
