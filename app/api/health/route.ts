export async function GET() {
  const hasDatabaseUrl = !!process.env.DATABASE_URL?.trim();
  return Response.json({
    ok: hasDatabaseUrl,
    database: hasDatabaseUrl ? "configured" : "missing",
  });
}
