// Historischer no-hotel-relics check: Dieses Skript dient nur zur Überprüfung, ob alte "hotel-kreile" Relikte existieren.
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    console.log("=== CHECKING TENANT_ID COLUMNS ===");
    const colsRes = await client.query(`
      SELECT table_name, column_name, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND column_name = 'tenant_id'
      ORDER BY table_name;
    `);
    
    const tenantTables = colsRes.rows;
    for (const t of tenantTables) {
      console.log(`Table: ${t.table_name}, Default: ${t.column_default}`);
      
      const countRes = await client.query(`
        SELECT COUNT(*) as cnt FROM "${t.table_name}" WHERE tenant_id = 'hotel-kreile'
      `);
      console.log(`  Rows with 'hotel-kreile': ${countRes.rows[0].cnt}`);
    }

    console.log("\n=== DEEP TEXT SEARCH IN ORDERS ===");
    const textRes = await client.query(`
      SELECT id, title, task, delay_reason, recommended_action, status_text 
      FROM orders 
      WHERE 
        title LIKE '%hotel%' OR 
        task LIKE '%hotel%' OR 
        delay_reason LIKE '%hotel%' OR 
        recommended_action LIKE '%hotel%' OR 
        status_text LIKE '%hotel%';
    `);
    console.log(`Orders containing 'hotel' anywhere: ${textRes.rows.length}`);
    
  } catch (err) {
    console.error("Error verifying:", err);
  } finally {
    await client.end();
  }
}

verify();
