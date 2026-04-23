
const { getDb, hasDatabase, dbQuery } = require('./app/lib/server/db');

async function test() {
  console.log("Has Database:", hasDatabase());
  if (!hasDatabase()) {
    console.log("DATABASE_URL is missing!");
    return;
  }

  try {
    const res = await dbQuery("SELECT 1 as result");
    console.log("Query result:", res.rows);
    
    const tables = await dbQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in public schema:", tables.rows.map(r => r.table_name));
  } catch (err) {
    console.error("DB Error:", err);
  }
}

test();
