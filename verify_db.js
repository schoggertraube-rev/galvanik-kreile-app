const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);

async function verify() {
  try {
    const res = await sql`INSERT INTO segment (name, icon, farbe, beschreibung, is_demo) VALUES ('Verifikation', '🔍', '#000000', 'Test', true) RETURNING *`;
    console.log('Inserted:', res[0].name);
    const sel = await sql`SELECT * FROM segment WHERE name = 'Verifikation' LIMIT 1`;
    console.log('Selected:', sel[0].name);
    await sql`DELETE FROM segment WHERE name = 'Verifikation'`;
    console.log('Deleted successfully.');
  } catch(e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
verify();
