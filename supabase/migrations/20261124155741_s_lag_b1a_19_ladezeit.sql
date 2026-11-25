CREATE INDEX IF NOT EXISTS stock_movements_lager_liste_idx
  ON public.stock_movements (tenant_id, created_at DESC NULLS LAST, id)
  WHERE inventory_item_id IS NOT NULL AND w1_original_id IS NULL;
CREATE INDEX IF NOT EXISTS stock_movements_lager_artikel_liste_idx
  ON public.stock_movements (tenant_id, inventory_item_id, created_at DESC NULLS LAST, id)
  WHERE inventory_item_id IS NOT NULL AND w1_original_id IS NULL;
CREATE INDEX IF NOT EXISTS stock_movements_lager_auftrag_idx
  ON public.stock_movements (tenant_id, order_id, id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_sessions_lager_status_idx
  ON public.inventory_sessions (tenant_id, status, id);
