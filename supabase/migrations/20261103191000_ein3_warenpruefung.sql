-- AP-EIN Teil 3: one goods inspection record, original files stay in intake_file.
CREATE TABLE public.goods_receipt (
 id uuid PRIMARY KEY,tenant_id text NOT NULL,client_key uuid NOT NULL,item_id uuid,auftrag_id text NOT NULL,
 modus text NOT NULL CHECK(modus IN ('erwartet','erfassung')),
 status text NOT NULL CHECK(status IN ('entwurf','angenommen','galvanik')),
 karte integer NOT NULL CHECK(karte BETWEEN 0 AND 20),
 packstuecke_da integer CHECK(packstuecke_da BETWEEN 1 AND 999),
 packstuecke_gesamt integer CHECK(packstuecke_gesamt BETWEEN 1 AND 999),
 zustand text CHECK(zustand IN ('unauffaellig','abweichung','teillieferung','gefahr')),
 abweichung text[] NOT NULL DEFAULT '{}',abgestellt boolean NOT NULL,fund_zeit timestamptz,
 verfahren_wie_kv text CHECK(verfahren_wie_kv IS NULL OR verfahren_wie_kv IN ('stimmt','abweichend')),
 verfahren_abweichung text,fotos jsonb NOT NULL,mengen jsonb NOT NULL,offen text[] NOT NULL,
 aufgabe_id uuid,bestaetigt_von uuid REFERENCES public.app_users(id),bestaetigt_am timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 erstellt_am timestamptz NOT NULL DEFAULT statement_timestamp(),geaendert_am timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,client_key),
 FOREIGN KEY(tenant_id,item_id) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,auftrag_id) REFERENCES public.orders(tenant_id,id) ON DELETE RESTRICT,
 CHECK(jsonb_typeof(fotos)='array' AND jsonb_typeof(mengen)='array'),
 CHECK(packstuecke_da IS NULL OR packstuecke_gesamt IS NULL OR packstuecke_da<=packstuecke_gesamt),
 CHECK(status='entwurf' OR (zustand IS NOT NULL AND bestaetigt_von IS NOT NULL AND bestaetigt_am IS NOT NULL)),
 CHECK((abgestellt AND fund_zeit IS NOT NULL) OR (NOT abgestellt AND fund_zeit IS NULL))
);
CREATE INDEX goods_receipt_order_tenant ON public.goods_receipt(tenant_id,auftrag_id,erstellt_am);
ALTER TABLE public.goods_receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY goods_receipt_tenant_isolation ON public.goods_receipt
 USING(tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
 WITH CHECK(tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
REVOKE ALL ON TABLE public.goods_receipt FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.goods_receipt TO service_role;

-- Identity stays stable. State changes are versioned and recorded in the existing event store.
CREATE FUNCTION private.protect_goods_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF OLD.status<>'entwurf' AND NEW.status='entwurf' THEN RAISE EXCEPTION 'GOODS_RECEIPT_STATE_REGRESSION' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.client_key,NEW.auftrag_id,NEW.modus)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.client_key,OLD.auftrag_id,OLD.modus)
   OR (OLD.item_id IS NOT NULL AND NEW.item_id IS DISTINCT FROM OLD.item_id)
 THEN RAISE EXCEPTION 'GOODS_RECEIPT_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $fn$;
REVOKE ALL ON FUNCTION private.protect_goods_receipt() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_goods_receipt() TO service_role;
CREATE TRIGGER goods_receipt_immutable BEFORE UPDATE ON public.goods_receipt FOR EACH ROW EXECUTE FUNCTION private.protect_goods_receipt();
