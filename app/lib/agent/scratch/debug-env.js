
const dotenv = require('dotenv');
dotenv.config();

function ALLOW_WEB_FETCH_VAL() {
  const v = String(process.env.ALLOW_WEB_FETCH || '').toLowerCase();
  console.log('DEBUG: process.env.ALLOW_WEB_FETCH is:', JSON.stringify(process.env.ALLOW_WEB_FETCH));
  console.log('DEBUG: v is:', JSON.stringify(v));
  return v === 'true';
}

async function test() {
  console.log('ALLOW_WEB_FETCH_VAL() ->', ALLOW_WEB_FETCH_VAL());
}

test();
