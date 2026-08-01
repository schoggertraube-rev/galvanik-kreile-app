-- Migration: 20260610_customers_kundenkarte.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS shipping_preference text DEFAULT 'abholung',
  ADD COLUMN IF NOT EXISTS payment_preference text DEFAULT 'rechnung_14',
  ADD COLUMN IF NOT EXISTS classification text DEFAULT 'B',
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS internal_notes text

-- Seed email templates if not exists
INSERT INTO email_templates (tenant_id, template_key, name, subject_template, body_html_template, body_text_template) VALUES
  ('galvanik-kreile', 'zahlungserinnerung', 'Zahlungserinnerung', 'Zahlungserinnerung – {auftragsnummer}',
   '<p>Sehr geehrte/r {kunde_name},</p><p>die Rechnung {rechnungsnummer} über {betrag} € ist seit {tage} Tagen offen. Wir bitten um zeitnahe Überweisung.</p>',
   'Sehr geehrte/r {kunde_name}, die Rechnung {rechnungsnummer} über {betrag} € ist seit {tage} Tagen offen.'),
  ('galvanik-kreile', 'mahnung', 'Mahnung', 'Mahnung – {rechnungsnummer}',
   '<p>Sehr geehrte/r {kunde_name},</p><p>trotz unserer Erinnerung ist die Rechnung {rechnungsnummer} weiterhin offen.</p>',
   'Sehr geehrte/r {kunde_name}, trotz unserer Erinnerung ist die Rechnung {rechnungsnummer} weiterhin offen.')
ON CONFLICT (template_key) DO NOTHING

CREATE OR REPLACE VIEW v_analyse_kunden_kpi AS
SELECT
  c.id AS customer_id,
  coalesce(c.company_name, c.name) AS kunde,
  c.classification,
  c.created_at AS kunde_seit,
  -- Umsatz LTV
  coalesce((
    SELECT sum(ar.brutto) FROM ausgangsrechnung ar
    JOIN orders o ON o.id = ar.order_id
    WHERE o.customer_id = c.id AND ar.status != 'storniert'
  ), 0) AS umsatz_ltv,
  -- Gewinn LTV (Erlös − Material − Arbeitszeit)
  coalesce((
    SELECT sum(i.preis_netto) FROM items i
    JOIN orders o ON o.id = i.order_id WHERE o.customer_id = c.id
  ), 0)
  - coalesce((
    SELECT sum(cu.quantity * cu.unit_cost_eur) FROM consumable_uses cu
    JOIN orders o ON o.id = cu.order_id WHERE o.customer_id = c.id
  ), 0)
  - coalesce((
    SELECT sum(az.dauer_minuten / 60.0 * az.kostensatz_eur_pro_stunde) FROM arbeitszeit_buchung az
    JOIN orders o ON o.id = az.auftrag_id WHERE o.customer_id = c.id
  ), 0) AS gewinn_ltv,
  -- Offene Posten
  coalesce((
    SELECT sum(ar.brutto) FROM ausgangsrechnung ar
    JOIN orders o ON o.id = ar.order_id
    WHERE o.customer_id = c.id AND ar.bezahlt_am IS NULL AND ar.status NOT IN ('storniert', 'bezahlt')
  ), 0) AS offene_posten,
  -- Aktive Aufträge
  (SELECT count(*) FROM orders o WHERE o.customer_id = c.id AND o.status NOT IN ('abgeschlossen', 'storniert')) AS aktive_auftraege,
  -- Pünktlichkeit
  CASE WHEN (SELECT count(*) FROM orders o WHERE o.customer_id = c.id AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL) > 0
    THEN round(
      (SELECT count(*) FROM orders o WHERE o.customer_id = c.id AND o.completed_date <= o.promised_due_date AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL)
      * 100.0
      / (SELECT count(*) FROM orders o WHERE o.customer_id = c.id AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL)
    , 1)
    ELSE NULL
  END AS puenktlichkeit_pct,
  -- Reklamationen
  coalesce((SELECT count(*) FROM complaints co JOIN orders o ON o.id = co.order_id WHERE o.customer_id = c.id), 0) AS reklamationen
FROM customers c
