throw new Error(
  'RETIRED_MARKETING_SEGMENT_SEED: production segments require an authorized tenant-bound writer',
);

/*
 * Former arbitrary-DATABASE_URL seed retained as inert forensic context.
 *
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function seedSegments() {
  const segmente = [
    { name: 'Oldtimer', icon: '🚗', farbe: '#8B4513', beschreibung: 'Restaurierung von Oldtimer-Teilen', is_demo: false },
    { name: 'Schmuck', icon: '💎', farbe: '#FFD700', beschreibung: 'Vergoldung und Aufbereitung von Schmuck', is_demo: false },
    { name: 'Besteck/Silber', icon: '🍴', farbe: '#C0C0C0', beschreibung: 'Versilberung von Tafelbesteck', is_demo: false },
    { name: 'Kirchen', icon: '⛪', farbe: '#B8860B', beschreibung: 'Sakrale Gegenstände', is_demo: false },
    { name: 'Museen', icon: '🏛️', farbe: '#2F4F4F', beschreibung: 'Museumsstücke und Artefakte', is_demo: false },
    { name: 'Geschäftskunden', icon: '🏢', farbe: '#4169E1', beschreibung: 'B2B Serienfertigung', is_demo: false },
    { name: 'Privatkunden', icon: '👤', farbe: '#32CD32', beschreibung: 'Einzelstücke von Privatpersonen', is_demo: false }
  ];

  try {
    for (const s of segmente) {
      // Check if exists
      const existing = await sql`SELECT id FROM segment WHERE name = ${s.name} LIMIT 1`;
      if (existing.length === 0) {
        await sql`INSERT INTO segment (name, icon, farbe, beschreibung, is_demo) VALUES (${s.name}, ${s.icon}, ${s.farbe}, ${s.beschreibung}, ${s.is_demo})`;
        console.log(`Segment ${s.name} seeded.`);
      } else {
        console.log(`Segment ${s.name} already exists.`);
      }
    }
    console.log('Seeding completed.');
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}
seedSegments();
*/
