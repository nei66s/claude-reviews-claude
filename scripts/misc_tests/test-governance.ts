import "dotenv/config";
// require('dotenv').config({ path: "C:/Dev/claude-reviews-claude/.env.local" });

async function test() {
  // Import dinâmico para garantir que o dotenv carregou antes de qualquer inicialização de repository
  const { orchestrateMemoryCandidates } = await import("./app/lib/server/memory/orchestrator");
  
  const userId = "legacy-local";
  const messageId = 1;
  
  console.log(`--- Teste de Governança do Memory Orchestrator (Fase 12) ---`);
  console.log(`User: ${userId}`);
  console.log(`Message ID: ${messageId}`);

  const candidate = {
    type: "declared_fact",
    category: "preference",
    content: "O usuário gosta de café forte",
    normalizedValue: "preferencia_cafe_forte_" + Date.now(),
    sourceConversationId: "test-conv-" + Date.now(),
    sourceMessageId: messageId,
    confidenceScore: 0.9,
    relevanceScore: 0.8
  };

  try {
    console.log("\n1. Primeira tentativa:");
    const res1 = await orchestrateMemoryCandidates({
      userId,
      candidates: [candidate as import("./app/lib/server/memory/extractor").ExtractedCandidate],
      reason: "test_governance_first"
    });
    
    console.log(`Resultado 1: ${res1.skippedDuplicates === 0 ? "✅ Processado" : "ℹ️ Já existia log anterior (esperado se rodar repetidas vezes)"}`);
    console.log(`Inserted:`, res1.inserted);

    console.log("\n2. Segunda tentativa (DEVE ignorar pelo messageId):");
    const res2 = await orchestrateMemoryCandidates({
      userId,
      candidates: [candidate as import("./app/lib/server/memory/extractor").ExtractedCandidate],
      reason: "test_governance_second"
    });
    
    console.log(`Resultado 2: ${res2.skippedDuplicates === 1 ? "✅ SUCESSO (Mensagem bloqueada por governança)" : "❌ FALHA (Permitiu reprocessar!)"}`);
    console.log(`Skipped: ${res2.skippedDuplicates}`);

    console.log("\n--- Fim do Teste ---");
  } catch (err) {
    console.error("❌ Erro durante a execução do teste:", err);
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error("❌ Erro fatal no teste:", err);
  process.exit(1);
});
