-- ============================================================================
-- Buchhaltung & Finanzen: Datenmodell Stufe 1
-- Datum: 2026-06-03
-- Status: VORSCHAU — NICHT ANWENDEN OHNE FREIGABE
-- Grundlage: 15_BUCHHALTUNG_DATENMODELL.md
-- ============================================================================

-- ACHTUNG: Diese Datei ist eine Vorschau. Sie wird erst nach expliziter
-- Freigabe als echte Migration angelegt und auf Supabase angewendet.

BEGIN;

-- Extension für Fuzzy-Suche (Lieferanten)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Kategorien (Ausgaben/Einnahmen)
CREATE TABLE IF NOT EXISTS kategorie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  typ TEXT NOT NULL DEFAULT 'ausgabe',
  skr_konto TEXT,
  default_absetzbar_prozent NUMERIC(5,2) DEFAULT 100,
  icon TEXT,
  sortierung INTEGER DEFAULT 0,
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Lieferanten
CREATE TABLE IF NOT EXISTS lieferant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_normalisiert TEXT,
  standard_kategorie_id UUID REFERENCES kategorie(id),
  standard_skr_konto TEXT,
  ust_id TEXT,
  adresse TEXT,
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lieferant_name_trgm ON lieferant USING gin (name_normalisiert gin_trgm_ops);

-- 3. Belege (Eingangsbelege)
CREATE TABLE IF NOT EXISTS beleg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erfasst_am TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  belegdatum DATE,
  lieferant_id UUID REFERENCES lieferant(id),
  lieferant_text TEXT,
  brutto NUMERIC(12,2),
  netto NUMERIC(12,2),
  ust_satz NUMERIC(4,2),
  ust_betrag NUMERIC(12,2),
  vorsteuer_abzug BOOLEAN DEFAULT TRUE,
  kategorie_id UUID REFERENCES kategorie(id),
  skr_konto TEXT,
  absetzbar_prozent NUMERIC(5,2) DEFAULT 100,
  absetzbar_grund TEXT,
  belegart TEXT,
  original_datei TEXT NOT NULL,
  original_format TEXT,
  ocr_confidence NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'pruefen',
  storniert_von UUID REFERENCES beleg(id),
  bank_zahlung_id UUID,
  erstellt_von UUID NOT NULL,
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_beleg_belegdatum ON beleg(belegdatum);
CREATE INDEX IF NOT EXISTS idx_beleg_kategorie ON beleg(kategorie_id);
CREATE INDEX IF NOT EXISTS idx_beleg_status ON beleg(status);
CREATE INDEX IF NOT EXISTS idx_beleg_lieferant ON beleg(lieferant_id);

-- 4. Beleg-Positionen
CREATE TABLE IF NOT EXISTS beleg_position (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beleg_id UUID NOT NULL REFERENCES beleg(id),
  beschreibung TEXT,
  netto NUMERIC(12,2),
  ust_satz NUMERIC(4,2),
  ust_betrag NUMERIC(12,2),
  skr_konto TEXT,
  sortierung INTEGER DEFAULT 0
);

-- 5. Kraftstoff-Detail
CREATE TABLE IF NOT EXISTS kraftstoff_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beleg_id UUID NOT NULL REFERENCES beleg(id),
  sorte TEXT,
  liter NUMERIC(8,2),
  preis_pro_liter NUMERIC(6,3),
  tankstelle TEXT,
  ort TEXT
);

-- 6. Ausgangsrechnungen
CREATE TABLE IF NOT EXISTS ausgangsrechnung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nummer TEXT NOT NULL,
  kunde_id TEXT,
  datum DATE NOT NULL,
  faellig_am DATE,
  brutto NUMERIC(12,2) NOT NULL,
  netto NUMERIC(12,2),
  ust_satz NUMERIC(4,2),
  ust_betrag NUMERIC(12,2),
  bezahlt_am DATE,
  status TEXT NOT NULL DEFAULT 'offen',
  mahnstufe INTEGER DEFAULT 0,
  erechnung_xml TEXT,
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Zahlungen
CREATE TABLE IF NOT EXISTS zahlung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typ TEXT NOT NULL,
  betrag NUMERIC(12,2) NOT NULL,
  datum DATE NOT NULL,
  referenz TEXT,
  beleg_id UUID REFERENCES beleg(id),
  ausgangsrechnung_id UUID REFERENCES ausgangsrechnung(id),
  zahlungsart TEXT,
  bank_referenz TEXT,
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE beleg ADD CONSTRAINT fk_beleg_zahlung
  FOREIGN KEY (bank_zahlung_id) REFERENCES zahlung(id);

-- 8. Steuerprofil
CREATE TABLE IF NOT EXISTS steuerprofil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bezeichnung TEXT NOT NULL DEFAULT 'Standard',
  standard_ust_satz NUMERIC(4,2) DEFAULT 19.00,
  reduziert_ust_satz NUMERIC(4,2) DEFAULT 7.00,
  kleinunternehmer BOOLEAN DEFAULT FALSE,
  voranmeldung_rhythmus TEXT DEFAULT 'monatlich',
  sachkontenrahmen TEXT DEFAULT 'SKR03',
  berater_nr TEXT,
  mandanten_nr TEXT,
  wj_beginn DATE,
  aktiv BOOLEAN DEFAULT TRUE,
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. UStVA-Periode
CREATE TABLE IF NOT EXISTS ustva_periode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zeitraum_von DATE NOT NULL,
  zeitraum_bis DATE NOT NULL,
  umsatz_19 NUMERIC(12,2) DEFAULT 0,
  ust_19 NUMERIC(12,2) DEFAULT 0,
  umsatz_7 NUMERIC(12,2) DEFAULT 0,
  ust_7 NUMERIC(12,2) DEFAULT 0,
  umsatz_0 NUMERIC(12,2) DEFAULT 0,
  vorsteuer NUMERIC(12,2) DEFAULT 0,
  zahllast NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'entwurf',
  freigegeben_am TIMESTAMPTZ,
  freigegeben_von UUID,
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. Export-Läufe
CREATE TABLE IF NOT EXISTS export_lauf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typ TEXT NOT NULL,
  zeitraum_von DATE,
  zeitraum_bis DATE,
  datei_pfad TEXT,
  anzahl_buchungen INTEGER DEFAULT 0,
  erstellt_von UUID NOT NULL,
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 11. Buchhaltungs-Audit-Log (append-only, GoBD)
CREATE TABLE IF NOT EXISTS bh_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zeit TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  benutzer UUID NOT NULL,
  entitaet TEXT NOT NULL,
  entitaet_id UUID NOT NULL,
  aktion TEXT NOT NULL,
  vorher JSONB,
  nachher JSONB
);

-- 12. Buchhaltungs-Einstellungen
CREATE TABLE IF NOT EXISTS bh_einstellungen (
  id TEXT PRIMARY KEY DEFAULT 'default',
  ocr_confidence_schwelle NUMERIC(5,2) DEFAULT 85.00,
  berater_stundensatz NUMERIC(8,2) DEFAULT 120.00,
  minuten_pro_beleg INTEGER DEFAULT 4,
  standard_kontenrahmen TEXT DEFAULT 'SKR03',
  erstellt_am TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  aktualisiert_am TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- GoBD-Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_beleg_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'festgeschrieben' AND NEW.status != 'storniert' THEN
    RAISE EXCEPTION 'GoBD: Festgeschriebener Beleg darf nicht verändert werden. Nur Storno ist erlaubt.';
  END IF;
  IF OLD.status = 'storniert' THEN
    RAISE EXCEPTION 'GoBD: Stornierter Beleg darf nicht verändert werden.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_beleg_gobd ON beleg;
CREATE TRIGGER trg_beleg_gobd
  BEFORE UPDATE ON beleg
  FOR EACH ROW
  EXECUTE FUNCTION prevent_beleg_mutation();

CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'GoBD: Audit-Log ist append-only. Änderungen/Löschungen sind nicht erlaubt.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_no_update ON bh_audit_log;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON bh_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS trg_audit_no_delete ON bh_audit_log;
CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON bh_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

-- ============================================================================
-- RLS-Policies (Prototyping: alle authentifizierten Nutzer)
-- ============================================================================

ALTER TABLE beleg ENABLE ROW LEVEL SECURITY;
ALTER TABLE beleg_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE kraftstoff_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE ausgangsrechnung ENABLE ROW LEVEL SECURITY;
ALTER TABLE zahlung ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategorie ENABLE ROW LEVEL SECURITY;
ALTER TABLE lieferant ENABLE ROW LEVEL SECURITY;
ALTER TABLE steuerprofil ENABLE ROW LEVEL SECURITY;
ALTER TABLE ustva_periode ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_lauf ENABLE ROW LEVEL SECURITY;
ALTER TABLE bh_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bh_einstellungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY beleg_all ON beleg FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY beleg_position_all ON beleg_position FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY kraftstoff_detail_all ON kraftstoff_detail FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY ausgangsrechnung_all ON ausgangsrechnung FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY zahlung_all ON zahlung FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY kategorie_all ON kategorie FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY lieferant_all ON lieferant FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY steuerprofil_all ON steuerprofil FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY ustva_periode_all ON ustva_periode FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY export_lauf_all ON export_lauf FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY bh_audit_log_all ON bh_audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY bh_einstellungen_all ON bh_einstellungen FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE beleg, ausgangsrechnung, zahlung;

COMMIT;
