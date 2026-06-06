import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Please check your .env.local.");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function migrate() {
  console.log("Starting ausgangsrechnung migration...");
  
  try {
    // 1. Add bemerkung
    await sql`
      ALTER TABLE ausgangsrechnung 
      ADD COLUMN IF NOT EXISTS bemerkung text;
    `;
    console.log("Added bemerkung to ausgangsrechnung.");

    // 2. Create ausgangsrechnung_position
    await sql`
      CREATE TABLE IF NOT EXISTS ausgangsrechnung_position (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ausgangsrechnung_id uuid NOT NULL REFERENCES ausgangsrechnung(id) ON DELETE CASCADE,
        beschreibung text NOT NULL,
        menge numeric(12,2) NOT NULL DEFAULT 1,
        einzelpreis_netto numeric(12,2) NOT NULL
      );
    `;
    console.log("Created ausgangsrechnung_position.");

    console.log("Migration successful!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await sql.end();
  }
}

migrate();
