-- P2 Nr. 4a: Inventursitzung. Der Sperrpunkt wird schon vom Wiederholungsweg (Nr. 1d) gelesen.
CREATE TABLE public.inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  stichtag date NOT NULL,
  art text NOT NULL CHECK (art IN ('stichtag','nachtrag')),
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','abschliessend','abgeschlossen')),
  ursprung_id uuid,
  nachtrag_grund text,
  erstellt_von uuid NOT NULL,
  erstellt_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  abgeschlossen_von uuid,
  abgeschlossen_am timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, stichtag, id),
  CHECK (
    (art = 'stichtag' AND ursprung_id IS NULL AND nachtrag_grund IS NULL)
    OR (art = 'nachtrag' AND ursprung_id IS NOT NULL AND ursprung_id <> id
      AND nachtrag_grund IS NOT NULL AND btrim(nachtrag_grund) <> '')
  ),
  CHECK ((status = 'abgeschlossen' AND abgeschlossen_von IS NOT NULL AND abgeschlossen_am IS NOT NULL)
    OR (status <> 'abgeschlossen' AND abgeschlossen_von IS NULL AND abgeschlossen_am IS NULL)),
  FOREIGN KEY (tenant_id, stichtag, ursprung_id)
    REFERENCES public.inventory_sessions (tenant_id, stichtag, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, erstellt_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, abgeschlossen_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX inventory_sessions_stichtag_key ON public.inventory_sessions (tenant_id, stichtag)
  WHERE art = 'stichtag';
CREATE UNIQUE INDEX inventory_sessions_offen_key ON public.inventory_sessions (tenant_id, stichtag)
  WHERE status IN ('offen','abschliessend');
CREATE INDEX inventory_sessions_abschluss_idx ON public.inventory_sessions (tenant_id, stichtag)
  WHERE art = 'stichtag' AND status = 'abgeschlossen';

ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_sessions_mandant ON public.inventory_sessions
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON TABLE public.inventory_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_sessions TO service_role;
