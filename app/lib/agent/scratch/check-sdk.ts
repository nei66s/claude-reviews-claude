
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const responses = (client as any).responses;
  console.log('Responses methods:', Object.keys(responses));
  // Check if it has a functions or proto
  let proto = Object.getPrototypeOf(responses);
  while (proto) {
    console.log('Proto methods:', Object.getOwnPropertyNames(proto));
    proto = Object.getPrototypeOf(proto);
  }
}

check().catch(console.error);
