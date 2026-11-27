-- Arbeitszeitkorrekturen ergänzen das bestehende Buchungsjournal.
ALTER TABLE public.arbeitszeit_buchung
  ADD COLUMN IF NOT EXISTS client_event_id uuid,
  ADD COLUMN IF NOT EXISTS korrigiert_id uuid,
  ADD COLUMN IF NOT EXISTS korrektur_grund text,
  ADD COLUMN IF NOT EXISTS lauf_id uuid,
  ADD COLUMN IF NOT EXISTS kostensatz_quelle text,
  ALTER COLUMN kostensatz_eur_pro_stunde DROP NOT NULL;

DO $arbeitszeit_vertrag$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.arbeitszeit_buchung'::regclass
      AND conname = 'arbeitszeit_buchung_kostensatz_chk'
  ) THEN
    ALTER TABLE public.arbeitszeit_buchung
    ADD CONSTRAINT arbeitszeit_buchung_kostensatz_chk CHECK (
      (kostensatz_quelle IS NULL OR kostensatz_quelle IN ('person', 'standard', 'fehlt'))
      AND (kostensatz_eur_pro_stunde IS NULL) = (kostensatz_quelle IS NOT DISTINCT FROM 'fehlt')
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.arbeitszeit_buchung'::regclass
      AND conname = 'arbeitszeit_buchung_mandant_zeile_key'
  ) THEN
    ALTER TABLE public.arbeitszeit_buchung
    ADD CONSTRAINT arbeitszeit_buchung_mandant_zeile_key UNIQUE (tenant_id, id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.arbeitszeit_buchung'::regclass
      AND conname = 'arbeitszeit_buchung_mandant_befehl_key'
  ) THEN
    ALTER TABLE public.arbeitszeit_buchung
    ADD CONSTRAINT arbeitszeit_buchung_mandant_befehl_key UNIQUE (tenant_id, client_event_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.arbeitszeit_buchung'::regclass
      AND conname = 'arbeitszeit_buchung_korrektur_fk'
  ) THEN
    ALTER TABLE public.arbeitszeit_buchung
    ADD CONSTRAINT arbeitszeit_buchung_korrektur_fk FOREIGN KEY (tenant_id, korrigiert_id)
      REFERENCES public.arbeitszeit_buchung (tenant_id, id) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.arbeitszeit_buchung'::regclass
      AND conname = 'arbeitszeit_buchung_dauer_und_korrektur_chk'
  ) THEN
    ALTER TABLE public.arbeitszeit_buchung
    ADD CONSTRAINT arbeitszeit_buchung_dauer_und_korrektur_chk CHECK (
      dauer_minuten <> 0
      AND (dauer_minuten > 0 OR korrigiert_id IS NOT NULL)
      AND (korrigiert_id IS NULL) = (korrektur_grund IS NULL)
      AND (korrektur_grund IS NULL OR btrim(korrektur_grund) <> '')
      AND korrigiert_id IS DISTINCT FROM id
    ) NOT VALID;
  END IF;
END;
$arbeitszeit_vertrag$;

CREATE OR REPLACE FUNCTION private.arbeitszeit_buchung_unveraenderlich()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
    AND OLD.item_id IS NOT NULL AND NEW.item_id IS NULL
    AND (to_jsonb(NEW) - 'item_id') = (to_jsonb(OLD) - 'item_id')
    AND NOT EXISTS (
      SELECT 1 FROM public.items teil
      WHERE teil.tenant_id = OLD.tenant_id AND teil.id = OLD.item_id
    )
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'ARBEITSZEIT_BUCHUNG_UNVERAENDERLICH' USING ERRCODE = '23514';
END;
$funktion$;

REVOKE ALL ON FUNCTION private.arbeitszeit_buchung_unveraenderlich() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER arbeitszeit_buchung_unveraenderlich
  BEFORE UPDATE OR DELETE ON public.arbeitszeit_buchung
  FOR EACH ROW EXECUTE FUNCTION private.arbeitszeit_buchung_unveraenderlich();

-- Auch eine ältere Fassung muss den Originalmail-Bezug prüfen.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_extra_work_approval_v1_contract_chk,
  ADD CONSTRAINT events_extra_work_approval_v1_contract_chk
  CHECK (
    CASE WHEN event_type = 'ORDER_EXTRA_WORK_APPROVED_V1' THEN
      coalesce(
        nullif(btrim(tenant_id), '') IS NOT NULL
        AND nullif(btrim(order_id), '') IS NOT NULL
        AND user_id IS NOT NULL
        AND jsonb_typeof(payload) = 'object'
        AND jsonb_typeof(payload->'approvedNetAmountCents') = 'number'
        AND (payload->>'approvedNetAmountCents') ~ '^(0|[1-9][0-9]*)$'
        AND (payload->'approvedNetAmountCents') <= '9007199254740991'::jsonb
        AND jsonb_typeof(payload->'positions') = 'array'
        AND (payload->'positions') <> '[]'::jsonb
        AND jsonb_path_query_array(payload, $positions$
          $.positions[*] ? (@.type() == "object"
            && @.lineId.type() == "string"
            && @.lineId like_regex "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
            && @.lineVersion.type() == "number"
            && @.lineVersion.floor() == @.lineVersion
            && @.lineVersion >= 1 && @.lineVersion <= 2147483647)
        $positions$) = payload->'positions'
        AND CASE payload->>'channel'
          WHEN 'mail' THEN jsonb_typeof(payload->'intakeItemId') = 'string'
            AND (payload->>'intakeItemId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          WHEN 'telefon' THEN NOT (payload ? 'intakeItemId')
          ELSE false
        END
        AND jsonb_typeof(payload->'approvedAt') = 'string'
        AND (payload->>'approvedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
        AND pg_input_is_valid(payload->>'approvedAt', 'timestamptz')
        AND jsonb_typeof(payload->'approvedBy') = 'string'
        AND nullif(btrim(payload->>'approvedBy'), '') IS NOT NULL
        AND jsonb_typeof(payload->'confirmationText') = 'string'
        AND nullif(btrim(payload->>'confirmationText'), '') IS NOT NULL,
        false
      )
    ELSE true END
  );

CREATE OR REPLACE TRIGGER events_extra_work_approval_update_immutable
BEFORE UPDATE ON public.events FOR EACH ROW
WHEN (OLD.event_type = 'ORDER_EXTRA_WORK_APPROVED_V1' OR NEW.event_type = 'ORDER_EXTRA_WORK_APPROVED_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE OR REPLACE TRIGGER events_extra_work_approval_delete_immutable
BEFORE DELETE ON public.events FOR EACH ROW
WHEN (OLD.event_type = 'ORDER_EXTRA_WORK_APPROVED_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();
