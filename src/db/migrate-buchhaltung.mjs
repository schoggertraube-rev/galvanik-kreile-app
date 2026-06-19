import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing in env");
}

console.log("Connecting directly to PostgreSQL...");
const sql = postgres(connectionString, { max: 1 });

async function main() {
  try {
    console.log("Creating Buchhaltung tables...");
    
    // ausgangsrechnung
    await sql`
      CREATE TABLE IF NOT EXISTS ausgangsrechnung (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nummer TEXT NOT NULL,
        kunde_id TEXT,
        datum DATE NOT NULL,
        faellig_am DATE,
        brutto NUMERIC(12, 2) NOT NULL,
        netto NUMERIC(12, 2),
        ust_satz NUMERIC(4, 2),
        ust_betrag NUMERIC(12, 2),
        bezahlt_am DATE,
        status TEXT NOT NULL DEFAULT 'offen',
        mahnstufe INTEGER DEFAULT 0,
        erechnung_xml TEXT,
        lead_id UUID,
        is_demo BOOLEAN DEFAULT false,
        erstellt_am TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // zahlung
    await sql`
      CREATE TABLE IF NOT EXISTS zahlung (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ausgangsrechnung_id UUID REFERENCES ausgangsrechnung(id),
        beleg_id UUID REFERENCES beleg(id),
        betrag NUMERIC(12, 2) NOT NULL,
        richtung TEXT NOT NULL,
        datum DATE NOT NULL,
        art TEXT,
        bank_umsatz_ref TEXT,
        is_demo BOOLEAN DEFAULT false
      );
    `;

    // kostenposten
    await sql`
      CREATE TABLE IF NOT EXISTS kostenposten (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bezeichnung TEXT NOT NULL,
        art TEXT NOT NULL,
        kategorie TEXT,
        betrag NUMERIC(12, 2) NOT NULL,
        intervall TEXT NOT NULL,
        beleg_id UUID REFERENCES beleg(id),
        kampagne_id UUID,
        gilt_ab DATE,
        gilt_bis DATE,
        is_demo BOOLEAN DEFAULT false
      );
    `;

    // steuerprofil
    await sql`
      CREATE TABLE IF NOT EXISTS steuerprofil (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bezeichnung TEXT NOT NULL DEFAULT 'Standard',
        standard_ust_satz NUMERIC(4, 2) DEFAULT '19.00',
        reduziert_ust_satz NUMERIC(4, 2) DEFAULT '7.00',
        kleinunternehmer BOOLEAN DEFAULT false,
        voranmeldung_rhythmus TEXT DEFAULT 'monatlich',
        sachkontenrahmen TEXT DEFAULT 'SKR03',
        berater_nr TEXT,
        mandanten_nr TEXT,
        wj_beginn DATE,
        aktiv BOOLEAN DEFAULT true,
        erstellt_am TIMESTAMP NOT NULL DEFAULT NOW(),
        app_lizenz_monat NUMERIC(10, 2) DEFAULT '149.00',
        app_einrichtung_einmalig NUMERIC(10, 2) DEFAULT '0.00',
        app_startdatum DATE DEFAULT NOW()
      );
    `;

    console.log("Adding RLS policies (FOR ALL TO public USING (true)) to allow prototyping...");
    
    const tables = ['ausgangsrechnung', 'zahlung', 'kostenposten', 'steuerprofil'];
    for (const table of tables) {
      await sql.unsafe("ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY;");
      await sql.unsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE tablename = '` + table + `' AND policyname = 'Allow all actions for public'
            ) THEN
                CREATE POLICY "Allow all actions for public" ON ` + table + ` FOR ALL TO public USING (true) WITH CHECK (true);
            END IF;
        END
        $$;
      `);
    }

    console.log("Successfully created tables and RLS.");
  } catch (error) {
    console.error("Error running script:", error);
  } finally {
    await sql.end();
  }
}

main();
