
// Mock do histórico para testar a lógica de turno
const mockHistory = [
  { agentId: "chocks", role: "agent", content: "oi" },
  { agentId: "system", role: "system", content: "Notícia 1" },
  { agentId: "system", role: "system", content: "Evento 1" }
];

function testTurnTaking(selectedAgentId: string, history: any[]) {
  console.log(`\nTestando: Agente ${selectedAgentId} tentando falar...`);
  
  // Lógica que implementamos no servidor:
  const agentHistory = history.filter(m => m.role !== "system" && m.agentId !== "system");
  const lastSpeaker = agentHistory.length > 0 ? agentHistory[agentHistory.length - 1].agentId : null;

  console.log("Histórico filtrado (só agentes):", agentHistory.map(m => m.agentId));
  console.log("Último orador detectado:", lastSpeaker);

  if (selectedAgentId === lastSpeaker) {
    console.log("❌ REJEITADO: Monólogo detectado!");
    return false;
  } else {
    console.log("✅ PERMITIDO: Pode falar.");
    return true;
  }
}

// Teste 1: Chocks tentando falar após ele mesmo (com lixo de sistema no meio)
const t1 = testTurnTaking("chocks", mockHistory);

// Teste 2: Betinha tentando falar após o Chocks
const t2 = testTurnTaking("betinha", mockHistory);

// TESTE DO LOOP DE TÓPICOS
function testLoopDetection(text: string) {
  console.log("\nTestando Loop de Tópico no texto:", text);
  const loops = ["lâmpada", "sótão", "consertar"].filter(word => text.toLowerCase().split(word).length > 2);
  if (loops.length > 0) {
    console.log(`❌ LOOP DETECTADO: ${loops.join(", ")}`);
  } else {
    console.log("✅ TEXTO LIMPO");
  }
}

testLoopDetection("A lâmpada queimou de novo. Alguém viu a lâmpada? Precisamos trocar essa lâmpada!");
testLoopDetection("O que acham de jantar hoje?");
