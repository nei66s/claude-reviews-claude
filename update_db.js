const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const checkQuery = \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'avatar';\";

    const res = await client.query(checkQuery);

    if (res.rows.length === 0) {
      console.log('Column \"avatar\" does not exist. Adding it...');
      await client.query('ALTER TABLE public.app_users ADD COLUMN avatar TEXT;');
      console.log('Column \"avatar\" added.');
    } else {
      console.log('Column \"avatar\" already exists.');
    }

    const finalRes = await client.query(checkQuery);
    if (finalRes.rows.length > 0) {
      console.log('Column info: Name: ' + finalRes.rows[0].column_name + ', Type: ' + finalRes.rows[0].data_type);
    } else {
      console.log('Error: Column still does not exist.');
    }

  } catch (err) {
    console.error('Error executing script:', err);
  } finally {
    await client.end();
  }
}

run();
