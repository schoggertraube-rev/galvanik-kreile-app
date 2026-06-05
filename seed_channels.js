const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function seedChannels() {
  const kanaele = [
    { typ: 'email', name: 'E-Mail (Newsletter & Feedback)', status: 'nicht_verbunden', verbunden: false },
    { typ: 'instagram', name: 'Instagram', status: 'nicht_verbunden', verbunden: false },
    { typ: 'google', name: 'Google Business Profile', status: 'nicht_verbunden', verbunden: false },
    { typ: 'web', name: 'Website / UTM-Tracking', status: 'verbunden', verbunden: true } // Web is automatically tracked
  ];

  try {
    for (const k of kanaele) {
      const existing = await sql`SELECT id FROM kanal WHERE typ = ${k.typ} LIMIT 1`;
      if (existing.length === 0) {
        await sql`INSERT INTO kanal (typ, name, status, verbunden) VALUES (${k.typ}, ${k.name}, ${k.status}, ${k.verbunden})`;
        console.log(`Kanal ${k.name} seeded.`);
      } else {
        console.log(`Kanal ${k.name} already exists.`);
      }
    }
    console.log('Seeding completed.');
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}
seedChannels();
