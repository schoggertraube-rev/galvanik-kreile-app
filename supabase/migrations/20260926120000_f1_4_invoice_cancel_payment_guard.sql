-- F1.4/F1.5 Storno-Payment-Gate auf DB-Ebene (zweite Schicht), 2026-09-26.
--
-- Regel K-G07-004 (G07 05_REGELN_SPERREN_KONFLIKTE.md, Zeile K-G07-004,
-- "Storno-Payment-Gate als zweite Schicht"): Storno ist nur bei vollstaendig
-- unbezahltem, konsistentem Zahlungsstand erlaubt. Die App-Schicht erfuellt das
-- bereits ueber `hasClearlyUnpaidPaymentState`
-- (src/lib/server/commands/immutableInvoiceCommand.ts). Die DB-Schicht hat den
-- Zahlungsstand bisher NICHT geprueft: wer die App-Schicht umgeht und nur das
-- Session-Flag `app.invoice_cancel_command = 'v1'` setzt, konnte eine
-- teilbezahlte, bezahlte oder inkonsistente Rechnung auf `cancelled` setzen.
--
-- Nachweispflicht T-G07-016 (G07 07_ABNAHME_TESTS.md): direkte DB-Session,
-- teil-/vollbezahlte oder inkonsistente Rechnung auf `cancelled` -> Trigger
-- blockiert jeden Fall ohne Mutation. Beweis:
-- src/test/f1_4_invoice_cancel_payment_guard.integration.test.ts
--
-- Diese Migration ist rein additiv: sie ersetzt ausschliesslich den Koerper von
-- private.guard_f1_4_invoice_update(). Keine Tabelle, kein Index, keine RLS-
-- oder Policy-Aenderung, kein neuer Schreibweg, keine neue Rolle. Der Trigger
-- invoices_f14_update_guard referenziert nur den Funktionsnamen und bleibt
-- unveraendert bestehen.
--
-- Basis ist bewusst die zuletzt gueltige Definition aus
-- 20260905201850_f1_5_payment_mode_intake_contract.sql (NICHT die aeltere aus
-- 20260821152949): der F1.5-Zahlungszweig inklusive
-- `payment_mode IS NOT DISTINCT FROM` und `payment_version + 1` bleibt
-- wortgleich erhalten. Geaendert ist ausschliesslich der Storno-Zweig.
--
-- Fehlerpfad unveraendert: jede Ablehnung laeuft weiter in das bestehende
-- `RAISE EXCEPTION 'INVOICE_IMMUTABLE' USING ERRCODE = '23514'`. Es gibt
-- absichtlich KEINEN neuen Fehlercode, damit alle bestehenden Konsumenten
-- (Command-Fehlerabbildung, Contract-Tests, E2E) unveraendert gueltig bleiben.
--
-- Warum genau diese fuenf Zusatzbedingungen den App-Vertrag vollstaendig
-- abbilden:
--   1. OLD.payment_contract_version = 1 ist die Voraussetzung, unter der
--      invoices_f15_amounts_chk (20260905100000) fuer die Zeile ueberhaupt
--      greift. Nur dann garantiert das Schema fuer payment_status = 'offen'
--      zusaetzlich payment_version = 0, payment_method IS NULL,
--      payment_paid_at IS NULL, payment_receipt_id IS NULL,
--      payment_event_id IS NULL, payment_correlation_id IS NULL,
--      payment_currency = 'EUR' und payment_mode IS NOT NULL. Ohne diese
--      Bedingung koennte eine Legacy-Zeile (payment_contract_version IS NULL)
--      mit payment_status = 'offen' und gesetztem payment_paid_at oder
--      payment_receipt_id als "unbezahlt" durchlaufen - genau der von
--      T-G07-016 geforderte inkonsistente Fall.
--   2.-4. payment_status = 'offen', payment_paid_amount_cents = 0 und
--      payment_paid_amount_cents + payment_open_amount_cents =
--      gross_amount_cents sind die fachliche Kerninvariante aus K-G07-004.
--   5. gross_amount_cents > 0 spiegelt die App-Bedingung; eine Nullbetrag-
--      Rechnung ist kein stornierbarer Geldvorgang.
-- Damit ist der DB-Zweig deckungsgleich mit hasClearlyUnpaidPaymentState.
--
-- Bewusst blockiert: F1.4-Rechnungen aus dem Fenster vor 20260905100000 haben
-- payment_contract_version IS NULL und payment_status IS NULL. Sie sind auf
-- DB-Ebene nicht mehr stornierbar. Das erzeugt keine neue Sackgasse, weil die
-- App-Schicht solche Zeilen schon heute mit CONFLICT ablehnt (bewiesen in
-- src/test/f1_4_immutable_invoice.integration.test.ts, Fall
-- "Beschaedigter Zahlungsstand darf nicht storniert werden").

CREATE OR REPLACE FUNCTION private.guard_f1_4_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.contract_version IS DISTINCT FROM 1 THEN
    IF NEW.contract_version IS DISTINCT FROM OLD.contract_version THEN
      RAISE EXCEPTION 'INVOICE_LEGACY_UPGRADE_FORBIDDEN' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Unveraendert aus 20260905201850: der einzige erlaubte Zahlungsschreibweg.
  IF NEW.contract_version = 1
     AND OLD.contract_version = 1
     AND OLD.payment_contract_version = 1
     AND NEW.payment_contract_version = 1
     AND NEW.payment_mode IS NOT DISTINCT FROM OLD.payment_mode
     AND coalesce(current_setting('app.payment_command', true), '') = 'v1'
     AND NEW.status = OLD.status
     AND NEW.aggregate_version = OLD.aggregate_version
     AND NEW.payment_version = OLD.payment_version + 1
     AND (
       to_jsonb(NEW) - ARRAY[
         'payment_contract_version', 'payment_mode', 'payment_status',
         'payment_open_amount_cents', 'payment_paid_amount_cents',
         'payment_currency', 'payment_method', 'payment_paid_at',
         'payment_receipt_id', 'payment_event_id', 'payment_correlation_id',
         'payment_version'
       ]::text[]
     ) = (
       to_jsonb(OLD) - ARRAY[
         'payment_contract_version', 'payment_mode', 'payment_status',
         'payment_open_amount_cents', 'payment_paid_amount_cents',
         'payment_currency', 'payment_method', 'payment_paid_at',
         'payment_receipt_id', 'payment_event_id', 'payment_correlation_id',
         'payment_version'
       ]::text[]
     ) THEN
    RETURN NEW;
  END IF;

  -- Storno-Zweig. Bedingungen 1-5 (K-G07-004) sind neu; alles andere ist
  -- wortgleich die bisherige Definition.
  IF NEW.contract_version = 1
     AND OLD.status = 'issued'
     AND NEW.status = 'cancelled'
     AND coalesce(current_setting('app.invoice_cancel_command', true), '') = 'v1'
     AND NEW.aggregate_version = OLD.aggregate_version + 1
     -- K-G07-004: Storno nur bei vollstaendig unbezahltem, konsistentem Stand.
     AND OLD.payment_contract_version = 1
     AND OLD.payment_status = 'offen'
     AND OLD.payment_paid_amount_cents = 0
     AND OLD.payment_paid_amount_cents + OLD.payment_open_amount_cents
           = OLD.gross_amount_cents
     AND OLD.gross_amount_cents > 0
     AND (
       to_jsonb(NEW) - ARRAY[
         'status', 'aggregate_version', 'cancel_client_event_id',
         'cancel_correlation_id', 'cancelled_by', 'cancel_reason',
         'cancelled_at', 'cancel_event_id', 'cancellation_pdf_ref',
         'cancellation_pdf_sha256', 'cancellation_pdf_content'
       ]::text[]
     ) = (
       to_jsonb(OLD) - ARRAY[
         'status', 'aggregate_version', 'cancel_client_event_id',
         'cancel_correlation_id', 'cancelled_by', 'cancel_reason',
         'cancelled_at', 'cancel_event_id', 'cancellation_pdf_ref',
         'cancellation_pdf_sha256', 'cancellation_pdf_content'
       ]::text[]
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'INVOICE_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;

-- Rechtestand wortgleich wie beim Original: nur service_role/Owner darf die
-- Guard-Funktion ausfuehren.
REVOKE ALL ON FUNCTION private.guard_f1_4_invoice_update() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION private.guard_f1_4_invoice_update() IS
  'F1.4 Immutabilitaets-Guard inkl. F1.5 Storno-Payment-Gate (K-G07-004, T-G07-016): Storno nur bei payment_contract_version=1, payment_status=offen, paid=0, paid+open=gross und gross>0.';
