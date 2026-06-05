const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function run() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS kampagne (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, ziel TEXT, zeitraum_von DATE, zeitraum_bis DATE, budget NUMERIC(12,2) DEFAULT '0', status TEXT NOT NULL DEFAULT 'geplanned', is_demo BOOLEAN DEFAULT false, erstellt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS kanal (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), typ TEXT NOT NULL, name TEXT NOT NULL, verbunden BOOLEAN DEFAULT false, config JSONB, access_token_encrypted TEXT, status TEXT DEFAULT 'nicht_verbunden', erstellt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS segment (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, icon TEXT, farbe TEXT DEFAULT '#e91e63', beschreibung TEXT, filter_regel JSONB, is_demo BOOLEAN DEFAULT false, erstellt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS aktion (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kampagne_id UUID REFERENCES kampagne(id), typ TEXT NOT NULL, kanal_id UUID REFERENCES kanal(id), segment_id UUID REFERENCES segment(id), titel TEXT NOT NULL, inhalt JSONB, status TEXT NOT NULL DEFAULT 'vorschlag', erwarteter_output NUMERIC(12,2), aufwand_min INTEGER DEFAULT 0, kosten_budget NUMERIC(12,2) DEFAULT '0', score NUMERIC(6,2) DEFAULT '0', freigegeben_von TEXT, geplant_fuer TIMESTAMP, ausgefuehrt_am TIMESTAMP, is_demo BOOLEAN DEFAULT false, erstellt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS touchpoint (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), aktion_id UUID REFERENCES aktion(id), kanal_id UUID REFERENCES kanal(id), externe_ref TEXT, utm_campaign TEXT, utm_source TEXT, utm_medium TEXT, reichweite INTEGER DEFAULT 0, klicks INTEGER DEFAULT 0, ausgefuehrt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS attribution (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), touchpoint_id UUID REFERENCES touchpoint(id), lead_id TEXT, auftrag_id TEXT, umsatz NUMERIC(12,2) DEFAULT '0', modell TEXT DEFAULT 'last_click', erstellt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS lern_metrik (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), dimension TEXT NOT NULL, wert TEXT NOT NULL, aktionen INTEGER DEFAULT 0, anfragen INTEGER DEFAULT 0, umsatz NUMERIC(12,2) DEFAULT '0', konfidenz NUMERIC(5,2) DEFAULT '0', aktualisiert_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS einwilligung (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kunde_id TEXT NOT NULL, kanal TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'widerrufen', quelle TEXT NOT NULL, nachweis TEXT, zeitpunkt TIMESTAMP DEFAULT NOW() NOT NULL, erstellt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS telemetrie_event (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_typ TEXT NOT NULL, meta JSONB, zeitpunkt TIMESTAMP DEFAULT NOW() NOT NULL, is_anonym BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS marketing_asset (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), quelle TEXT NOT NULL, auftrag_id TEXT, kunde_id TEXT, segment_id UUID REFERENCES segment(id), storage_pfad TEXT NOT NULL, typ TEXT NOT NULL, freigabe_marketing BOOLEAN DEFAULT false, qualitaet_score NUMERIC(4,2) DEFAULT '0', erstellt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS feedback_mail (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), auftrag_id TEXT, kunde_id TEXT, segment_id UUID REFERENCES segment(id), ankunft_quelle TEXT, ankunft_am TIMESTAMP, geplant_fuer TIMESTAMP, status TEXT NOT NULL DEFAULT 'geplant', gesendet_am TIMESTAMP, token_upload TEXT, token_feedback TEXT, einwilligung_ok BOOLEAN DEFAULT false, erstellt_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS feedback_eingang (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), feedback_mail_id UUID REFERENCES feedback_mail(id), zufriedenheit INTEGER, google_bewertung_geklickt BOOLEAN DEFAULT false, fotos_hochgeladen INTEGER DEFAULT 0, freitext TEXT, eingegangen_am TIMESTAMP DEFAULT NOW() NOT NULL);
      CREATE TABLE IF NOT EXISTS statistik_kennzahl (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), metrik TEXT NOT NULL, periode TEXT NOT NULL, wert NUMERIC(12,2) NOT NULL, quelle TEXT, aktualisiert_am TIMESTAMP DEFAULT NOW() NOT NULL);
    `);
    console.log('Marketing tables created successfully!');
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}
run();
