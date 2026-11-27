-- MIG-H: Postfachanbindung, Betriebseinstellungen und Zahlungsbelege

ALTER TABLE public.intake_item DROP CONSTRAINT intake_item_kanal_chk;
ALTER TABLE public.intake_item ADD CONSTRAINT intake_item_kanal_chk CHECK (
  kanal IN ('mail','notiz','foto','datei','scan','weitergeleitet','system',
            'whatsapp','instagram','messenger','sms','telefon','formular')
);

CREATE TABLE public.kanal_anbindung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  kanal text NOT NULL CHECK (kanal IN ('mail','whatsapp','instagram','messenger','sms','telefon','formular')),
  adapter text NOT NULL CHECK (adapter IN ('m365','gmail','imap_smtp','meta','sms_anbieter','formular')),
  konto text NOT NULL,
  einstellungen jsonb NOT NULL DEFAULT '{}',
  geheimnis_id uuid,
  status text NOT NULL DEFAULT 'nicht_verbunden' CHECK (status IN ('nicht_verbunden','verbunden','gestoert','pausiert')),
  zuletzt_ok_at timestamptz,
  fehler_code text,
  fehler_at timestamptz,
  fehler_anzahl integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kanal, konto)
);
CREATE UNIQUE INDEX kanal_anbindung_m365_konto_eindeutig
  ON public.kanal_anbindung (lower(btrim(konto))) WHERE kanal='mail' AND adapter='m365';

CREATE TABLE public.kunde_kanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  kanal text NOT NULL CHECK (kanal IN ('whatsapp','instagram','messenger','sms','telefon')),
  adresse text NOT NULL,
  einwilligung_at timestamptz,
  einwilligung_quelle text CHECK (einwilligung_quelle IN ('kunde_schrieb_zuerst','schriftlich','muendlich_protokolliert')),
  widerruf_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kanal, adresse),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers(tenant_id, id)
);

ALTER TABLE public.kanal_anbindung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kunde_kanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY kanal_anbindung_tenant_isolation ON public.kanal_anbindung
  USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
  WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
CREATE POLICY kunde_kanal_tenant_isolation ON public.kunde_kanal
  USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
  WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
REVOKE ALL ON public.kanal_anbindung, public.kunde_kanal FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.kanal_anbindung, public.kunde_kanal TO service_role;

CREATE FUNCTION private.postfach_takt_akteur_id(p_tenant_id text) RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT (substr(hash,1,12)||'3'||substr(hash,14,3)||'8'||substr(hash,18))::uuid
  FROM (SELECT md5('kreile:postfach-takt:v1:'||p_tenant_id) AS hash) digest;
$$;
REVOKE ALL ON FUNCTION private.postfach_takt_akteur_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.postfach_takt_akteur_id(text) TO service_role;

CREATE FUNCTION private.postfach_takt_akteur_schutz() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.id=private.postfach_takt_akteur_id(OLD.tenant_id) THEN
    RAISE EXCEPTION 'POSTFACH_TAKT_AKTEUR_UNVERAENDERLICH';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.id=private.postfach_takt_akteur_id(NEW.tenant_id)
    AND (TG_OP <> 'INSERT' OR NEW.active OR NEW.email IS NOT NULL OR NEW.pin_hash IS NOT NULL
       OR NEW.role <> 'readonly' OR NEW.ist_produktiv IS DISTINCT FROM false
       OR NEW.full_name <> 'Postfach-Abruf (System)') THEN
    RAISE EXCEPTION 'POSTFACH_TAKT_AKTEUR_NICHT_ANMELDBAR';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER app_users_postfach_takt_akteur_schutz BEFORE INSERT OR UPDATE OR DELETE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION private.postfach_takt_akteur_schutz();
REVOKE ALL ON FUNCTION private.postfach_takt_akteur_schutz() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.hinterlege_postfach_takt_akteur(p_tenant_id text) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public, private AS $$
DECLARE actor_id uuid := private.postfach_takt_akteur_id(p_tenant_id);
BEGIN
  INSERT INTO public.app_users(id, tenant_id, full_name, role, active, ist_produktiv)
    VALUES (actor_id, p_tenant_id, 'Postfach-Abruf (System)', 'readonly', false, false)
    ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users WHERE tenant_id=p_tenant_id AND id=actor_id
      AND full_name='Postfach-Abruf (System)' AND role='readonly' AND active=false
      AND ist_produktiv=false AND pin_hash IS NULL AND email IS NULL
  ) THEN
    RAISE EXCEPTION 'POSTFACH_TAKT_AKTEUR_BELEGT';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.hinterlege_postfach_takt_akteur(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.hinterlege_postfach_takt_akteur_bei_firma() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  PERFORM private.hinterlege_postfach_takt_akteur(NEW.tenant_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.hinterlege_postfach_takt_akteur_bei_firma() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER company_settings_postfach_takt_akteur AFTER INSERT ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION private.hinterlege_postfach_takt_akteur_bei_firma();

SELECT private.hinterlege_postfach_takt_akteur(tenant_id)
FROM (SELECT DISTINCT tenant_id FROM public.company_settings) tenants;

-- MIG-H, after creation of the stable mailbox actor.
CREATE FUNCTION private.postfach_takt_rechte_schutz() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,private AS $$
BEGIN
  IF TG_OP<>'INSERT' AND OLD.user_id=private.postfach_takt_akteur_id(OLD.tenant_id) THEN
    RAISE EXCEPTION 'POSTFACH_TAKT_AKTEUR_RECHTE_GESPERRT';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.user_id=private.postfach_takt_akteur_id(NEW.tenant_id) THEN
    RAISE EXCEPTION 'POSTFACH_TAKT_AKTEUR_RECHTE_GESPERRT';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.postfach_takt_rechte_schutz() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER app_user_rights_postfach_takt_schutz BEFORE INSERT OR UPDATE OR DELETE ON public.app_user_rights
  FOR EACH ROW EXECUTE FUNCTION private.postfach_takt_rechte_schutz();

-- MIG-H: Abrufintervall, Steuerwerte und Untergrenze der Wochenlast.
ALTER TABLE public.company_settings
  ADD COLUMN postfach_abruf_minuten integer NOT NULL DEFAULT 5
    CHECK (postfach_abruf_minuten BETWEEN 1 AND 60),
  ADD COLUMN postfach_ausfall_toleranz_minuten integer NOT NULL DEFAULT 1440
    CHECK (postfach_ausfall_toleranz_minuten > 0),
  ADD COLUMN freemail_domaenen text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN ust_versteuerung text NOT NULL DEFAULT 'soll'
    CHECK (ust_versteuerung IN ('soll', 'ist')),
  ADD COLUMN kasse_tse text NOT NULL DEFAULT 'keine'
    CHECK (kasse_tse IN ('keine', 'extern')),
  ADD COLUMN storno_belegtyp text NOT NULL DEFAULT '384'
    CHECK (storno_belegtyp IN ('384', '381')),
  DROP CONSTRAINT company_settings_auslastung_wenig_pct_check,
  ADD CONSTRAINT company_settings_auslastung_wenig_pct_check
    CHECK (auslastung_wenig_pct BETWEEN 0 AND 100);

-- PIN-Sicherheit: neue Einstellungen und ausschließlich bcrypt-Hashes.

ALTER TABLE public.app_users
  ADD COLUMN pin_wechsel_noetig boolean NOT NULL DEFAULT false;

UPDATE public.app_users
SET pin_hash = NULL, pin_wechsel_noetig = true
WHERE pin_hash IS NOT NULL AND pin_hash !~ '^\$2[aby]\$[0-9]{2}\$.{53}$';

ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_pin_hash_bcrypt
  CHECK (pin_hash IS NULL OR pin_hash ~ '^\$2[aby]\$[0-9]{2}\$.{53}$') NOT VALID;

ALTER TABLE public.app_users
  VALIDATE CONSTRAINT app_users_pin_hash_bcrypt;

ALTER TABLE public.company_settings
  ADD COLUMN wartung_fehlversuche_grenze integer NOT NULL DEFAULT 10
  CHECK (wartung_fehlversuche_grenze BETWEEN 3 AND 50);

-- Zahlungseingang: belegtes Bankdatum getrennt vom Buchungszeitpunkt.

-- L-G3c: Keep the immutable capture time and validate the separate bank day.
CREATE FUNCTION private.payment_receipt_day_v1(p_day text) RETURNS date
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
DECLARE
  receipt_day date;
BEGIN
  IF p_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
  BEGIN
    receipt_day := p_day::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN NULL;
  END;
  IF to_char(receipt_day,'YYYY-MM-DD')<>p_day THEN RETURN NULL; END IF;
  RETURN receipt_day;
END;
$$;

CREATE FUNCTION private.payment_receipt_effective_at_v1(p_payload jsonb) RETURNS timestamptz
LANGUAGE sql STABLE STRICT SET search_path=pg_catalog,private AS $$
  SELECT CASE WHEN p_payload ? 'receivedOn'
    THEN private.payment_receipt_day_v1(p_payload->>'receivedOn')::timestamp AT TIME ZONE 'Europe/Berlin'
    ELSE (p_payload->>'occurredAt')::timestamptz END
$$;

CREATE FUNCTION private.payment_receipt_day_matches_invoice_v1(
  p_tenant text,p_payload jsonb,p_recorded_at timestamptz
) RETURNS boolean
LANGUAGE sql STABLE STRICT SET search_path=pg_catalog,private AS $$
  SELECT CASE WHEN NOT (p_payload ? 'receivedOn') THEN true
    WHEN jsonb_typeof(p_payload->'receivedOn') IS DISTINCT FROM 'string' THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.invoices invoice
      WHERE invoice.tenant_id=p_tenant AND invoice.id::text=p_payload->>'invoiceId'
        AND invoice.payment_contract_version=1 AND invoice.issued_at IS NOT NULL
        AND private.payment_receipt_day_v1(p_payload->>'receivedOn') BETWEEN
          (invoice.issued_at AT TIME ZONE 'Europe/Berlin')::date AND (p_recorded_at AT TIME ZONE 'Europe/Berlin')::date
    ) END
$$;

REVOKE ALL ON FUNCTION private.payment_receipt_day_v1(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.payment_receipt_effective_at_v1(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.payment_receipt_day_matches_invoice_v1(text,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.payment_receipt_day_v1(text),
  private.payment_receipt_effective_at_v1(jsonb),
  private.payment_receipt_day_matches_invoice_v1(text,jsonb,timestamptz) TO service_role;

ALTER TABLE public.events DROP CONSTRAINT events_payment_confirmed_v1_contract_chk;
ALTER TABLE public.events ADD CONSTRAINT events_payment_confirmed_v1_contract_chk CHECK((event_type::text <> 'PAYMENT_CONFIRMED_V1'::text OR COALESCE(tenant_id IS NOT NULL AND (order_id IS NOT NULL OR (order_id IS NULL AND payload ? 'collectionId')) AND user_id IS NOT NULL AND client_event_id IS NOT NULL AND correlation_id IS NOT NULL AND event_schema_version = 1 AND aggregate_version > 0 AND item_id IS NULL AND status::text = 'success'::text AND station IS NULL AND from_station IS NULL AND jsonb_typeof(payload) = 'object'::text AND (payload-'receivedOn') = (jsonb_build_object('invoiceId', payload -> 'invoiceId'::text, 'orderId', payload -> 'orderId'::text, 'receiptId', payload -> 'receiptId'::text, 'amountCents', payload -> 'amountCents'::text, 'grossAmountCents', payload -> 'grossAmountCents'::text, 'paidAmountCents', payload -> 'paidAmountCents'::text, 'openAmountCents', payload -> 'openAmountCents'::text, 'currency', payload -> 'currency'::text, 'paymentMode', payload -> 'paymentMode'::text, 'paymentStatus', payload -> 'paymentStatus'::text, 'method', payload -> 'method'::text, 'occurredAt', payload -> 'occurredAt'::text, 'paymentVersion', payload -> 'paymentVersion'::text, 'source', payload -> 'source'::text) ||
CASE
    WHEN (payload ->> 'method'::text) = 'guthaben'::text THEN jsonb_build_object('creditVersion', payload -> 'creditVersion'::text)
    ELSE '{}'::jsonb
END || CASE WHEN payload ? 'collectionId' THEN jsonb_build_object('collectionId',payload->'collectionId') ELSE '{}'::jsonb END) AND jsonb_typeof(payload -> 'invoiceId'::text) = 'string'::text AND (payload ->> 'invoiceId'::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text AND ((jsonb_typeof(payload -> 'orderId'::text) = 'string'::text AND (payload ->> 'orderId'::text) = order_id) AND NOT(payload ? 'collectionId') OR (order_id IS NULL AND payload->'orderId'='null'::jsonb AND jsonb_typeof(payload->'collectionId')='string' AND payload->>'paymentMode'='rechnung' AND private.invoice_collection_payment_source_valid(tenant_id::text,payload->>'invoiceId',payload->>'collectionId'))) AND jsonb_typeof(payload -> 'receiptId'::text) = 'string'::text AND btrim(payload ->> 'receiptId'::text) = (payload ->> 'receiptId'::text) AND length(payload ->> 'receiptId'::text) >= 1 AND length(payload ->> 'receiptId'::text) <= 200 AND (payload ->> 'currency'::text) = 'EUR'::text AND ((payload ->> 'paymentMode'::text) = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND ((payload ->> 'paymentStatus'::text) = ANY (ARRAY['teilbezahlt'::text, 'bezahlt'::text])) AND ((payload ->> 'method'::text) = ANY (ARRAY['bar'::text, 'ueberweisung'::text, 'karte'::text, 'guthaben'::text])) AND ((payload ->> 'source'::text) = ANY (ARRAY['manual'::text, 'bank'::text, 'mollie'::text])) AND (payload ->> 'occurredAt'::text) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'::text AND
CASE
    WHEN jsonb_typeof(payload -> 'amountCents'::text) = 'number'::text AND jsonb_typeof(payload -> 'grossAmountCents'::text) = 'number'::text AND jsonb_typeof(payload -> 'paidAmountCents'::text) = 'number'::text AND jsonb_typeof(payload -> 'openAmountCents'::text) = 'number'::text AND jsonb_typeof(payload -> 'paymentVersion'::text) = 'number'::text THEN
    CASE
        WHEN (payload ->> 'amountCents'::text) ~ '^[0-9]+$'::text AND (payload ->> 'grossAmountCents'::text) ~ '^[0-9]+$'::text AND (payload ->> 'paidAmountCents'::text) ~ '^[0-9]+$'::text AND (payload ->> 'openAmountCents'::text) ~ '^[0-9]+$'::text AND (payload ->> 'paymentVersion'::text) ~ '^[0-9]+$'::text THEN ((payload ->> 'amountCents'::text)::numeric) > 0::numeric AND ((payload ->> 'grossAmountCents'::text)::numeric) > 0::numeric AND ((payload ->> 'paidAmountCents'::text)::numeric) > 0::numeric AND ((payload ->> 'openAmountCents'::text)::numeric) >= 0::numeric AND ((payload ->> 'paymentVersion'::text)::numeric) = aggregate_version::numeric AND ((payload ->> 'amountCents'::text)::numeric) <= ((payload ->> 'paidAmountCents'::text)::numeric) AND (((payload ->> 'paidAmountCents'::text)::numeric) + ((payload ->> 'openAmountCents'::text)::numeric)) = ((payload ->> 'grossAmountCents'::text)::numeric) AND
        CASE
            WHEN (payload ->> 'paymentStatus'::text) = 'bezahlt'::text THEN ((payload ->> 'openAmountCents'::text)::numeric) = 0::numeric AND ((payload ->> 'paidAmountCents'::text)::numeric) = ((payload ->> 'grossAmountCents'::text)::numeric)
            ELSE ((payload ->> 'openAmountCents'::text)::numeric) > 0::numeric AND ((payload ->> 'paidAmountCents'::text)::numeric) < ((payload ->> 'grossAmountCents'::text)::numeric)
        END
        ELSE false
    END
    ELSE false
END, false)) AND (event_type::text <> 'PAYMENT_CONFIRMED_V1'::text OR (payload ->> 'method'::text) <> 'guthaben'::text OR COALESCE(jsonb_typeof(payload -> 'creditVersion'::text) = 'number'::text AND
CASE
    WHEN (payload ->> 'creditVersion'::text) ~ '^[0-9]+$'::text THEN ((payload ->> 'creditVersion'::text)::numeric) >= 0::numeric AND ((payload ->> 'creditVersion'::text)::numeric) <= 2147483647::numeric
    ELSE false
END, false))) NOT VALID;

ALTER TABLE public.events ADD CONSTRAINT events_payment_confirmed_v1_received_day_chk
CHECK (event_type::text<>'PAYMENT_CONFIRMED_V1' OR NOT (payload ? 'receivedOn') OR
  coalesce(private.payment_receipt_day_matches_invoice_v1(
    tenant_id::text,payload,created_at AT TIME ZONE 'UTC'),false)) NOT VALID;

ALTER TABLE public.invoices DROP CONSTRAINT invoices_f15_method_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f15_method_chk
 CHECK (payment_method IS NULL OR payment_method IN ('bar','ueberweisung','karte','guthaben')) NOT VALID;

-- MIG-H / L-G3b: qualify one correction against its immutable payment receipt.
CREATE FUNCTION private.payment_reversal_source_v1(
  p_tenant text, p_order text, p_version integer, p_payload jsonb, p_recorded timestamp without time zone
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $reversal$
  SELECT EXISTS (
    SELECT 1
    FROM public.events receipt
    JOIN public.invoices invoice ON invoice.tenant_id=p_tenant AND invoice.id::text=p_payload->>'invoiceId'
    WHERE receipt.tenant_id=p_tenant
      AND receipt.event_type='PAYMENT_CONFIRMED_V1' AND receipt.status='success'
      AND receipt.order_id IS NOT DISTINCT FROM p_order AND invoice.order_id IS NOT DISTINCT FROM p_order
      AND receipt.payload->>'invoiceId'=invoice.id::text AND receipt.payload->>'receiptId'=p_payload->>'receiptId'
      AND invoice.payment_contract_version=1 AND receipt.aggregate_version<p_version
      AND ((p_order IS NOT NULL AND NOT (p_payload ? 'collectionId') AND NOT (receipt.payload ? 'collectionId'))
        OR (p_order IS NULL AND p_payload->>'collectionId'=invoice.snapshot#>>'{collection,collectionId}'
          AND receipt.payload->>'collectionId'=p_payload->>'collectionId'
          AND private.invoice_collection_payment_source_valid(p_tenant,invoice.id::text,p_payload->>'collectionId')))
      AND (receipt.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date
        = (p_recorded AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date
      AND receipt.created_at<=p_recorded
  )
$reversal$;

REVOKE ALL ON FUNCTION private.payment_reversal_source_v1(text,text,integer,jsonb,timestamp without time zone)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.payment_reversal_source_v1(text,text,integer,jsonb,timestamp without time zone)
  TO service_role;

ALTER TABLE public.events ADD CONSTRAINT events_payment_reversed_v1_contract_chk
  CHECK (event_type<>'PAYMENT_REVERSED_V1' OR COALESCE(
    tenant_id IS NOT NULL AND user_id IS NOT NULL AND client_event_id IS NOT NULL AND correlation_id IS NOT NULL
    AND event_schema_version=1 AND aggregate_version>=2 AND status='success'
    AND item_id IS NULL AND station IS NULL AND from_station IS NULL AND created_at IS NOT NULL
    AND jsonb_typeof(payload)='object'
    AND payload = jsonb_build_object('invoiceId',payload->'invoiceId','orderId',payload->'orderId',
      'receiptId',payload->'receiptId','reason',payload->'reason','occurredAt',payload->'occurredAt')
      || CASE WHEN payload ? 'collectionId' THEN jsonb_build_object('collectionId',payload->'collectionId') ELSE '{}'::jsonb END
    AND jsonb_typeof(payload->'invoiceId')='string'
    AND ((order_id IS NOT NULL AND jsonb_typeof(payload->'orderId')='string' AND payload->>'orderId'=order_id)
      OR (order_id IS NULL AND payload->'orderId'='null'::jsonb AND jsonb_typeof(payload->'collectionId')='string'))
    AND jsonb_typeof(payload->'receiptId')='string' AND jsonb_typeof(payload->'reason')='string'
    AND NULLIF(btrim(payload->>'reason'),'') IS NOT NULL
    AND jsonb_typeof(payload->'occurredAt')='string'
    AND payload->>'occurredAt'=to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    AND private.payment_reversal_source_v1(tenant_id,order_id,aggregate_version,payload,created_at)
  ,false)) NOT VALID;

CREATE UNIQUE INDEX events_f15_payment_reversal_receipt_uidx
  ON public.events (tenant_id,(payload->>'receiptId')) WHERE event_type='PAYMENT_REVERSED_V1';

DROP INDEX public.events_f15_payment_invoice_version_uidx;
CREATE UNIQUE INDEX events_f15_payment_invoice_version_uidx
  ON public.events (tenant_id,(payload->>'invoiceId'),aggregate_version)
  WHERE event_type IN ('PAYMENT_CONFIRMED_V1','PAYMENT_REVERSED_V1');

CREATE TRIGGER events_f15_payment_reversal_update_guard BEFORE UPDATE ON public.events
  FOR EACH ROW WHEN (OLD.event_type='PAYMENT_REVERSED_V1' OR NEW.event_type='PAYMENT_REVERSED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_f15_payment_reversal_delete_guard BEFORE DELETE ON public.events
  FOR EACH ROW WHEN (OLD.event_type='PAYMENT_REVERSED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

-- MIG-H / L-G3b: compute the remaining payment from the same historical events.
-- The canonical invoice stays the source for all device views.
CREATE FUNCTION private.payment_effective_receipts_v1(
  p_tenant text,p_invoice uuid,p_version integer
) RETURNS TABLE(paid_cents bigint,receipt_id text,method text,paid_at timestamptz)
LANGUAGE sql STABLE STRICT SECURITY INVOKER SET search_path='' AS $effective$
  WITH effective AS MATERIALIZED (
    SELECT receipt.payload,receipt.aggregate_version
    FROM public.events receipt
    WHERE receipt.tenant_id=p_tenant AND receipt.event_type='PAYMENT_CONFIRMED_V1'
      AND receipt.status='success' AND receipt.payload->>'invoiceId'=p_invoice::text
      AND receipt.aggregate_version<=p_version
      AND NOT EXISTS (
        SELECT 1 FROM public.events reversal
        WHERE reversal.tenant_id=receipt.tenant_id AND reversal.event_type='PAYMENT_REVERSED_V1'
          AND reversal.status='success' AND reversal.payload->>'receiptId'=receipt.payload->>'receiptId'
          AND reversal.payload->>'invoiceId'=receipt.payload->>'invoiceId'
          AND reversal.order_id IS NOT DISTINCT FROM receipt.order_id
          AND reversal.aggregate_version>receipt.aggregate_version AND reversal.aggregate_version<=p_version
      )
  ), total AS (
    SELECT COALESCE(sum((payload->>'amountCents')::bigint),0)::bigint AS paid_cents FROM effective
  ), latest AS (
    SELECT payload FROM effective ORDER BY aggregate_version DESC LIMIT 1
  )
  SELECT total.paid_cents,latest.payload->>'receiptId',latest.payload->>'method',
    private.payment_receipt_effective_at_v1(latest.payload)
  FROM total LEFT JOIN latest ON true
$effective$;

CREATE FUNCTION private.payment_reversal_invoice_matches_v1(p_invoice public.invoices)
RETURNS boolean LANGUAGE sql STABLE STRICT SECURITY INVOKER SET search_path='' AS $invoice$
  SELECT EXISTS (
    SELECT 1 FROM public.events reversal
    CROSS JOIN LATERAL private.payment_effective_receipts_v1(p_invoice.tenant_id,p_invoice.id,p_invoice.payment_version) paid
    WHERE reversal.tenant_id=p_invoice.tenant_id AND reversal.id=p_invoice.payment_event_id
      AND reversal.correlation_id=p_invoice.payment_correlation_id
      AND reversal.event_type='PAYMENT_REVERSED_V1' AND reversal.status='success'
      AND reversal.aggregate_version=p_invoice.payment_version
      AND reversal.order_id IS NOT DISTINCT FROM p_invoice.order_id
      AND reversal.payload->>'invoiceId'=p_invoice.id::text
      AND ((p_invoice.order_id IS NOT NULL AND NOT (reversal.payload ? 'collectionId'))
        OR (p_invoice.order_id IS NULL AND reversal.payload->>'collectionId'=p_invoice.snapshot#>>'{collection,collectionId}'))
      AND p_invoice.payment_paid_amount_cents=paid.paid_cents AND paid.paid_cents<p_invoice.gross_amount_cents
      AND p_invoice.payment_open_amount_cents=p_invoice.gross_amount_cents-paid.paid_cents
      AND p_invoice.payment_status=CASE WHEN paid.paid_cents=0 THEN 'offen' ELSE 'teilbezahlt' END
      AND p_invoice.payment_receipt_id IS NOT DISTINCT FROM paid.receipt_id
      AND p_invoice.payment_method IS NOT DISTINCT FROM paid.method
      AND p_invoice.payment_paid_at IS NOT DISTINCT FROM paid.paid_at
  )
$invoice$;

REVOKE ALL ON FUNCTION private.payment_effective_receipts_v1(text,uuid,integer),
  private.payment_reversal_invoice_matches_v1(public.invoices) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.payment_effective_receipts_v1(text,uuid,integer),
  private.payment_reversal_invoice_matches_v1(public.invoices) TO service_role;

-- MIG-H / L-G3b: the existing append-only credit ledger gets the exact inverse
-- of a secured debit. The correction and invoice remain in the payment transaction.
ALTER TABLE public.customer_credit_entries
  DROP CONSTRAINT customer_credit_entries_kind_check,
  DROP CONSTRAINT customer_credit_direction,
  DROP CONSTRAINT customer_credit_invoice_kind,
  ADD CONSTRAINT customer_credit_entries_kind_check CHECK (
    kind IN ('storno_gutschrift','verrechnung','auszahlung','verrechnung_ruecknahme')
  ),
  ADD CONSTRAINT customer_credit_direction CHECK (
    (kind IN ('storno_gutschrift','verrechnung_ruecknahme') AND amount_cents>0)
    OR (kind IN ('verrechnung','auszahlung') AND amount_cents<0)
  ),
  ADD CONSTRAINT customer_credit_invoice_kind CHECK (
    (kind IN ('storno_gutschrift','verrechnung','verrechnung_ruecknahme') AND invoice_id IS NOT NULL AND payment_method IS NULL)
    OR (kind='auszahlung' AND invoice_id IS NULL AND payment_method IS NOT NULL)
  );

CREATE FUNCTION private.customer_credit_original_debit_v1(
  p_tenant text,p_invoice uuid,p_receipt text
) RETURNS SETOF public.customer_credit_entries
LANGUAGE sql STABLE STRICT SECURITY INVOKER SET search_path='' AS $debit$
  SELECT debit.*
  FROM public.invoices invoice
  JOIN public.events original ON original.tenant_id=invoice.tenant_id
    AND original.order_id IS NOT DISTINCT FROM invoice.order_id
    AND original.event_type='PAYMENT_CONFIRMED_V1' AND original.status='success'
    AND original.payload->>'invoiceId'=invoice.id::text AND original.payload->>'receiptId'=p_receipt
    AND original.payload->>'method'='guthaben'
  JOIN public.customer_credit_entries debit ON debit.tenant_id=invoice.tenant_id
    AND debit.idempotency_key=original.client_event_id::text AND debit.kind='verrechnung'
    AND debit.invoice_id=invoice.id AND debit.customer_id=invoice.customer_id
    AND debit.actor_user_id=original.user_id AND debit.amount_cents=-(original.payload->>'amountCents')::bigint
  WHERE invoice.tenant_id=p_tenant AND invoice.id=p_invoice AND invoice.payment_contract_version=1
$debit$;

CREATE FUNCTION private.customer_credit_reversal_source_v1(
  p_entry public.customer_credit_entries,p_event public.events
) RETURNS boolean
LANGUAGE sql STABLE STRICT SECURITY INVOKER SET search_path='' AS $credit$
  SELECT p_entry.kind='verrechnung_ruecknahme' AND p_event.event_type='PAYMENT_REVERSED_V1'
    AND p_event.status='success' AND p_event.tenant_id=p_entry.tenant_id
    AND p_event.payload->>'invoiceId'=p_entry.invoice_id::text
    AND p_event.client_event_id::text=p_entry.idempotency_key AND p_event.user_id=p_entry.actor_user_id
    AND p_event.payload->>'receiptId'=p_entry.reference AND p_event.payload->>'reason'=p_entry.note
    AND EXISTS (
      SELECT 1 FROM private.customer_credit_original_debit_v1(p_entry.tenant_id,p_entry.invoice_id,p_entry.reference) debit
      WHERE debit.customer_id=p_entry.customer_id AND p_entry.amount_cents=-debit.amount_cents
    )
$credit$;

-- A retained credit receipt need not be the newest payment event after a reversal.
-- Both branches qualify its existing debit, invoice balance, method and effective date.
CREATE OR REPLACE FUNCTION private.customer_credit_payment_receipt_v1(p_tenant text,p_invoice uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $credit$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices invoice
    JOIN public.events head ON head.tenant_id=invoice.tenant_id AND head.id=invoice.payment_event_id
      AND head.correlation_id=invoice.payment_correlation_id AND head.aggregate_version=invoice.payment_version
    JOIN public.events original ON original.tenant_id=invoice.tenant_id AND original.event_type='PAYMENT_CONFIRMED_V1'
      AND original.status='success' AND original.order_id IS NOT DISTINCT FROM invoice.order_id
      AND original.payload->>'invoiceId'=invoice.id::text AND original.payload->>'receiptId'=invoice.payment_receipt_id
      AND original.payload->>'method'='guthaben'
    WHERE invoice.tenant_id=p_tenant AND invoice.id=p_invoice AND invoice.payment_contract_version=1
      AND invoice.payment_method='guthaben' AND invoice.payment_paid_at=private.payment_receipt_effective_at_v1(original.payload)
      AND EXISTS (SELECT 1 FROM private.customer_credit_original_debit_v1(p_tenant,p_invoice,invoice.payment_receipt_id))
      AND (
        (head.id=original.id
          AND invoice.payment_paid_amount_cents=(original.payload->>'paidAmountCents')::bigint
          AND invoice.payment_open_amount_cents=(original.payload->>'openAmountCents')::bigint)
        OR (head.event_type='PAYMENT_REVERSED_V1' AND private.payment_reversal_invoice_matches_v1(invoice))
      )
  )
$credit$;

-- No reversal can commit if the new invoice state or the promised credit inverse is absent.
CREATE FUNCTION private.guard_payment_reversal_commit_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.tenant_id=NEW.tenant_id AND invoice.id::text=NEW.payload->>'invoiceId'
      AND invoice.status='issued' AND invoice.payment_event_id=NEW.id
      AND private.payment_reversal_invoice_matches_v1(invoice)
  ) THEN
    RAISE EXCEPTION 'PAYMENT_REVERSAL_INVOICE_REQUIRED' USING ERRCODE='23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.events original
    WHERE original.tenant_id=NEW.tenant_id AND original.event_type='PAYMENT_CONFIRMED_V1'
      AND original.payload->>'receiptId'=NEW.payload->>'receiptId'
      AND original.payload->>'method'='guthaben'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.customer_credit_entries inverse
    WHERE inverse.tenant_id=NEW.tenant_id AND inverse.idempotency_key=NEW.client_event_id::text
      AND private.customer_credit_reversal_source_v1(inverse,NEW)
  ) THEN
    RAISE EXCEPTION 'PAYMENT_REVERSAL_CREDIT_REQUIRED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION private.customer_credit_original_debit_v1(text,uuid,text),
  private.customer_credit_reversal_source_v1(public.customer_credit_entries,public.events),
  private.guard_payment_reversal_commit_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.customer_credit_original_debit_v1(text,uuid,text),
  private.customer_credit_reversal_source_v1(public.customer_credit_entries,public.events) TO service_role;

CREATE CONSTRAINT TRIGGER payment_reversal_commit_guard AFTER INSERT ON public.events
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.event_type='PAYMENT_REVERSED_V1')
  EXECUTE FUNCTION private.guard_payment_reversal_commit_v1();

CREATE OR REPLACE FUNCTION private.guard_customer_credit_source_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.kind='storno_gutschrift' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices invoice
      JOIN private.v_invoice_receipt_v1 receipt ON receipt.tenant_id=invoice.tenant_id
        AND receipt.invoice_id=invoice.id AND receipt.event_type='INVOICE_CANCELLED_V1'
        AND receipt.event_id=invoice.cancel_event_id AND receipt.integrity_ok
      WHERE invoice.tenant_id=NEW.tenant_id AND invoice.id=NEW.invoice_id
        AND invoice.customer_id=NEW.customer_id AND invoice.status='cancelled'
        AND invoice.cancelled_by=NEW.actor_user_id
        AND invoice.cancel_client_event_id::text=NEW.idempotency_key
        AND invoice.payment_paid_amount_cents=NEW.amount_cents
    ) THEN RAISE EXCEPTION 'CUSTOMER_CREDIT_CANCELLATION_RECEIPT_REQUIRED' USING ERRCODE='23514'; END IF;
  ELSIF NEW.kind='verrechnung' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.events event JOIN public.invoices invoice
        ON invoice.tenant_id=event.tenant_id AND invoice.id::text=event.payload->>'invoiceId'
      WHERE event.tenant_id=NEW.tenant_id AND event.event_type='PAYMENT_CONFIRMED_V1'
        AND event.client_event_id::text=NEW.idempotency_key AND event.user_id=NEW.actor_user_id
        AND invoice.id=NEW.invoice_id AND invoice.customer_id=NEW.customer_id
        AND private.customer_credit_payment_receipt_v1(NEW.tenant_id,NEW.invoice_id)
        AND event.payload->>'method'='guthaben'
        AND event.payload->>'amountCents'=(-NEW.amount_cents)::text
    ) THEN RAISE EXCEPTION 'CUSTOMER_CREDIT_PAYMENT_RECEIPT_REQUIRED' USING ERRCODE='23514'; END IF;
  ELSIF NEW.kind='verrechnung_ruecknahme' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.events reversal
      WHERE reversal.tenant_id=NEW.tenant_id AND reversal.client_event_id::text=NEW.idempotency_key
        AND reversal.event_type='PAYMENT_REVERSED_V1'
        AND private.customer_credit_reversal_source_v1(NEW,reversal)
    ) THEN RAISE EXCEPTION 'CUSTOMER_CREDIT_REVERSAL_RECEIPT_REQUIRED' USING ERRCODE='23514'; END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.events event
      WHERE event.tenant_id=NEW.tenant_id AND event.event_type='CUSTOMER_CREDIT_PAYOUT_V1'
        AND event.client_event_id::text=NEW.idempotency_key AND event.user_id=NEW.actor_user_id
        AND event.payload->>'creditEntryId'=NEW.id::text
        AND event.payload->>'customerId'=NEW.customer_id
        AND event.payload->>'amountCents'=(-NEW.amount_cents)::text
        AND event.payload->>'method'=NEW.payment_method
        AND event.payload->>'reference' IS NOT DISTINCT FROM NEW.reference
    ) THEN RAISE EXCEPTION 'CUSTOMER_CREDIT_PAYOUT_RECEIPT_REQUIRED' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END
$function$;

ALTER TABLE public.invoices DROP CONSTRAINT invoices_f15_amounts_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f15_amounts_chk
 CHECK (((payment_contract_version IS DISTINCT FROM 1) OR COALESCE(((gross_amount_cents IS NOT NULL) AND (payment_mode IS NOT NULL) AND (payment_status IS NOT NULL) AND (payment_currency = 'EUR'::text) AND (payment_open_amount_cents >= 0) AND (payment_paid_amount_cents >= 0) AND ((payment_paid_amount_cents + payment_open_amount_cents) = gross_amount_cents) AND (payment_version >= 0) AND (private.payment_reversal_invoice_matches_v1(invoices) OR ((payment_status = 'offen'::text) AND (payment_paid_amount_cents = 0) AND (payment_open_amount_cents = gross_amount_cents) AND (payment_version = 0) AND (payment_method IS NULL) AND (payment_paid_at IS NULL) AND (payment_receipt_id IS NULL) AND (payment_event_id IS NULL) AND (payment_correlation_id IS NULL)) OR ((payment_status = 'teilbezahlt'::text) AND (payment_paid_amount_cents > 0) AND (payment_open_amount_cents > 0) AND (payment_version > 0) AND (payment_method = ANY (ARRAY['bar'::text, 'ueberweisung'::text, 'karte'::text, 'guthaben'::text])) AND (payment_paid_at IS NOT NULL) AND (payment_receipt_id IS NOT NULL) AND (btrim(payment_receipt_id) = payment_receipt_id) AND ((length(payment_receipt_id) >= 1) AND (length(payment_receipt_id) <= 200)) AND (payment_event_id IS NOT NULL) AND (btrim(payment_event_id) = payment_event_id) AND ((length(payment_event_id) >= 1) AND (length(payment_event_id) <= 128)) AND (payment_correlation_id IS NOT NULL)) OR ((payment_status = 'bezahlt'::text) AND (payment_paid_amount_cents = gross_amount_cents) AND (payment_open_amount_cents = 0) AND (payment_version > 0) AND (payment_method = ANY (ARRAY['bar'::text, 'ueberweisung'::text, 'karte'::text, 'guthaben'::text])) AND (payment_paid_at IS NOT NULL) AND (payment_receipt_id IS NOT NULL) AND (btrim(payment_receipt_id) = payment_receipt_id) AND ((length(payment_receipt_id) >= 1) AND (length(payment_receipt_id) <= 200)) AND (payment_event_id IS NOT NULL) AND (btrim(payment_event_id) = payment_event_id) AND ((length(payment_event_id) >= 1) AND (length(payment_event_id) <= 128)) AND (payment_correlation_id IS NOT NULL)))), false))) NOT VALID;

CREATE OR REPLACE VIEW private.v_payment_summary_v1 WITH(security_invoker=true) AS
 SELECT invoice.id AS invoice_id,
    invoice.tenant_id,
    invoice.order_id,
    orders.order_number,
    invoice.invoice_number,
    invoice.gross_amount_cents AS total_amount_cents,
    invoice.payment_contract_version,
    CASE WHEN invoice.order_id IS NULL THEN invoice.payment_mode ELSE orders.payment_mode END AS payment_mode,
    invoice.payment_status,
    invoice.payment_open_amount_cents,
    invoice.payment_paid_amount_cents,
    invoice.payment_currency,
    invoice.payment_method,
    invoice.payment_paid_at,
    invoice.payment_receipt_id,
    invoice.payment_event_id,
    invoice.payment_correlation_id,
    invoice.payment_version,
    (CASE WHEN invoice.order_id IS NULL THEN invoice.payment_mode ELSE orders.payment_mode END) = 'rechnung'::text OR invoice.payment_status = 'bezahlt'::text AS goods_out_allowed,
    COALESCE(invoice.payment_contract_version = 1 AND invoice.tenant_id = current_setting('app.tenant_id'::text, true) AND ((invoice.order_id IS NOT NULL AND orders.id IS NOT NULL AND orders.tenant_id::text = invoice.tenant_id AND (orders.payment_mode = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND orders.payment_mode_version >= 0) OR (invoice.order_id IS NULL AND invoice.payment_mode='rechnung' AND private.invoice_collection_payment_source_valid(invoice.tenant_id,invoice.id::text,invoice.snapshot#>>'{collection,collectionId}'))) AND invoice.gross_amount_cents IS NOT NULL AND (invoice.payment_mode = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND (invoice.payment_status = ANY (ARRAY['offen'::text, 'teilbezahlt'::text, 'bezahlt'::text])) AND invoice.payment_currency = 'EUR'::text AND invoice.payment_open_amount_cents >= 0 AND invoice.payment_paid_amount_cents >= 0 AND (invoice.payment_paid_amount_cents + invoice.payment_open_amount_cents) = invoice.gross_amount_cents AND invoice.payment_version >= 0 AND (invoice.payment_status = 'offen'::text AND invoice.payment_paid_amount_cents = 0 AND invoice.payment_open_amount_cents = invoice.gross_amount_cents AND invoice.payment_version = 0 AND invoice.payment_method IS NULL AND invoice.payment_paid_at IS NULL AND invoice.payment_receipt_id IS NULL AND invoice.payment_event_id IS NULL AND invoice.payment_correlation_id IS NULL OR (invoice.payment_status = ANY (ARRAY['teilbezahlt'::text, 'bezahlt'::text])) AND invoice.payment_version > 0 AND (invoice.payment_method = ANY (ARRAY['bar'::text, 'ueberweisung'::text, 'karte'::text, 'guthaben'::text])) AND (invoice.payment_method <> 'guthaben'::text OR private.customer_credit_payment_receipt_v1(invoice.tenant_id, invoice.id)) AND invoice.payment_paid_at IS NOT NULL AND invoice.payment_receipt_id IS NOT NULL AND invoice.payment_event_id IS NOT NULL AND invoice.payment_correlation_id IS NOT NULL AND (EXISTS ( SELECT 1
           FROM events event
          WHERE event.event_type::text = 'PAYMENT_CONFIRMED_V1'::text AND event.id = invoice.payment_event_id AND event.tenant_id::text = invoice.tenant_id AND event.order_id IS NOT DISTINCT FROM invoice.order_id AND ((invoice.order_id IS NOT NULL AND NOT(event.payload ? 'collectionId')) OR (invoice.order_id IS NULL AND event.payload->>'collectionId'=invoice.snapshot#>>'{collection,collectionId}')) AND (event.payload ->> 'invoiceId'::text) = invoice.id::text AND (event.payload ->> 'receiptId'::text) = invoice.payment_receipt_id AND (event.payload ->> 'paymentMode'::text) = invoice.payment_mode AND (event.payload ->> 'paymentVersion'::text) = invoice.payment_version::text AND (event.payload ->> 'paidAmountCents'::text) = invoice.payment_paid_amount_cents::text AND (event.payload ->> 'openAmountCents'::text) = invoice.payment_open_amount_cents::text AND (event.payload ->> 'grossAmountCents'::text) = invoice.gross_amount_cents::text AND (event.payload ->> 'currency'::text) = invoice.payment_currency AND event.correlation_id = invoice.payment_correlation_id
            AND (NOT(event.payload ? 'receivedOn') OR invoice.payment_paid_at=private.payment_receipt_effective_at_v1(event.payload)))) OR (private.payment_reversal_invoice_matches_v1(invoice)
  AND (invoice.payment_method IS DISTINCT FROM 'guthaben'
    OR private.customer_credit_payment_receipt_v1(invoice.tenant_id,invoice.id)))), false) AS integrity_ok,
    CASE WHEN invoice.order_id IS NULL THEN NULL::integer ELSE orders.payment_mode_version END AS payment_mode_version,
    CASE WHEN invoice.order_id IS NULL THEN invoice.snapshot->'collection' ELSE NULL::jsonb END AS collection_source
   FROM invoices invoice
     LEFT JOIN orders orders ON orders.id = invoice.order_id AND orders.tenant_id::text = invoice.tenant_id
  WHERE invoice.status = 'issued'::text AND invoice.payment_contract_version = 1 AND invoice.tenant_id = current_setting('app.tenant_id'::text, true);

-- L-M4: Read marked questions and their one secured reply from existing receipts.
CREATE INDEX events_mail_question_source_idx
  ON public.events (tenant_id,(payload->>'itemId'),created_at DESC,id DESC)
  WHERE event_type='COMMUNICATION_MAIL_SENT_V1' AND status='success' AND event_schema_version=1
    AND payload->'antwortErwartet'='true'::jsonb;

CREATE UNIQUE INDEX intake_event_mail_question_answer_uidx
  ON public.intake_event (tenant_id,(nachher->>'mailSentEventId'))
  WHERE art='einsatz' AND nachher->>'action'='mail_question_answered';

-- S38a: existing order/payment read uses every frozen native collection member.
-- No representative order, no new money calculation or payment source.
CREATE OR REPLACE VIEW private.v_goods_out_ui_state_v1 WITH (security_invoker=true) AS
 SELECT orders.id AS order_id,
    orders.tenant_id,
    orders.order_number,
    orders.version AS order_version,
    orders.station,
    orders.current_station,
    orders.current_station_id,
    orders.status AS order_status,
    orders.payment_mode,
    orders.payment_mode_version,
        CASE
            WHEN invoice_state.active_invoice_count = 0 THEN 'not_issued'::text
            ELSE 'issued'::text
        END AS invoice_state,
    invoice_state.active_invoice_count,
    payment.invoice_id,
    payment.invoice_number,
    payment.total_amount_cents,
    payment.payment_contract_version,
    payment.payment_status,
    payment.payment_open_amount_cents,
    payment.payment_paid_amount_cents,
    payment.payment_currency,
    payment.payment_method,
    payment.payment_paid_at,
    payment.payment_receipt_id,
    payment.payment_event_id,
    payment.payment_correlation_id,
    payment.payment_version,
    payment.goods_out_allowed AS payment_goods_out_allowed,
    payment.integrity_ok AS payment_integrity_ok,
    payment_actor.user_id AS payment_actor_id,
    COALESCE(goods_out.event_count, 0) AS goods_out_event_count,
    goods_out.event_id AS goods_out_event_id,
    goods_out.client_event_id AS goods_out_client_event_id,
    goods_out.correlation_id AS goods_out_correlation_id,
    goods_out.event_schema_version AS goods_out_event_schema_version,
    goods_out.aggregate_version AS goods_out_order_version,
    goods_out.user_id AS goods_out_actor_id,
    to_char((goods_out.created_at AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) AS goods_out_occurred_at,
    goods_out.payload ->> 'mode'::text AS goods_out_mode,
    orders.station::text = 'fertig'::text AND orders.current_station = 'fertig'::text AND orders.current_station_id::text = 'fertig'::text AND orders.status::text = 'fertig'::text AND (orders.payment_mode = 'keiner'::text AND orders.nacharbeit_zu IS NOT NULL AND invoice_state.active_invoice_count = 0 OR invoice_state.active_invoice_count = 0 AND orders.payment_mode = 'rechnung'::text OR invoice_state.active_invoice_count >= 1 AND payment.goods_out_allowed = true AND all_payment.goods_out_allowed IS TRUE) AS goods_out_allowed,
    COALESCE(orders.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) AND orders.payment_mode_version >= 0 AND orders.station::text = orders.current_station AND orders.station::text = orders.current_station_id::text AND orders.station::text = orders.status::text AND (invoice_state.active_invoice_count = 0 OR invoice_state.main_invoice_count = 1) AND (invoice_state.active_invoice_count = 0 OR all_payment.invoice_count = invoice_state.active_invoice_count AND all_payment.integrity_ok IS TRUE) AND (orders.payment_mode = 'keiner'::text AND orders.nacharbeit_zu IS NOT NULL AND invoice_state.active_invoice_count = 0 AND payment.invoice_id IS NULL OR (orders.payment_mode = ANY (ARRAY['vorkasse'::text, 'abholung'::text, 'rechnung'::text])) AND (invoice_state.active_invoice_count = 0 AND payment.invoice_id IS NULL OR invoice_state.active_invoice_count >= 1 AND payment.invoice_id IS NOT NULL AND payment.integrity_ok = true AND payment.payment_mode = orders.payment_mode AND (payment.order_id IS NULL AND payment.collection_source IS NOT NULL OR payment.order_id = orders.id AND payment.payment_mode_version = orders.payment_mode_version) AND (payment_actor.user_id IS NOT NULL OR payment.payment_event_id IS NULL))) AND (COALESCE(goods_out.event_count, 0) = 0 OR goods_out.event_count = 1 AND goods_out.event_id IS NOT NULL AND goods_out.user_id IS NOT NULL AND goods_out.aggregate_version <= orders.version AND (goods_out.aggregate_version = orders.version OR (( SELECT count(DISTINCT handover.aggregate_version) AS count
           FROM events handover
             JOIN app_users handover_actor ON handover_actor.tenant_id = handover.tenant_id::text AND handover_actor.id = handover.user_id
             JOIN intake_item original ON original.tenant_id = handover.tenant_id::text AND original.id::text = (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'originalItemId'::text)
             JOIN intake_event applied ON applied.tenant_id = handover.tenant_id::text AND applied.item_id = original.id AND applied.befehl_id = handover.client_event_id AND applied.von = handover.user_id::text
             JOIN tasks callback_task ON callback_task.tenant_id = handover.tenant_id::text AND callback_task.id::text = ((handover.payload -> 'receipt'::text) ->> 'taskId'::text) AND callback_task.bezug_id = orders.id AND callback_task.art = 'rueckruf'::text
          WHERE handover.tenant_id::text = orders.tenant_id::text AND handover.order_id = orders.id AND handover.event_type::text = 'ORDER_HANDOVER_MAIL_V1'::text AND handover.event_schema_version = 1 AND handover.status::text = 'success'::text AND handover.client_event_id IS NOT NULL AND handover.correlation_id IS NOT NULL AND handover.aggregate_version > goods_out.aggregate_version AND handover.aggregate_version <= orders.version AND (handover.payload ->> 'requestHash'::text) ~ '^[0-9a-f]{64}$'::text AND ((handover.payload -> 'receipt'::text) ->> 'orderId'::text) = orders.id AND ((handover.payload -> 'receipt'::text) ->> 'customerId'::text) = orders.customer_id AND ((handover.payload -> 'receipt'::text) ->> 'orderVersion'::text) = handover.aggregate_version::text AND (((handover.payload -> 'receipt'::text) ->> 'handoverMode'::text) = ANY (ARRAY['pickup'::text, 'shipping'::text])) AND ((handover.payload -> 'receipt'::text) ->> 'outcome'::text) = 'call_customer'::text AND ((handover.payload -> 'receipt'::text) ->> 'handoverMode'::text) = orders.handover_mode AND (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'kind'::text) = 'mail'::text AND (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'sender'::text) = original.absender_adresse AND original.kanal = 'mail'::text AND (applied.vorher ->> 'kunde_id'::text) = orders.customer_id AND (applied.nachher ->> 'customerId'::text) = orders.customer_id AND applied.art = 'anliegen'::text AND (applied.vorher ->> 'version'::text) = (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'originalVersion'::text) AND (applied.nachher ->> 'orderId'::text) = orders.id AND (applied.nachher ->> 'handoverMode'::text) = ((handover.payload -> 'receipt'::text) ->> 'handoverMode'::text) AND ((applied.nachher ->> 'action'::text) = ANY (ARRAY['auftrag.uebergabe_geaendert'::text, 'auftrag.uebergabe_klaeren'::text])) AND (EXISTS ( SELECT 1
                   FROM intake_file mime
                     JOIN intake_event secured ON secured.tenant_id = mime.tenant_id AND secured.item_id = mime.item_id AND secured.art = 'original_gespeichert'::text AND (secured.nachher ->> 'fileId'::text) = mime.id::text AND (secured.nachher ->> 'sha256'::text) = mime.sha256
                  WHERE mime.tenant_id = handover.tenant_id::text AND mime.item_id = original.id AND mime.art = 'mime'::text AND mime.sha256 = (((handover.payload -> 'receipt'::text) -> 'mailActor'::text) ->> 'originalSha256'::text))))) = (orders.version - goods_out.aggregate_version)) AND (goods_out.payload ->> 'orderId'::text) = orders.id AND (goods_out.payload ->> 'orderVersion'::text) = goods_out.aggregate_version::text AND ((goods_out.payload ->> 'mode'::text) = ANY (ARRAY['versand'::text, 'abholung'::text])) AND ((goods_out.event_type::text = ANY (ARRAY['ORDER_PICKED_UP_V1'::character varying, 'ORDER_PICKED_UP_V2'::character varying, 'ORDER_PICKED_UP_V3'::character varying]::text[])) AND (goods_out.payload ->> 'paymentMode'::text) = orders.payment_mode OR goods_out.event_type::text = 'ORDER_PICKED_UP_V4'::text AND orders.payment_mode = 'keiner'::text AND (goods_out.payload ->> 'paymentMode'::text) = 'keiner'::text AND (goods_out.payload ->> 'reworkComplaintId'::text) = orders.nacharbeit_zu)), false) AS integrity_ok,
    orders.nacharbeit_zu AS rework_complaint_id,
    all_payment.goods_out_allowed AS all_invoice_payments_allowed,
    payment.collection_source AS payment_collection_source
   FROM orders orders
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS active_invoice_count,
            count(*) FILTER (WHERE invoice.belegart = 'auftrag'::text)::integer AS main_invoice_count
           FROM invoices invoice
          WHERE invoice.tenant_id = orders.tenant_id::text AND (invoice.order_id = orders.id OR (invoice.order_id IS NULL AND EXISTS (SELECT 1 FROM private.v_invoice_order_members_v1 member WHERE member.tenant_id = orders.tenant_id::text AND member.invoice_id = invoice.id AND member.order_id = orders.id))) AND invoice.status = 'issued'::text) invoice_state ON true
     LEFT JOIN private.v_payment_summary_v1 payment ON payment.tenant_id = orders.tenant_id::text AND (payment.order_id = orders.id OR (payment.order_id IS NULL AND EXISTS (SELECT 1 FROM private.v_invoice_order_members_v1 member WHERE member.tenant_id = orders.tenant_id::text AND member.invoice_id = payment.invoice_id AND member.order_id = orders.id))) AND (EXISTS ( SELECT 1
           FROM invoices main_invoice
          WHERE main_invoice.tenant_id = orders.tenant_id::text AND main_invoice.id = payment.invoice_id AND main_invoice.belegart = 'auftrag'::text))
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS invoice_count,
            bool_and(summary.goods_out_allowed IS TRUE) AS goods_out_allowed,
            bool_and(summary.integrity_ok IS TRUE AND summary.payment_mode = orders.payment_mode AND (summary.order_id IS NULL AND summary.collection_source IS NOT NULL OR summary.order_id = orders.id AND summary.payment_mode_version = orders.payment_mode_version) AND (summary.payment_event_id IS NULL OR (EXISTS ( SELECT 1
                   FROM events actor_event
                  WHERE actor_event.tenant_id::text = orders.tenant_id::text AND actor_event.order_id IS NOT DISTINCT FROM summary.order_id AND (summary.order_id IS NOT NULL OR actor_event.payload ->> 'collectionId' = summary.collection_source ->> 'collectionId') AND actor_event.id = summary.payment_event_id AND actor_event.event_type::text IN ('PAYMENT_CONFIRMED_V1','PAYMENT_REVERSED_V1') AND actor_event.user_id IS NOT NULL)))) AS integrity_ok
           FROM private.v_payment_summary_v1 summary
          WHERE summary.tenant_id = orders.tenant_id::text AND (summary.order_id = orders.id OR (summary.order_id IS NULL AND EXISTS (SELECT 1 FROM private.v_invoice_order_members_v1 member WHERE member.tenant_id = orders.tenant_id::text AND member.invoice_id = summary.invoice_id AND member.order_id = orders.id)))) all_payment ON true
     LEFT JOIN events payment_actor ON payment_actor.tenant_id::text = orders.tenant_id::text AND payment_actor.order_id IS NOT DISTINCT FROM payment.order_id AND (payment.order_id IS NOT NULL OR payment_actor.payload ->> 'collectionId' = payment.collection_source ->> 'collectionId') AND payment_actor.id = payment.payment_event_id AND payment_actor.event_type::text IN ('PAYMENT_CONFIRMED_V1','PAYMENT_REVERSED_V1')
     LEFT JOIN LATERAL ( SELECT count(*) OVER ()::integer AS event_count,
            event.id AS event_id,
            event.client_event_id,
            event.correlation_id,
            event.event_schema_version,
            event.aggregate_version,
            event.user_id,
            event.created_at,
            event.payload,
            event.event_type
           FROM events event
          WHERE event.tenant_id::text = orders.tenant_id::text AND event.order_id = orders.id AND (event.event_type::text = ANY (ARRAY['ORDER_PICKED_UP_V1'::character varying, 'ORDER_PICKED_UP_V2'::character varying, 'ORDER_PICKED_UP_V3'::character varying, 'ORDER_PICKED_UP_V4'::character varying]::text[])) AND event.status::text = 'success'::text
          ORDER BY event.created_at DESC, event.id DESC
         LIMIT 1) goods_out ON true
  WHERE NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND orders.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
