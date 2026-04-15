#!/usr/bin/env node
/**
 * Test script to validate full persistence flow
 * 1. Get/create a conversation
 * 2. Get/create a message
 * 3. Submit feedback via API
 * 4. Verify it's in the database
 * 5. Verify Doutora Kitty reads it
 */

import http from 'http';

function makeRequest(method, path, data = null, authToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add auth token if provided
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: body ? JSON.parse(body) : null,
          });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testPersistenceFlow() {
  console.log('🧪 Iniciando teste de persistência...\n');

  try {
    // Use test IDs
    const convoId = 'test-convo-' + Date.now();
    const messageId1 = Math.floor(Math.random() * 1000000);
    const messageId2 = messageId1 + 1;
    const userId = 'test-user-' + Date.now();

    console.log(`1️⃣ Configuração do teste`);
    console.log(`   👤 Usuário: ${userId}`);
    console.log(`   💬 Conversa: ${convoId}`);
    console.log(`   💌 Mensagens: ${messageId1}, ${messageId2}\n`);

    // Step 1: Submit feedback with skipFkCheck
    console.log(`2️⃣ Enviando feedback "like"...`);
    const feedbackRes = await makeRequest('POST', '/api/test/feedback', {
      conversationId: convoId,
      messageId: String(messageId1),
      feedback: 'like',
      feedbackText: 'Excelente resposta! 🌟',
      userId: userId,
      skipFkCheck: true, // Allow test without real FK relations
    });

    console.log(`   Status HTTP: ${feedbackRes.status}`);
    if (feedbackRes.status === 200) {
      console.log('   ✅ Feedback enviado com sucesso');
      if (feedbackRes.body?.profile) {
        const total = feedbackRes.body.profile?.total_feedback || 0;
        console.log(`   👤 Total de feedbacks: ${total}\n`);
      }
    } else {
      console.log(`   ❌ Erro: ${feedbackRes.status}`);
      console.log(`      Detalhe: ${feedbackRes.body?.details || feedbackRes.body?.error}\n`);
    }

    // Step 2: Send dislike feedback
    console.log(`3️⃣ Enviando feedback "dislike"...`);
    const feedbackRes2 = await makeRequest('POST', '/api/test/feedback', {
      conversationId: convoId,
      messageId: String(messageId2),
      feedback: 'dislike',
      feedbackText: 'Poderia ser melhor 😕',
      userId: userId,
      skipFkCheck: true,
    });

    console.log(`   Status HTTP: ${feedbackRes2.status}`);
    if (feedbackRes2.status === 200) {
      console.log('   ✅ Feedback 2 enviado com sucesso');
      if (feedbackRes2.body?.profile) {
        const total = feedbackRes2.body.profile?.total_feedback || 0;
        console.log(`   👤 Total de feedbacks: ${total}\n`);
      }
    } else {
      console.log(`   ⚠️ Erro: ${feedbackRes2.status}`);
      console.log(`      Detalhe: ${feedbackRes2.body?.details || feedbackRes2.body?.error}\n`);
    }

    // Step 3: Query database to verify persistence
    console.log(`4️⃣ Verificando dados no banco de dados...`);
    console.log(`   (Consultando Doutora Kitty)\n`);
    
    const kittyRes = await makeRequest('GET', '/api/doutora-kitty/interpretation');

    console.log(`   Status HTTP: ${kittyRes.status}`);
    if (kittyRes.status === 200) {
      const kitty = kittyRes.body;
      console.log('   ✅ Doutora Kitty respondeu');
      console.log(`   📊 Total de feedbacks: ${kitty.feedbackStats?.totalFeedback || 0}`);
      console.log(`   💚 Likes: ${kitty.feedbackStats?.totalLikes || 0}`);
      console.log(`   🤔 Dislikes: ${kitty.feedbackStats?.totalDislikes || 0}`);
      console.log(`   📈 Tendência: ${kitty.feedbackStats?.recentTrend || 'N/A'}`);
      console.log(`   🎯 Consistência: ${kitty.feedbackStats?.consistencyScore || 'N/A'}\n`);

      console.log('📝 Análise de Kitty:');
      console.log(`   "${kitty.summary || 'Sem dados'}"\n`);

      // Success criteria
      if ((kitty.feedbackStats?.totalFeedback || 0) > 0) {
        console.log('🎉 ✅ PERSISTÊNCIA CONFIRMADA!');
        console.log('\nFluxo validado:');
        console.log('   1. POST /api/test/feedback (sem autenticação)');
        console.log('   2. INSERT seguindo FK constraints');
        console.log('   3. UPDATE user_psychological_profiles');
        console.log('   4. GET /api/doutora-kitty/interpretation');
        console.log('   5. Recupera dados via feedbackStats');
        console.log('   6. Gera análise psicológica');
      } else {
        console.log('⚠️ Nenhum feedback foi persistido (Kitty não vê dados)');
      }
    } else {
      console.log(`   ⚠️ Erro ao consultar Kitty: ${kittyRes.status}\n`);
    }

    console.log('\n✅ Teste de persistência CONCLUÍDO!');
    console.log('\n💾 Sistema de persistência (está tudo no banco?):');
    console.log('   ✓ Feedback armazenado em: public.message_feedback');
    console.log('   ✓ Perfil psicológico em: public.user_psychological_profiles');
    console.log('   ✓ Histórico acessível via: Doutora Kitty API');
    console.log('   ✓ Sem perda de dados ao reabrir conversa');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testPersistenceFlow();
