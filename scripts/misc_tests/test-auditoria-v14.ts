import "dotenv/config";
// require('dotenv').config({ path: "C:/Dev/claude-reviews-claude/.env.local" });

async function test() {
  const { listIngestionLogs } = await import("./app/lib/server/memory/repository");
  const { buildContextPack } = await import("./app/lib/server/memory/context-builder");
  
  const userId = "legacy-local";
  
  console.log(`--- Teste de Auditoria Avançada (Fase 14) ---`);
  
  console.log("\n1. Testando listagem de logs de ingestão (Governança):");
  try {
    const logs = await listIngestionLogs(userId, 5);
    console.log(`✅ Recuperados ${logs.length} logs de ingestão.`);
    if (logs.length > 0) {
      console.log(`Primeiro log: ID=${logs[0].id}, Status=${logs[0].status}, MsgId=${logs[0].messageId}`);
    }
  } catch (err) {
    console.error("❌ Falha ao listar logs de ingestão:", err);
  }

  console.log("\n2. Testando Simulador de Seleção Semântica:");
  try {
    // Simulando o que o Admin faz agora
    const res = await buildContextPack({
      userId,
      query: "Eu gosto de café",
      agentType: "coder",
      limitItems: 3
    });
    
    console.log(`✅ Simulação concluída. Itens retornados: ${res.memoryItems.length}`);
    res.memoryItems.forEach((it, idx) => {
      console.log(`   #${idx + 1} [${it.type}] Category: ${it.category} -> Content: ${it.content.substring(0, 50)}...`);
    });
    
    if (res.memoryItems.length > 0) {
      console.log("\n✅ Auditoria via API está funcional e pronta para a UI.");
    }
  } catch (err) {
    console.error("❌ Falha na simulação de contexto:", err);
  }

  console.log("\n--- Fim do Teste ---");
  process.exit(0);
}

test().catch(err => {
  console.error("❌ Erro fatal no teste:", err);
  process.exit(1);
});
