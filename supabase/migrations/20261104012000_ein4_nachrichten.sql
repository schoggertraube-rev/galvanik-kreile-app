-- AP-EIN Teil 4: Aufgaben; Stammdaten/Originale bleiben in ihren bestehenden Tabellen.
-- P48: item_id bleibt der Positionsbezug; der Bauplan-Quellenbezug ist intake_item_id.
ALTER TABLE public.complaints ADD COLUMN intake_item_id uuid;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_intake_tenant_fk
 FOREIGN KEY(tenant_id,intake_item_id) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_intake_tenant_required
 CHECK(intake_item_id IS NULL OR tenant_id IS NOT NULL);

CREATE TABLE public.tasks (
 id uuid PRIMARY KEY,tenant_id text NOT NULL,client_key uuid NOT NULL,
 art text NOT NULL CHECK(art IN ('rueckruf','frist','aufgabe','rechnung')),
 titel text NOT NULL CHECK(length(btrim(titel)) BETWEEN 3 AND 120),
 faellig_am date NOT NULL,uhrzeit time,vorlauf_tage integer NOT NULL CHECK(vorlauf_tage=CASE WHEN art='frist' THEN 5 ELSE 0 END),
 fuer_login uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
 fuer_bereich text CHECK(fuer_bereich IN ('auftraege','eingang','kunden','geld','kassieren','mails','entscheiden','einstellungen','logins','wartung')),
 bezug_typ text NOT NULL CHECK(bezug_typ IN ('kunde','auftrag','kv','eingang','eingangsrechnung','reklamation','allgemein')),bezug_id text,
 item_id uuid,notiz text CHECK(notiz IS NULL OR length(notiz)<=2000),
 status text NOT NULL CHECK(status IN ('offen','erledigt')),
 erledigt_von uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,erledigt_am timestamptz,erledigt_notiz text CHECK(erledigt_notiz IS NULL OR length(erledigt_notiz)<=2000),
 erstellt_von uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,erstellt_am timestamptz NOT NULL DEFAULT statement_timestamp(),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,client_key),
 FOREIGN KEY(tenant_id,item_id) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT,
 CHECK((fuer_login IS NULL)<>(fuer_bereich IS NULL)),
 CHECK((bezug_typ='allgemein')=(bezug_id IS NULL)),
 CHECK(bezug_id IS NULL OR length(btrim(bezug_id)) BETWEEN 1 AND 128),
 CHECK((status='erledigt')=(erledigt_von IS NOT NULL AND erledigt_am IS NOT NULL)),
 CHECK(status='erledigt' OR (erledigt_von IS NULL AND erledigt_am IS NULL AND erledigt_notiz IS NULL))
);
CREATE INDEX tasks_open_recipient ON public.tasks(tenant_id,fuer_login,fuer_bereich,faellig_am) WHERE status='offen';
CREATE INDEX tasks_context ON public.tasks(tenant_id,bezug_typ,bezug_id,erstellt_am);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_tenant_isolation ON public.tasks
 USING(tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
 WITH CHECK(tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
REVOKE ALL ON public.tasks FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.tasks TO service_role;
-- Supabase default privileges include destructive rights; a narrower GRANT does not revoke them.
REVOKE DELETE,TRUNCATE ON public.complaints FROM service_role;

ALTER TABLE public.goods_receipt ADD CONSTRAINT goods_receipt_task_tenant_fk
 FOREIGN KEY(tenant_id,aufgabe_id) REFERENCES public.tasks(tenant_id,id) ON DELETE RESTRICT;

CREATE FUNCTION private.protect_task_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF ROW(NEW.id,NEW.tenant_id,NEW.client_key,NEW.erstellt_von,NEW.erstellt_am,NEW.bezug_typ,NEW.bezug_id,NEW.item_id)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.client_key,OLD.erstellt_von,OLD.erstellt_am,OLD.bezug_typ,OLD.bezug_id,OLD.item_id)
 THEN RAISE EXCEPTION 'TASK_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF OLD.status='erledigt' THEN RAISE EXCEPTION 'TASK_ALREADY_COMPLETED' USING ERRCODE='23514'; END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'TASK_VERSION_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $fn$;
REVOKE ALL ON FUNCTION private.protect_task_identity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_task_identity() TO service_role;
CREATE TRIGGER task_identity BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION private.protect_task_identity();

-- Schmale mandantengebundene Lesefakten: kein zweites Kunden-/Auftragsmodell.
CREATE VIEW private.v_task_contexts_v1 WITH(security_invoker=true) AS
 SELECT customer.tenant_id::text AS tenant_id,'kunde'::text AS kind,customer.id,customer.name AS label,
  customer.id AS customer_id,customer.type AS customer_type, NULL::text AS order_id,NULL::text AS channel,customer.phone,NULL::integer AS source_version
 FROM public.customers customer
 WHERE customer.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')
 UNION ALL
 SELECT orders.tenant_id,'auftrag',orders.id,orders.order_number,orders.customer_id,customer.type,orders.id,NULL,customer.phone,NULL
 FROM public.orders orders JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id
 WHERE orders.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')
 UNION ALL
 SELECT quote.tenant_id,'kv',quote.id::text,quote.quote_number,quote.customer_id,customer.type,NULL,NULL,customer.phone,NULL
 FROM private.quotes quote JOIN public.customers customer ON customer.tenant_id=quote.tenant_id AND customer.id=quote.customer_id
 WHERE quote.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')
 UNION ALL
 SELECT source.tenant_id,'eingang',source.id::text,CASE WHEN source.kanal='notiz' THEN left(source.text,120) ELSE source.betreff END,source.kunde_id,customer.type,
  CASE WHEN source.vorgang_art='auftrag' THEN source.vorgang_id END,source.kanal,customer.phone,source.version
 FROM public.intake_item source LEFT JOIN public.customers customer ON customer.tenant_id=source.tenant_id AND customer.id=source.kunde_id
 WHERE source.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON private.v_task_contexts_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_task_contexts_v1 TO service_role;

CREATE VIEW private.v_task_recipients_v1 WITH(security_invoker=true) AS
 SELECT login.tenant_id,login.id,login.full_name,login.active
 FROM public.app_users login
 WHERE login.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON private.v_task_recipients_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_task_recipients_v1 TO service_role;

-- Source/context join for the canonical messages reader, always tenant scoped.
CREATE VIEW private.v_intake_message_contexts_v1 WITH(security_invoker=true) AS
 SELECT source.tenant_id,source.id AS item_id,customer.name AS customer_name,customer.type AS customer_type,
  orders.order_number,orders.station AS order_station,orders.ware AS goods
 FROM public.intake_item source
 LEFT JOIN public.customers customer ON customer.tenant_id=source.tenant_id AND customer.id=source.kunde_id
 LEFT JOIN public.orders orders ON source.vorgang_art='auftrag' AND orders.tenant_id=source.tenant_id AND orders.id=source.vorgang_id
 WHERE source.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON private.v_intake_message_contexts_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_intake_message_contexts_v1 TO service_role;
