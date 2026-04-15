import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const userId = "test-user-" + Date.now();
    const conversationId = "test-convo-" + Date.now();

    console.log(`[Setup] Creating user: ${userId}`);

    // 1. Create app user  
    await db.query(
      `INSERT INTO app_users (id, email, display_name, password_hash, created_at) 
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`, "Test User", "dummy_hash"]
    );

    console.log(`[Setup] Created user, now creating messages...`);

    // 2. Create messages without conversation (if conversations table has different schema)
    // First, try to insert directly without user_id
    const messages = [];
    try {
      for (let i = 0; i < 3; i++) {
        const result = await db.query(
          `INSERT INTO messages (conversation_id, sender_type, sender_name, content, created_at) 
           VALUES ($1, $2, $3, $4, now())
           RETURNING id`,
          [conversationId, "agent", "Chocks", `Test message ${i + 1}`]
        );
        if (result.rows.length > 0) {
          messages.push(result.rows[0].id);
        }
      }
    } catch (msgErr) {
      console.log(`[Setup] Message creation failed (may need existing conversation):`, String(msgErr).substring(0, 100));
      // Continue anyway - we'll test with what we have
    }

    console.log(`[Setup] Created ${messages.length} messages`);

    return NextResponse.json({
      success: true,
      testData: {
        userId,
        conversationId,
        messageIds: messages,
      },
      message: `Test data created. ${messages.length} messages created for feedback testing.`,
    });
  } catch (error) {
    console.error("Error creating test data:", error);
    return NextResponse.json(
      { error: "Failed to create test data", details: String(error).substring(0, 200) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to create test user and messages",
    usage: "Use returned IDs for feedback testing",
  });
}
