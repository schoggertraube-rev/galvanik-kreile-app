const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function inspectDB() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    let md = `# Database Health Report\n\n`;
    md += `Generiert am: ${new Date().toISOString()}\n\n`;
    
    // 1. All public tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    
    md += `## 1. Öffentliche Tabellen\n`;
    md += tables.map(t => `- \`${t}\``).join('\n') + `\n\n`;
    
    // 2. Columns per table
    md += `## 2. Spalten je Tabelle\n\n`;
    const hasTenantId = [];
    const noTenantId = [];
    
    for (const table of tables) {
      md += `### Tabelle: \`${table}\`\n`;
      md += `| Spalte | Datentyp | Nullable | Default |\n`;
      md += `|---|---|---|---|\n`;
      
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      
      let tableHasTenantId = false;
      colsRes.rows.forEach(col => {
        md += `| \`${col.column_name}\` | \`${col.data_type}\` | ${col.is_nullable} | \`${col.column_default || 'null'}\` |\n`;
        if (col.column_name === 'tenant_id') tableHasTenantId = true;
      });
      md += `\n`;
      
      if (tableHasTenantId) hasTenantId.push(table);
      else noTenantId.push(table);
    }
    
    // 8 & 9. Tenant ID overview
    md += `## 8 & 9. Übersicht \`tenant_id\`\n\n`;
    md += `**Tabellen MIT \`tenant_id\`:**\n`;
    md += hasTenantId.map(t => `- \`${t}\``).join('\n') + `\n\n`;
    md += `**Tabellen OHNE \`tenant_id\`:**\n`;
    md += noTenantId.map(t => `- \`${t}\``).join('\n') + `\n\n`;
    
    // 3. Primary Keys
    md += `## 3. Primärschlüssel\n\n`;
    const pkRes = await client.query(`
      SELECT tc.table_name, c.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
      JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
        AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';
    `);
    md += `| Tabelle | Primärschlüssel |\n|---|---|\n`;
    pkRes.rows.forEach(r => {
      md += `| \`${r.table_name}\` | \`${r.column_name}\` |\n`;
    });
    md += `\n`;
    
    // 4. Foreign Keys
    md += `## 4. Fremdschlüssel\n\n`;
    const fkRes = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
    `);
    md += `| Tabelle | Spalte | Ziel-Tabelle | Ziel-Spalte |\n|---|---|---|---|\n`;
    fkRes.rows.forEach(r => {
      md += `| \`${r.table_name}\` | \`${r.column_name}\` | \`${r.foreign_table_name}\` | \`${r.foreign_column_name}\` |\n`;
    });
    md += `\n`;
    
    // 6 & 7. RLS & Policies
    md += `## 6 & 7. RLS Status und Policies\n\n`;
    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';
    `);
    md += `| Tabelle | RLS Aktiviert |\n|---|---|\n`;
    rlsRes.rows.forEach(r => {
      md += `| \`${r.relname}\` | ${r.relrowsecurity ? '✅ Ja' : '❌ Nein'} |\n`;
    });
    md += `\n`;
    
    const polRes = await client.query(`
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `);
    if (polRes.rows.length > 0) {
      md += `### Aktive Policies\n`;
      md += `| Tabelle | Policy Name | Command | Roles | Qual | With Check |\n|---|---|---|---|---|---|\n`;
      polRes.rows.forEach(r => {
        md += `| \`${r.tablename}\` | \`${r.policyname}\` | \`${r.cmd}\` | \`${r.roles}\` | \`${r.qual || ''}\` | \`${r.with_check || ''}\` |\n`;
      });
      md += `\n`;
    } else {
      md += `Keine Policies gefunden.\n\n`;
    }
    
    // 10. Used by App Repositories
    md += `## 10. Nutzung durch App-Repositories\n`;
    md += `- \`orders\` (ordersRepository)\n`;
    md += `- \`items\` (itemsRepository, ordersRepository)\n`;
    md += `- \`customers\` (customersRepository, ordersRepository)\n`;
    md += `- \`events\` (statusEventsRepository)\n`;
    md += `- \`baths\` (bathMeasurementsRepository)\n`;
    md += `- \`bath_measurements\` (bathMeasurementsRepository)\n`;
    md += `- \`inventory_items\` (inventoryRepository)\n`;
    md += `- \`stock_movements\` (inventoryRepository)\n\n`;
    
    // Save to docs
    const docsDir = path.join(__dirname, '../docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'DB_HEALTH_REPORT.md'), md);
    console.log("Successfully generated docs/DB_HEALTH_REPORT.md");
    
  } catch (err) {
    console.error("Error inspecting DB:", err);
  } finally {
    await client.end();
  }
}

inspectDB();
