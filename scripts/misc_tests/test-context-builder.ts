import "dotenv/config";
// require('dotenv').config({ path: "C:/Dev/claude-reviews-claude/.env.local" });

async function test() {
  const { buildContextPack } = await import("./app/lib/server/memory/context-builder");
  const { insertUserMemoryItem, withMemoryTransaction } = await import("./app/lib/server/memory/repository");
  
  const userId = "legacy-local";
  
  console.log(`--- Teste de Refino de Contexto (Fase 13) ---`);
  
  // Limpeza/Preparação de dados de teste (usando um prefixo único para evitar conflitos)
  const timestamp = Date.now();
  
  console.log("\nPreparando dados de teste...");
  
  const items = [
    {
      type: "constraint",
      category: "coding",
      content: "[TESTE] Sempre use Early Returns em TypeScript",
      normalizedValue: "coding_style_" + timestamp,
      sourceConversationId: "test-conv",
      status: "active"
    },
    {
      type: "preference",
      category: "food",
      content: "[TESTE] Eu amo café espresso duplo",
      normalizedValue: "food_pref_" + timestamp,
      sourceConversationId: "test-conv",
      status: "active"
    },
    {
      type: "declared_fact",
      category: "personal",
      content: "[TESTE] Meu aniversário é em Janeiro",
      normalizedValue: "birthday_" + timestamp,
      sourceConversationId: "test-conv",
      status: "active"
    }
  ];

  await withMemoryTransaction(async (db) => {
    for (const item of items) {
      await insertUserMemoryItem({ ...item, userId } as import("./app/lib/server/memory/types").CreateUserMemoryItemInput, db);
    }
  });

  console.log("✅ Dados inseridos.");

  console.log("\n--- CENÁRIO 1: Busca por palavra-chave ('café') ---");
  const res1 = await buildContextPack({
    userId,
    query: "Eu quero um café",
    limitItems: 5
  });
  
  const top1 = res1.memoryItems[0]?.content;
  console.log(`Top item: "${top1}"`);
  if (top1?.includes("café")) {
    console.log("✅ SUCESSO: O item de café subiu no ranking pela query.");
  } else {
    console.log("❌ FALHA: O item de café não ficou em primeiro.");
  }

  console.log("\n--- CENÁRIO 2: Contexto de Agente ('coder') ---");
  const res2 = await buildContextPack({
    userId,
    agentType: "coder",
    limitItems: 5
  });
  
  const top2 = res2.memoryItems[0]?.content;
  console.log(`Top item: "${top2}"`);
  if (top2?.includes("Early Returns")) {
    console.log("✅ SUCESSO: O item de coding subiu no ranking pelo agentType.");
  } else {
    console.log("❌ FALHA: O item de coding não foi priorizado para o coder.");
  }

  console.log("\n--- CENÁRIO 3: Prioridade de Categoria ('personal') ---");
  const res3 = await buildContextPack({
    userId,
    priorityCategories: ["personal"],
    limitItems: 5
  });
  
  const top3 = res3.memoryItems[0]?.content;
  console.log(`Top item: "${top3}"`);
  if (top3?.includes("Janeiro")) {
    console.log("✅ SUCESSO: A categoria personal foi priorizada explicitamente.");
  } else {
    console.log("❌ FALHA: A categoria personal não ficou em primeiro.");
  }

  console.log("\n--- Fim do Teste ---");
  process.exit(0);
}

test().catch(err => {
  console.error("❌ Erro fatal no teste:", err);
  process.exit(1);
});
