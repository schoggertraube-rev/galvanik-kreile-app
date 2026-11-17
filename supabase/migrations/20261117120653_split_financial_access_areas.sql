DO $financial_access_migration$
BEGIN
-- KORR-RECHTE-GELD A/D, Owner16.11 and PL17.11 13:01.
-- One lossless conversion; user/tenant/actor, originals and task evidence stay intact.
LOCK TABLE public.app_user_rights,public.tasks IN ACCESS EXCLUSIVE MODE;

DO $count$
DECLARE rights_count bigint; task_count bigint;
BEGIN
  SELECT count(*) INTO rights_count FROM public.app_user_rights WHERE bereich='geld';
  SELECT count(*) INTO task_count FROM public.tasks WHERE fuer_bereich='geld';
  RAISE NOTICE 'KORR_RECHTE existing old rights: %, task recipient fields: %', rights_count, task_count;
END;
$count$;

ALTER TABLE public.app_user_rights DROP CONSTRAINT app_user_rights_bereich_chk;
INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by)
SELECT previous.tenant_id,previous.user_id,successor.bereich,previous.granted_by
FROM public.app_user_rights previous
CROSS JOIN (VALUES ('preise'),('zahlungen'),('buchhaltung')) successor(bereich)
WHERE previous.bereich='geld'
ON CONFLICT(tenant_id,user_id,bereich) DO NOTHING;
DELETE FROM public.app_user_rights WHERE bereich='geld';
ALTER TABLE public.app_user_rights ADD CONSTRAINT app_user_rights_bereich_chk CHECK (
  bereich IN ('auftraege','eingang','kunden','preise','zahlungen','buchhaltung','kassieren','mails',
    'entscheiden','einstellungen','logins','wartung','statistik_alle','protokoll'));

-- PL17.11 13:34: exactly one transactional recipient conversion, no persistent guard exception.
CREATE TEMP TABLE kreile_financial_task_recipient_before ON COMMIT DROP AS
 SELECT id,to_jsonb(task)-'fuer_bereich' AS original FROM public.tasks task WHERE fuer_bereich='geld';
ALTER TABLE public.tasks DROP CONSTRAINT tasks_fuer_bereich_check;
ALTER TABLE public.tasks DISABLE TRIGGER task_identity;
UPDATE public.tasks SET fuer_bereich='zahlungen' WHERE fuer_bereich='geld';
ALTER TABLE public.tasks ENABLE TRIGGER task_identity;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_fuer_bereich_check CHECK (
 fuer_bereich IN ('auftraege','eingang','kunden','preise','zahlungen','buchhaltung','kassieren','mails',
   'entscheiden','einstellungen','logins','wartung'));
DO $verify_tasks$
DECLARE before_count bigint; converted_count bigint;
BEGIN
 SELECT count(*) INTO before_count FROM kreile_financial_task_recipient_before;
 SELECT count(*) INTO converted_count FROM public.tasks task JOIN kreile_financial_task_recipient_before old ON old.id=task.id
  WHERE task.fuer_bereich='zahlungen' AND to_jsonb(task)-'fuer_bereich'=old.original;
 IF before_count<>converted_count OR EXISTS(SELECT 1 FROM public.tasks WHERE fuer_bereich='geld')
  THEN RAISE EXCEPTION 'FINANCIAL_TASK_RECIPIENT_CONVERSION_NOT_LOSSLESS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.tasks'::regclass AND tgname='task_identity' AND tgenabled='O')
  THEN RAISE EXCEPTION 'FINANCIAL_TASK_GUARD_NOT_RESTORED'; END IF;
 RAISE NOTICE 'KORR_RECHTE old task recipients: %, unchanged originals with new recipient: %, remaining old: 0',before_count,converted_count;
END;
$verify_tasks$;

-- Same UID/tenant/active binding, volatility, owner and existing EXECUTE grants.
CREATE OR REPLACE FUNCTION private.current_user_can_view_finance(expected_tenant text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS app_user
    JOIN public.app_user_rights AS rights
      ON rights.tenant_id = app_user.tenant_id
      AND rights.user_id = app_user.id
      AND rights.bereich = 'buchhaltung'
    WHERE app_user.id = (SELECT auth.uid())
      AND app_user.tenant_id = expected_tenant
      AND app_user.active IS TRUE
  );
$function$;

-- PL17.11 13:34: same two existing customer writers, unchanged identity/receipt/field validation and grants.
CREATE OR REPLACE FUNCTION private.create_customer_v2(
  p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_intent_sha256 text, p_fields jsonb
) RETURNS TABLE(result_code text, result_receipt_id uuid, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_prior private.customer_create_receipts%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_customer_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_receipt_id uuid := gen_random_uuid();
  v_correlation_id uuid := gen_random_uuid();
  v_customer_number text;
  v_name text;
  v_money boolean;
BEGIN
  IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_intent_sha256 IS NULL OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_fields) key WHERE key <> ALL(ARRAY[
      'type','company_name','salutation','first_name','last_name','contact_role','phone','email','billing_email','website',
      'street','house_number','zip_code','city','country','payment_preference','vat_id','notes','handover_preference',
      'iban','zahlungsziel_tage','auto_info','vorrang','address_status']))
    OR NOT EXISTS (SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.active)
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='eingang')
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text, NULL::uuid, false; RETURN; END IF;
  v_money := EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='zahlungen');
  v_customer := jsonb_populate_record(NULL::public.customers, p_fields);
  IF NOT v_money AND ((v_customer.payment_preference IS NOT NULL AND v_customer.payment_preference <> 'vorkasse') OR v_customer.iban IS NOT NULL OR v_customer.zahlungsziel_tage IS NOT NULL)
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text, NULL::uuid, false; RETURN; END IF;
  IF coalesce(v_customer.vorrang,false) AND NOT EXISTS
    (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='entscheiden')
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text, NULL::uuid, false; RETURN; END IF;
  v_name := CASE WHEN v_customer.type='privat' THEN concat_ws(' ',nullif(v_customer.first_name,''),nullif(v_customer.last_name,'')) ELSE v_customer.company_name END;
  IF v_customer.type IS NULL OR v_customer.type NOT IN ('business','privat','lieferant') OR v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 160
    OR (v_customer.type <> 'lieferant' AND v_customer.phone IS NULL)
    OR v_customer.payment_preference='rechnung'
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('path1:customer-create:'||p_tenant_id||':'||p_actor_id||':'||p_client_event_id,0));
  SELECT * INTO v_prior FROM private.customer_create_receipts
    WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND client_event_id=p_client_event_id;
  IF FOUND THEN
    IF v_prior.intent_sha256 IS DISTINCT FROM p_intent_sha256 THEN RETURN QUERY SELECT 'CONFLICT'::text,NULL::uuid,false;
    ELSE RETURN QUERY SELECT 'OK'::text,v_prior.id,true; END IF;
    RETURN;
  END IF;
  v_customer_number := private.allocate_customer_number(p_tenant_id);
  INSERT INTO public.customers (
    id,tenant_id,customer_number,name,type,company_name,salutation,first_name,last_name,contact_role,phone,email,billing_email,
    website,street,house_number,zip_code,city,country,payment_preference,vat_id,notes,handover_preference,iban,zahlungsziel_tage,
    auto_info,vorrang,address_status,address_checked_at,source,source_ref,created_at,updated_at
  ) VALUES (
    v_customer_id::text,p_tenant_id,v_customer_number,v_name,v_customer.type,v_customer.company_name,v_customer.salutation,
    v_customer.first_name,v_customer.last_name,v_customer.contact_role,v_customer.phone,v_customer.email,v_customer.billing_email,
    v_customer.website,v_customer.street,v_customer.house_number,v_customer.zip_code,v_customer.city,v_customer.country,
    v_customer.payment_preference,v_customer.vat_id,v_customer.notes,v_customer.handover_preference,v_customer.iban,v_customer.zahlungsziel_tage,
    coalesce(v_customer.auto_info,true),false,v_customer.address_status,CASE WHEN v_customer.address_status IS NULL THEN NULL ELSE statement_timestamp() END,'PATH1_CUSTOMER_COMMAND',p_client_event_id::text,
    statement_timestamp() AT TIME ZONE 'UTC',statement_timestamp()
  );
  INSERT INTO public.events (id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,created_at)
  VALUES (v_event_id::text,p_tenant_id,'CUSTOMER_CREATED_V1','Kunde angelegt',
    jsonb_build_object('customerId',v_customer_id::text,'customerNumber',v_customer_number,'intentSha256',p_intent_sha256),
    'success',p_actor_id,p_client_event_id,1,v_correlation_id,1,statement_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO private.customer_create_receipts (
    id,event_id,tenant_id,customer_id,customer_number,actor_id,client_event_id,correlation_id,intent_sha256,name,customer_type,
    company_name,contact_person,email,phone,street,zip_code,city,country,payment_preference,vat_id,notes,created_at,customer_fields
  ) VALUES (
    v_receipt_id,v_event_id::text,p_tenant_id,v_customer_id::text,v_customer_number,p_actor_id,p_client_event_id,v_correlation_id,p_intent_sha256,
    v_name,v_customer.type,v_customer.company_name,NULL,v_customer.email,v_customer.phone,v_customer.street,v_customer.zip_code,v_customer.city,
    v_customer.country,v_customer.payment_preference,v_customer.vat_id,v_customer.notes,statement_timestamp(),p_fields
  );
  RETURN QUERY SELECT 'OK'::text,v_receipt_id,false;
END $$;

CREATE OR REPLACE FUNCTION private.update_customer_v1(
  p_tenant_id text,p_actor_id uuid,p_client_event_id uuid,p_customer_id text,p_intent_sha256 text,p_fields jsonb
) RETURNS TABLE(result_code text,replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_prior public.events%ROWTYPE;
  v_before public.customers%ROWTYPE;
  v_after public.customers%ROWTYPE;
  v_money boolean;
  v_name text;
  v_version integer;
  v_customer_fields jsonb;
  v_agreements jsonb;
  v_agreements_present boolean := false;
  v_before_agreements jsonb := '[]'::jsonb;
  v_after_agreements jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_entry_id uuid;
  v_existing public.customer_agreements%ROWTYPE;
  v_position integer;
  v_used_positions integer[] := ARRAY[]::integer[];
  v_editable_ids uuid[] := ARRAY[]::uuid[];
  v_seen_ids uuid[] := ARRAY[]::uuid[];
  v_valid_until date;
BEGIN
  v_agreements_present := p_fields ? 'agreements';
  v_agreements := p_fields->'agreements';
  v_customer_fields := p_fields - 'agreements';
  IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id',true)),'')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_customer_id IS NULL OR p_intent_sha256 IS NULL OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_customer_fields) key WHERE key <> ALL(ARRAY[
      'type','company_name','salutation','first_name','last_name','contact_role','phone','email','billing_email','website',
      'street','house_number','zip_code','city','country','payment_preference','vat_id','notes','handover_preference',
      'iban','zahlungsziel_tage','auto_info','vorrang','address_status']))
    OR (v_agreements_present AND (jsonb_typeof(v_agreements) IS DISTINCT FROM 'array' OR jsonb_array_length(v_agreements) > 20))
    OR NOT EXISTS (SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.active)
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='kunden')
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  v_money := EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='zahlungen');
  PERFORM pg_advisory_xact_lock(hashtextextended('s1:customer-update:'||p_tenant_id||':'||p_actor_id||':'||p_client_event_id,0));
  SELECT * INTO v_prior FROM public.events WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND client_event_id=p_client_event_id AND event_type='CUSTOMER_UPDATED_V1';
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_prior.payload->>'intentSha256'=p_intent_sha256 AND v_prior.payload->>'customerId'=p_customer_id THEN 'OK' ELSE 'CONFLICT' END,true; RETURN;
  END IF;
  SELECT * INTO v_before FROM public.customers WHERE tenant_id=p_tenant_id AND id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text,false; RETURN; END IF;
  v_after := jsonb_populate_record(v_before,v_customer_fields);
  IF NOT v_money AND (v_before.payment_preference IS DISTINCT FROM v_after.payment_preference
    OR v_before.iban IS DISTINCT FROM v_after.iban OR v_before.zahlungsziel_tage IS DISTINCT FROM v_after.zahlungsziel_tage)
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  IF v_before.vorrang IS DISTINCT FROM v_after.vorrang AND NOT EXISTS
    (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='entscheiden')
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  IF v_after.payment_preference='rechnung' AND NOT v_before.ziel_freigeschaltet
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  v_name := CASE WHEN v_after.type='privat' THEN concat_ws(' ',nullif(v_after.first_name,''),nullif(v_after.last_name,'')) ELSE v_after.company_name END;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 160 THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  IF v_agreements_present THEN
    PERFORM 1 FROM public.customer_agreements agreement
      WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.widerrufen_am IS NULL
      FOR UPDATE;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', agreement.id::text, 'position', agreement.position, 'bezeichnung', agreement.bezeichnung,
      'wert', agreement.wert, 'geld', agreement.geld, 'hinweis', agreement.hinweis,
      'gueltigBis', agreement.gueltig_bis
    ) ORDER BY agreement.position), '[]'::jsonb)
    INTO v_before_agreements
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.typ IS NULL
      AND agreement.widerrufen_am IS NULL AND (v_money OR NOT agreement.geld);
    SELECT coalesce(array_agg(agreement.position ORDER BY agreement.position), ARRAY[]::integer[])
    INTO v_used_positions
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.widerrufen_am IS NULL
      AND agreement.typ IS NULL AND NOT v_money AND agreement.geld;
    SELECT coalesce(array_agg(agreement.id ORDER BY agreement.position), ARRAY[]::uuid[])
    INTO v_editable_ids
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.typ IS NULL
      AND agreement.widerrufen_am IS NULL AND (v_money OR NOT agreement.geld);
    -- The partial unique index covers active free-text rows. Temporarily mark exactly the
    -- editable rows revoked so a full 1..20 list can be reordered without a swap collision.
    UPDATE public.customer_agreements agreement SET widerrufen_am=statement_timestamp(),widerrufen_von=p_actor_id,
      widerruf_grund='wird in Kundenkarte neu sortiert'
    WHERE agreement.tenant_id=p_tenant_id AND agreement.id = ANY(v_editable_ids);
    FOR v_entry IN SELECT value FROM jsonb_array_elements(v_agreements) LOOP
      IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object'
        OR NOT (v_entry ?& ARRAY['id','bezeichnung','wert','geld','hinweis','gueltigBis'])
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_entry) key WHERE key <> ALL(ARRAY['id','bezeichnung','wert','geld','hinweis','gueltigBis']))
        OR jsonb_typeof(v_entry->'id') NOT IN ('null','string')
        OR jsonb_typeof(v_entry->'bezeichnung') <> 'string' OR char_length(btrim(v_entry->>'bezeichnung')) NOT BETWEEN 1 AND 40
        OR jsonb_typeof(v_entry->'wert') <> 'string' OR char_length(btrim(v_entry->>'wert')) NOT BETWEEN 1 AND 200
        OR jsonb_typeof(v_entry->'geld') <> 'boolean' OR jsonb_typeof(v_entry->'hinweis') <> 'boolean'
        OR jsonb_typeof(v_entry->'gueltigBis') NOT IN ('null','string')
      THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
      BEGIN
        v_entry_id := CASE WHEN v_entry->>'id' IS NULL THEN NULL ELSE (v_entry->>'id')::uuid END;
        v_valid_until := CASE WHEN v_entry->>'gueltigBis' IS NULL THEN NULL ELSE (v_entry->>'gueltigBis')::date END;
      EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
        RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN;
      END;
      IF v_valid_until IS NOT NULL AND to_char(v_valid_until,'YYYY-MM-DD') <> v_entry->>'gueltigBis' THEN
        RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN;
      END IF;
      IF NOT v_money AND (v_entry->>'geld')::boolean THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
      SELECT candidate::integer INTO v_position FROM generate_series(1,20) candidate
        WHERE candidate <> ALL(v_used_positions) ORDER BY candidate LIMIT 1;
      IF v_position IS NULL THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
      IF v_entry_id IS NULL THEN
        INSERT INTO public.customer_agreements(
          tenant_id,customer_id,position,bezeichnung,wert,geld,hinweis,gueltig_bis,typ,order_id,ziel_tage,grund,client_key,created_by
        ) VALUES (
          p_tenant_id,p_customer_id,v_position,btrim(v_entry->>'bezeichnung'),btrim(v_entry->>'wert'),(v_entry->>'geld')::boolean,
          (v_entry->>'hinweis')::boolean,v_valid_until,NULL,NULL,NULL,NULL,NULL,p_actor_id
        ) RETURNING id INTO v_entry_id;
      ELSE
        v_existing := NULL;
        SELECT * INTO v_existing FROM public.customer_agreements agreement
          WHERE agreement.tenant_id=p_tenant_id AND agreement.id=v_entry_id AND agreement.customer_id=p_customer_id
            AND agreement.typ IS NULL AND agreement.id = ANY(v_editable_ids) FOR UPDATE;
        IF NOT FOUND THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
        IF NOT v_money AND v_existing.geld THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
        IF v_entry_id = ANY(v_seen_ids) THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
        IF (v_existing.position,v_existing.bezeichnung,v_existing.wert,v_existing.geld,v_existing.hinweis,v_existing.gueltig_bis)
          IS DISTINCT FROM (v_position,btrim(v_entry->>'bezeichnung'),btrim(v_entry->>'wert'),(v_entry->>'geld')::boolean,(v_entry->>'hinweis')::boolean,v_valid_until)
        THEN
          UPDATE public.customer_agreements SET position=v_position,bezeichnung=btrim(v_entry->>'bezeichnung'),wert=btrim(v_entry->>'wert'),
            geld=(v_entry->>'geld')::boolean,hinweis=(v_entry->>'hinweis')::boolean,gueltig_bis=v_valid_until,
            widerrufen_am=NULL,widerrufen_von=NULL,widerruf_grund=NULL,version=version+1
          WHERE tenant_id=p_tenant_id AND id=v_entry_id AND version=v_existing.version;
          IF NOT FOUND THEN RETURN QUERY SELECT 'CONFLICT'::text,false; RETURN; END IF;
        ELSE
          UPDATE public.customer_agreements SET widerrufen_am=NULL,widerrufen_von=NULL,widerruf_grund=NULL
          WHERE tenant_id=p_tenant_id AND id=v_entry_id AND version=v_existing.version;
        END IF;
      END IF;
      v_seen_ids := array_append(v_seen_ids,v_entry_id);
      v_used_positions := array_append(v_used_positions,v_position);
    END LOOP;
    UPDATE public.customer_agreements agreement SET widerrufen_am=statement_timestamp(),widerrufen_von=p_actor_id,
      widerruf_grund='aus Kundenkarte entfernt',version=version+1
    WHERE agreement.tenant_id=p_tenant_id AND agreement.id = ANY(v_editable_ids)
      AND NOT (agreement.id = ANY(v_seen_ids));
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', agreement.id::text, 'position', agreement.position, 'bezeichnung', agreement.bezeichnung,
      'wert', agreement.wert, 'geld', agreement.geld, 'hinweis', agreement.hinweis,
      'gueltigBis', agreement.gueltig_bis
    ) ORDER BY agreement.position), '[]'::jsonb)
    INTO v_after_agreements
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.typ IS NULL
      AND agreement.widerrufen_am IS NULL AND (v_money OR NOT agreement.geld);
  END IF;
  UPDATE public.customers SET
    name=v_name,type=v_after.type,company_name=v_after.company_name,salutation=v_after.salutation,first_name=v_after.first_name,
    last_name=v_after.last_name,contact_role=v_after.contact_role,phone=v_after.phone,email=v_after.email,billing_email=v_after.billing_email,
    website=v_after.website,street=v_after.street,house_number=v_after.house_number,zip_code=v_after.zip_code,city=v_after.city,country=v_after.country,
    payment_preference=v_after.payment_preference,vat_id=v_after.vat_id,notes=v_after.notes,handover_preference=v_after.handover_preference,
    iban=v_after.iban,zahlungsziel_tage=v_after.zahlungsziel_tage,auto_info=v_after.auto_info,vorrang=v_after.vorrang,address_status=v_after.address_status,
    address_checked_at=CASE WHEN (v_before.country,v_before.zip_code,v_before.city,v_before.street,v_before.house_number)
      IS DISTINCT FROM (v_after.country,v_after.zip_code,v_after.city,v_after.street,v_after.house_number)
      THEN CASE WHEN v_after.address_status IS NULL THEN NULL ELSE statement_timestamp() END ELSE v_before.address_checked_at END,
    customer_number=coalesce(v_before.customer_number,private.allocate_customer_number(p_tenant_id)),updated_at=statement_timestamp()
  WHERE tenant_id=p_tenant_id AND id=p_customer_id;
  SELECT coalesce(max(event.aggregate_version),0)+1 INTO v_version FROM public.events event
    WHERE event.tenant_id=p_tenant_id AND event.event_type='CUSTOMER_UPDATED_V1' AND event.payload->>'customerId'=p_customer_id;
  INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,created_at)
  VALUES(gen_random_uuid()::text,p_tenant_id,'CUSTOMER_UPDATED_V1','Kunde gespeichert',
    jsonb_build_object('customerId',p_customer_id,'intentSha256',p_intent_sha256,'fields',v_customer_fields)
      || CASE WHEN v_agreements_present THEN jsonb_build_object('agreements',jsonb_build_object('before',v_before_agreements,'after',v_after_agreements)) ELSE '{}'::jsonb END,
    'success',p_actor_id,p_client_event_id,1,gen_random_uuid(),v_version,statement_timestamp() AT TIME ZONE 'UTC');
  RETURN QUERY SELECT 'OK'::text,false;
END $$;

END;
$financial_access_migration$;
