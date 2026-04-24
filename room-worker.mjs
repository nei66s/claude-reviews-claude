
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/agent-room/generate';
const WORKER_KEY = 'pimpotasma-secret-worker-key';

async function tick() {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-key': WORKER_KEY
      },
      body: JSON.stringify({ 
        activeAgents: ['chocks', 'betinha', 'pimpim', 'chubaka'],
        lowPriority: true 
      })
    });

    const data = await res.json();
    if (data.skipped) {
      console.log('[RoomWorker] Skipping: ' + data.reason);
    } else if (data.content) {
      console.log(`[RoomWorker] Generated (${data.agentId}): ${data.content.slice(0, 40)}...`);
    } else {
      console.log('[RoomWorker] Unexpected response:', data);
    }
  } catch (err) {
    console.error('[RoomWorker] Request failed:', err.message);
  }
}

console.log('🚀 Agent Room Background Worker Started');
console.log('Interval: 20 seconds');

// Executa geração a cada 20 segundos
setInterval(tick, 20000);

// Novo: Injeta notícias/fofocas a cada 2.5 minutos
async function injectNews() {
  try {
    const res = await fetch('http://localhost:3000/api/agent-room/news/inject', {
      method: 'POST',
      headers: { 'x-worker-key': WORKER_KEY }
    });
    const data = await res.json();
    console.log('[RoomWorker] News Injected:', data.topic);
  } catch (err) {
    console.error('[RoomWorker] News failed:', err.message);
  }
}

setInterval(injectNews, 150000);

// Novo: Gerencia ocupação (quem entra e sai) a cada 3.5 minutos
async function manageOccupancy() {
  try {
    const res = await fetch('http://localhost:3000/api/agent-room/occupancy', {
      method: 'POST',
      headers: { 'x-worker-key': WORKER_KEY }
    });
    const data = await res.json();
    if (data.message) console.log('[RoomWorker] Occupancy:', data.message);
  } catch (err) {
    console.error('[RoomWorker] Occupancy failed:', err.message);
  }
}

setInterval(manageOccupancy, 210000);

// Executa o primeiro imediatamente após o boot (com delay para o server subir)
setTimeout(tick, 5000);
setTimeout(injectNews, 10000); // Primeira fofoca logo no início
setTimeout(manageOccupancy, 20000); // Primeira entrada/saída
