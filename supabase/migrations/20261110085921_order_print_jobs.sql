-- AP-ABLAUF §8.4 / AP-DRUCK: one persistent queue, no claim of a physical print.
ALTER TABLE public.orders
  ADD COLUMN print_symbol_slot integer,
  ADD COLUMN print_symbol_generation integer,
  ADD COLUMN print_symbol_active boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT orders_print_symbol_pair CHECK (
    (print_symbol_slot IS NULL AND print_symbol_generation IS NULL AND NOT print_symbol_active)
    OR (print_symbol_slot IS NOT NULL AND print_symbol_generation IS NOT NULL AND print_symbol_slot BETWEEN 0 AND 39 AND print_symbol_generation >= 0)
  );
CREATE UNIQUE INDEX orders_active_print_symbol ON public.orders(tenant_id,print_symbol_slot,print_symbol_generation)
  WHERE print_symbol_active;

CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  item_id text REFERENCES public.items(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('laufzettel','versandetikett')),
  sheet_kind text NOT NULL CHECK (sheet_kind IN ('gesamt','position')),
  content_version integer NOT NULL CHECK (content_version > 0),
  request_key uuid NOT NULL,
  status text NOT NULL DEFAULT 'wartet' CHECK (status IN ('wartet','gedruckt','fehlgeschlagen','storniert')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT print_jobs_sheet CHECK ((sheet_kind='gesamt' AND item_id IS NULL) OR (sheet_kind='position' AND item_id IS NOT NULL)),
  UNIQUE (tenant_id,request_key,sheet_kind,item_id)
);
-- NULL item_id must also be unique for the single overall sheet.
CREATE UNIQUE INDEX print_jobs_overall_request ON public.print_jobs(tenant_id,request_key) WHERE sheet_kind='gesamt';
CREATE INDEX print_jobs_waiting ON public.print_jobs(tenant_id,status,created_at,id);
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY print_jobs_tenant ON public.print_jobs
  USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
  WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
REVOKE ALL ON public.print_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.print_jobs TO service_role;
