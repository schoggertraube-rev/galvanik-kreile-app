CREATE INDEX IF NOT EXISTS inventory_items_lager_liste_idx
  ON public.inventory_items (tenant_id, name, id);
CREATE INDEX IF NOT EXISTS inventory_items_lager_status_idx
  ON public.inventory_items (tenant_id, stamm_status, id);
CREATE INDEX IF NOT EXISTS material_prices_lager_leser_idx
  ON public.material_prices (tenant_id, artikel_id, waehrung, gueltig_ab DESC, erfasst_am DESC, id)
  WHERE bestaetigt_am IS NOT NULL AND storniert_am IS NULL AND fehlpreis_am IS NULL;
CREATE INDEX IF NOT EXISTS stock_locations_lager_liste_idx
  ON public.stock_locations (tenant_id, stockwerk, bereich, id) WHERE aktiv IS TRUE;
CREATE INDEX IF NOT EXISTS tasks_lager_entwurf_heute_idx
  ON public.tasks (tenant_id, faellig_am, id) INCLUDE (bezug_id, titel)
  WHERE bezug_typ = 'lagerartikel' AND fuer_bereich = 'lager.stamm' AND status = 'offen';
