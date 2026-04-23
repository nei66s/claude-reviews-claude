
require('dotenv').config();
const OpenAI = require('openai');

async function testSearch() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY NOT FOUND');
    return;
  }

  const client = new OpenAI({ apiKey });
  const query = 'cotação do dólar hoje em reais';

  try {
    console.log(`Testing search for: "${query}" using model: gpt-4o-search-preview...`);
    const response = await client.chat.completions.create({
      model: 'gpt-4o-search-preview',
      messages: [{ role: 'user', content: `Busque sobre: ${query}. Retorne uma lista de resultados relevantes com título, URL e um pequeno resumo. Formate como uma lista de itens claros.` }],
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('--- RESPONSE ---');
    console.log(content);
    console.log('--- END RESPONSE ---');
  } catch (err) {
    console.error('SEARCH FAILED:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

testSearch();
