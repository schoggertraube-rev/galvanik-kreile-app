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

-- Mehrarbeitszusagen und Ausschuss betreffen einen Auftrag. Ein Lauf kann mehrere Auftr?ge umfassen.
CREATE OR REPLACE FUNCTION private.today_event_scope_v1(event_type text)
RETURNS text LANGUAGE sql IMMUTABLE CALLED ON NULL INPUT PARALLEL SAFE SET search_path=pg_catalog AS $scope$
 SELECT CASE
  WHEN event_type IN (
   'ORDER_CANCELLED_V1',
   'ORDER_COLLECTION_ATTACH_PENDING_V1',
   'ORDER_COLLECTION_ATTACH_REPAIRED_V1',
   'ORDER_COLLECTION_CALL_CREATED_V1',
   'ORDER_COLLECTION_CALL_RESULT_V1',
   'ORDER_COLLECTION_CALL_UPDATED_V1',
   'ORDER_COLLECTION_MEMBER_REMOVED_V1',
   'ORDER_COLLECTION_PLANNED_V1',
   'ORDER_COLLECTION_REMINDER_PREPARED_V1',
   'ORDER_COLLECTION_REMINDER_SENT_V1',
   'ORDER_COLLECTION_REPLY_RECORDED_V1',
   'ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1',
   'ORDER_COLLECTION_TASK_ENDED_FOR_REPLY_V1',
   'ORDER_CONTENT_CHANGED_V1',
   'ORDER_CUSTOMER_INFORMED_V1',
   'ORDER_EXTRA_WORK_APPROVED_V1',
   'ORDER_FREEZE_CORRECTED_V1',
   'ORDER_FROZEN_V1',
   'ORDER_GOODS_OUT_DEBT_OVERRIDE_V1',
   'ORDER_HANDOVER_CHANGED_V1',
   'ORDER_HANDOVER_MAIL_V1',
   'ORDER_INTAKE_CREATED_V1',
   'ORDER_INTAKE_ORIGINAL_V1',
   'ORDER_INVOICE_PRICES_SET_V1',
   'ORDER_ITEM_EXTRA_WORK_CHANGED_V1',
   'ORDER_ITEM_FINISHED_CHANGED_V1',
   'ORDER_ITEM_SCRAP_REPORTED_V1',
   'ORDER_PICKED_UP_V1',
   'ORDER_PICKED_UP_V2',
   'ORDER_PICKED_UP_V3',
   'ORDER_PICKED_UP_V4',
   'ORDER_PICKUP_APPOINTMENT_SET_V1',
   'ORDER_PICKUP_NOTICE_CHANGED_V1',
   'ORDER_PRINT_JOBS_QUEUED_V1',
   'ORDER_PRINT_JOBS_RETIRED_V1',
   'ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1',
   'ORDER_PROMISED_DUE_DATE_CHANGED_V1',
   'ORDER_REWORK_CREATED_V1',
   'ORDER_STATION_CORRECTED_V1',
   'ORDER_STATION_MOVED_V1',
   'ORDER_STORAGE_FINAL_TASK_CLOSED_V1',
   'ORDER_STORAGE_FINAL_TASK_CREATED_V1',
   'ORDER_STORAGE_FINAL_TASK_UPDATED_V1',
   'ORDER_STORAGE_LETTER_VOIDED_V1',
   'ORDER_TASK_ASSIGNED_V1',
   'ORDER_TASK_HANDED_BACK_V1',
   'PAYMENT_MODE_SET_V1',
   'SHIPMENT_GROUP_HANDED_OVER_V1',
   'SHIPMENT_HANDED_OVER_V1',
   'SHIPMENT_MANUAL_TRACKING_SET_V1') THEN 'order'
  WHEN event_type IN (
   'COMMUNICATION_COLLECTION_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_COMPLAINT_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_DELIVERY_FAILED_V1',
   'COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1',
   'COMMUNICATION_DOCUMENT_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_DOCUMENT_PREPARED_V1',
   'COMMUNICATION_DOCUMENT_SENT_V1',
   'COMMUNICATION_INVOICE_HANDED_OVER_V1',
   'COMMUNICATION_INVOICE_TASK_CREATED_V1',
   'COMMUNICATION_MAIL_PREPARED_V1',
   'COMMUNICATION_MAIL_RESEND_CONFIRMED_V1',
   'COMMUNICATION_MAIL_SENT_V1',
   'CUSTOMER_AGREEMENT_REVOKED_V1',
   'CUSTOMER_AGREEMENT_SAVED_V1',
   'CUSTOMER_CREATED_V1',
   'CUSTOMER_CREDIT_PAYOUT_V1',
   'CUSTOMER_INVOICE_TERMS_ENABLED_V1',
   'CUSTOMER_UPDATED_V1') THEN 'customer'
  WHEN event_type IN (
   'INVOICE_CANCELLED_V1',
   'INVOICE_CREATED_V1',
   'INVOICE_CREATED_V2',
   'INVOICE_CREATED_V3',
   'INVOICE_MAIL_REMAINDER_PENDING_V1',
   'INVOICE_MAIL_REQUEST_SNAPSHOT_V1',
   'PAYMENT_CONFIRMED_V1') THEN 'invoice'
  WHEN event_type IN (
   'QUOTE_AWARDED_V1',
   'QUOTE_CALCULATION_V04',
   'QUOTE_COMPLAINT_LINKED_V1',
   'QUOTE_CONVERSION_REVERSED_V04',
   'QUOTE_CREATED_V1',
   'QUOTE_FOLLOWUP_COMPLETED_V1',
   'QUOTE_LIFECYCLE_V04',
   'QUOTE_MINUTES_FROM_TOTAL_V1',
   'QUOTE_ONSITE_PHASE_V04',
   'QUOTE_ONSITE_REQUESTED_V04',
   'QUOTE_ORDER_TASK_V1',
   'QUOTE_SETTINGS_UPDATED_V04',
   'QUOTE_SHIPPING_INCLUDED_SET_V1',
   'QUOTE_UPDATED_V1',
   'QUOTE_VAT_FROM_COMPANY_V1') THEN 'quote'
  WHEN event_type IN (
   'GOODS_RECEIPT_SAVED_V1',
   'INTAKE_DRAFT_DISCARDED_V1',
   'INTAKE_DRAFT_SAVED_V1') THEN 'intake'
  WHEN event_type IN (
   'USER_LAST_SEEN_RECORDED_V1') THEN 'none'
  WHEN event_type IN (
   'COMPLAINT_CHANGED_V1',
   'CUSTOMER_COMMERCIAL_UPDATED_V1',
   'CUSTOMER_NOTE_CHANGED_V1',
   'DELIVERY_NOTE_ORIGINAL_V1',
   'DELIVERY_NOTE_REQUESTED_V1',
   'DISPATCH_REPLY_RETRY_REQUIRED_V1',
   'EMAIL_TEMPLATE_UPDATED_V1',
   'EXTRA_WORK_CATALOG_CONFIGURED_V1',
   'EXTRA_WORK_RATE_SET_V1',
   'GALVANIK_HANDOFF_ORIGINAL_V1',
   'OFFLINE_NOTE_CONFLICT_TASK_V1',
   'OFFLINE_NOTE_CONFLICT_V1',
   'OFFLINE_WORKSHOP_REJECTED_TASK_V1',
   'OFFLINE_WORKSHOP_REJECTED_V1',
   'LAGER_STAMMBEFEHL_V1',
   'LAGER_ARTIKEL_AUFGABE_V1',
   'ORDER_BUNDLE_RUN_COMPLETED_V1',
   'ORDER_BUNDLE_RUN_STARTED_V1') THEN 'tenant'
  ELSE 'tenant' END
$scope$;
