export async function GET() {
  const hasDatabaseUrl = !!process.env.DATABASE_URL?.trim();
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY?.trim();
  return Response.json({
    ok: hasDatabaseUrl,
    database: hasDatabaseUrl ? "configured" : "missing",
    openai: hasOpenAiKey ? "configured" : "missing",
  });
}
