-- AF-11: reopen retains issued credit and the original rework reference.
CREATE OR REPLACE FUNCTION private.apply_complaint_rework_decision_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  current_tenant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  persisted_version integer;
  persisted_closed_at timestamptz;
BEGIN
  IF current_tenant IS NULL OR OLD.tenant_id <> current_tenant THEN
    RAISE EXCEPTION 'COMPLAINT_REWORK_TENANT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NEW.complaint_id IS DISTINCT FROM OLD.complaint_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.source_order_id IS DISTINCT FROM OLD.source_order_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.nummer IS DISTINCT FROM OLD.nummer
     OR NEW.teile IS DISTINCT FROM OLD.teile
     OR NEW.mangel IS DISTINCT FROM OLD.mangel
     OR NEW.ware_zurueck IS DISTINCT FROM OLD.ware_zurueck
     OR NEW.source_handover_mode IS DISTINCT FROM OLD.source_handover_mode
     OR NEW.source_intake_source IS DISTINCT FROM OLD.source_intake_source
     OR NEW.source_order_number IS DISTINCT FROM OLD.source_order_number
     OR NEW.source_customer_id IS DISTINCT FROM OLD.source_customer_id
     OR NEW.source_ware IS DISTINCT FROM OLD.source_ware
     OR NEW.source_items IS DISTINCT FROM OLD.source_items THEN
    RAISE EXCEPTION 'COMPLAINT_REWORK_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
    RAISE EXCEPTION 'COMPLAINT_VERSION_CONFLICT' USING ERRCODE = '40001';
  END IF;

  IF OLD.gutschrift_nr IS NOT NULL AND (NEW.gutschrift_nr IS DISTINCT FROM OLD.gutschrift_nr OR NEW.gutschrift_betrag IS DISTINCT FROM OLD.gutschrift_betrag) THEN
    RAISE EXCEPTION 'COMPLAINT_CREDIT_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF OLD.nacharbeit_auftrag_id IS NOT NULL AND NEW.nacharbeit_auftrag_id IS DISTINCT FROM OLD.nacharbeit_auftrag_id THEN
    RAISE EXCEPTION 'COMPLAINT_REWORK_REFERENCE_IMMUTABLE' USING ERRCODE='23514';
  END IF;

  IF NOT (
    (OLD.stand = 'aufgenommen' AND NEW.stand = 'massnahme_nacharbeit'
      AND NEW.bewertung IN ('berechtigt', 'kulanz') AND NEW.massnahme = 'nacharbeit'
      AND NEW.nacharbeit_auftrag_id IS NOT NULL AND OLD.ware_zurueck IN ('ja', 'offen'))
    OR (OLD.stand = 'aufgenommen' AND NEW.stand = 'massnahme_gutschrift'
      AND NEW.bewertung IN ('berechtigt', 'kulanz') AND NEW.massnahme = 'gutschrift'
      AND NEW.nacharbeit_auftrag_id IS NOT DISTINCT FROM OLD.nacharbeit_auftrag_id)
    OR (OLD.stand = 'aufgenommen' AND NEW.stand = 'kunde_informieren'
      AND NEW.bewertung = 'abgelehnt' AND NEW.massnahme = 'ablehnen'
      AND length(btrim(NEW.begruendung)) BETWEEN 3 AND 2000
      AND NEW.nacharbeit_auftrag_id IS NOT DISTINCT FROM OLD.nacharbeit_auftrag_id)
    OR (OLD.stand = 'massnahme_gutschrift' AND NEW.stand = 'kunde_informieren'
      AND NEW.gutschrift_betrag > 0 AND length(btrim(NEW.gutschrift_nr)) BETWEEN 1 AND 30
      AND NEW.bewertung IS NOT DISTINCT FROM OLD.bewertung
      AND NEW.massnahme IS NOT DISTINCT FROM OLD.massnahme
      AND NEW.begruendung IS NOT DISTINCT FROM OLD.begruendung
      AND NEW.nacharbeit_auftrag_id IS NOT DISTINCT FROM OLD.nacharbeit_auftrag_id)
    OR (OLD.stand <> 'abgeschlossen' AND NEW.stand = 'abgeschlossen'
      AND NEW.bewertung IS NOT DISTINCT FROM OLD.bewertung
      AND NEW.massnahme IS NOT DISTINCT FROM OLD.massnahme
      AND NEW.begruendung IS NOT DISTINCT FROM OLD.begruendung
      AND NEW.gutschrift_betrag IS NOT DISTINCT FROM OLD.gutschrift_betrag
      AND NEW.gutschrift_nr IS NOT DISTINCT FROM OLD.gutschrift_nr
      AND NEW.nacharbeit_auftrag_id IS NOT DISTINCT FROM OLD.nacharbeit_auftrag_id
      AND (
        (NEW.abschluss_art = 'zurueckgezogen' AND length(btrim(NEW.abschluss_notiz)) BETWEEN 3 AND 500)
        OR (OLD.stand = 'kunde_informieren' AND NEW.abschluss_art = 'ohne_mail'
          AND length(btrim(NEW.abschluss_notiz)) BETWEEN 3 AND 500)
        OR (OLD.stand = 'kunde_informieren' AND NEW.abschluss_art = 'mail')
        OR (OLD.stand = 'massnahme_nacharbeit' AND NEW.abschluss_art = 'nacharbeit_raus'
          AND NEW.abschluss_notiz IS NULL)
      ) AND NEW.abgeschlossen_am IS NOT NULL AND NEW.abgeschlossen_von IS NOT NULL)
    OR (OLD.stand = 'abgeschlossen' AND NEW.stand = 'aufgenommen'
      AND NEW.bewertung IS NULL AND NEW.massnahme IS NULL AND NEW.begruendung IS NULL
      AND NEW.gutschrift_betrag IS NOT DISTINCT FROM OLD.gutschrift_betrag
      AND NEW.gutschrift_nr IS NOT DISTINCT FROM OLD.gutschrift_nr
      AND NEW.nacharbeit_auftrag_id IS NOT DISTINCT FROM OLD.nacharbeit_auftrag_id)
  ) IS TRUE THEN
    RAISE EXCEPTION 'COMPLAINT_REWORK_TRANSITION_INVALID' USING ERRCODE = '23514';
  END IF;

  IF NEW.stand <> 'abgeschlossen' AND (NEW.abschluss_art IS NOT NULL
     OR NEW.abschluss_notiz IS NOT NULL OR NEW.abgeschlossen_am IS NOT NULL
     OR NEW.abgeschlossen_von IS NOT NULL) THEN
    RAISE EXCEPTION 'COMPLAINT_CLOSURE_FIELDS_INVALID' USING ERRCODE = '23514';
  END IF;

  -- A withdrawn rework is stopped atomically with the complaint. In-process
  -- work cannot be cancelled through this dialog. No existing row is deleted.
  IF NEW.abschluss_art = 'zurueckgezogen' AND OLD.stand = 'massnahme_nacharbeit' THEN
    PERFORM 1 FROM public.orders
      WHERE tenant_id = OLD.tenant_id AND id = OLD.nacharbeit_auftrag_id
        AND station = 'angenommen' AND ware IN ('erwartet', 'da') FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'REWORK_ALREADY_IN_PROGRESS' USING ERRCODE = '23514';
    END IF;
    UPDATE public.orders
    SET ware = CASE WHEN ware = 'erwartet' THEN 'storniert' ELSE 'zurueck' END,
        ohne_ware_grund = CASE WHEN ware = 'erwartet' THEN NEW.abschluss_notiz ELSE ohne_ware_grund END,
        zurueck_grund = CASE WHEN ware = 'da' THEN NEW.abschluss_notiz ELSE zurueck_grund END
    WHERE tenant_id = OLD.tenant_id AND id = OLD.nacharbeit_auftrag_id;
  END IF;

  UPDATE public.complaints
  SET stand = NEW.stand, bewertung = NEW.bewertung, massnahme = NEW.massnahme,
      nacharbeit_auftrag_id = NEW.nacharbeit_auftrag_id, begruendung = NEW.begruendung,
      gutschrift_betrag = NEW.gutschrift_betrag, gutschrift_nr = NEW.gutschrift_nr,
      abschluss_art = NEW.abschluss_art, abschluss_notiz = NEW.abschluss_notiz,
      abgeschlossen_am = NEW.abgeschlossen_am, abgeschlossen_von = NEW.abgeschlossen_von,
      status = CASE WHEN NEW.stand = 'abgeschlossen' THEN 'resolved' ELSE 'open' END,
      resolved_at = NEW.abgeschlossen_am, resolution = NEW.abschluss_notiz,
      version = NEW.version
  WHERE tenant_id = OLD.tenant_id AND id = OLD.complaint_id
    AND stand = OLD.stand AND version = OLD.version
  RETURNING version INTO persisted_version;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION private.apply_complaint_rework_decision_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.apply_complaint_rework_decision_v1() TO service_role;
