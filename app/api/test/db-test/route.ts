import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { saveFeedback, getPsychologicalProfile } from "@/lib/server/psychological-profile";

/**
 * TESTING ENDPOINT - Direct database access for persistence validation
 * This bypasses application logic to test the database layer directly
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action } = body as {
      userId: string;
      action: "create_test_data" | "test_feedback" | "check_persistence";
    };

    if (action === "create_test_data") {
      return await createTestData();
    } else if (action === "test_feedback") {
      return await testFeedback(body);
    } else if (action === "check_persistence") {
      return await checkPersistence(userId);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Test error:", error);
    return NextResponse.json(
      { error: "Test failed", details: String(error).substring(0, 200) },
      { status: 500 },
    );
  }
}

async function createTestData() {
  const db = getDb();
  const userId = "test-user-" + Date.now();
  const conversationId = "test-conv-" + Date.now();

  try {
    // Create user
    await db.query(
      `INSERT INTO app_users (id, email, display_name, password_hash, created_at) 
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`, "Test User", "test_hash"]
    );

    // Try to create conversation based on actual schema
    // First, check what columns conversations table has
    const convCheckResult = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations'`
    );

    console.log(
      "[CreateTestData] Conversations table columns:",
      convCheckResult.rows.map((r) => r.column_name)
    );

    return NextResponse.json({
      success: true,
      userId,
      conversationId,
      message:
        "Test user created. Conversations table schema retrieved - check logs.",
    });
  } catch (error) {
    throw error;
  }
}

async function testFeedback(body: any) {
  const { userId } = body;
  const db = getDb();
  const messageId = Math.floor(Math.random() * 1000000);
  const conversationId = "test-conv-direct";

  try {
    // Attempt 1: Try normal insert
    console.log("[TestFeedback] Attempting direct insert...");
    const result = await db.query(
      `INSERT INTO message_feedback (message_id, conversation_id, user_id, feedback, feedback_text, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (message_id, user_id) DO UPDATE
       SET feedback = excluded.feedback, updated_at = now()
       RETURNING *`,
      [messageId, conversationId, userId || "test-user-001", "like", "Test feedback"]
    );

    console.log("[TestFeedback] Insert successful!");
    return NextResponse.json({
      success: true,
      messageId,
      result: result.rows[0],
    });
  } catch (error: any) {
    if (error.message.includes("foreign key constraint")) {
      console.log(
        "[TestFeedback] FK constraint hit - tables may not be linked properly"
      );

      // Try to check what tables exist
      const tableCheck = await db.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name IN ('messages', 'conversations', 'app_users')`
      );

      console.log(
        "[TestFeedback] Existing tables:",
        tableCheck.rows.map((r) => r.table_name)
      );
    }
    throw error;
  }
}

async function checkPersistence(userId: string) {
  try {
    // Check if user has any feedback
    const profile = await getPsychologicalProfile(userId || "test-user-001");

    return NextResponse.json({
      success: true,
      profile,
      message: "Persistence check complete",
    });
  } catch (error) {
    throw error;
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Database persistence test endpoint",
    actions: {
      create_test_data: "Set up test user and check schema",
      test_feedback: "Attempt to insert feedback directly",
      check_persistence: "Query user psychological profile",
    },
  });
}
