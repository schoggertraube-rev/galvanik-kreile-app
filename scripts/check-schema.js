const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // 1. Get all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log("=== TABLES IN PUBLIC SCHEMA ===");
    console.log(tables.join(", "));
    console.log("");
    
    // 2. Get columns for key tables
    const targetTables = ['orders', 'items', 'customers', 'status_events', 'events'];
    
    for (const table of targetTables) {
      if (!tables.includes(table)) {
        console.log(`Table '${table}' does NOT exist.`);
        continue;
      }
      
      const columnsRes = await client.query(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      
      console.log(`=== COLUMNS IN '${table}' ===`);
      columnsRes.rows.forEach(c => {
        console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`);
      });
      console.log("");
    }
    
    // 3. Look at Supabase migrations table if it exists
    const hasMigrations = tablesRes.rows.some(r => r.table_name === 'schema_migrations');
    if (hasMigrations) {
      const migRes = await client.query(`SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5`);
      console.log("=== RECENT SUPABASE MIGRATIONS ===");
      console.log(migRes.rows.map(r => r.version).join(", "));
    } else {
      // try querying supabase_migrations schema directly
      try {
        const migRes = await client.query(`SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10`);
        console.log("=== SUPABASE MIGRATIONS ===");
        migRes.rows.forEach(r => console.log(`  ${r.version}: ${r.name}`));
      } catch (e) {
        console.log("Could not read supabase_migrations schema: " + e.message);
      }
    }
    
  } catch (err) {
    console.error("Error connecting or querying:", err);
  } finally {
    await client.end();
  }
}

checkSchema();
