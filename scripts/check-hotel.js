const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function checkHotelRelics() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    console.log("=== CHECKING TENANT_ID COLUMNS ===");
    const colsRes = await client.query(`
      SELECT table_name, column_name, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND column_name = 'tenant_id'
      ORDER BY table_name;
    `);
    
    const tenantTables = colsRes.rows;
    const results = [];
    
    for (const t of tenantTables) {
      console.log(`Table: ${t.table_name}, Default: ${t.column_default}`);
      
      const countRes = await client.query(`
        SELECT COUNT(*) as cnt FROM "${t.table_name}" WHERE tenant_id = 'hotel-kreile'
      `);
      
      const countAll = await client.query(`
        SELECT COUNT(*) as cnt FROM "${t.table_name}"
      `);
      
      results.push({
        table: t.table_name,
        default: t.column_default,
        hotelRows: parseInt(countRes.rows[0].cnt),
        totalRows: parseInt(countAll.rows[0].cnt)
      });
    }
    
    console.log("\n=== DATA COUNTS ===");
    results.forEach(r => {
      console.log(`${r.table}: ${r.hotelRows} hotel-kreile rows (out of ${r.totalRows} total)`);
    });
    
  } catch (err) {
    console.error("Error inspecting DB:", err);
  } finally {
    await client.end();
  }
}

checkHotelRelics();
