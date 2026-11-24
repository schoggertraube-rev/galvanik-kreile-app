CREATE INDEX company_settings_spur_d_mandant_idx
  ON public.company_settings (tenant_id);
CREATE INDEX orders_spur_d_offene_zusage_idx
  ON public.orders (tenant_id, promised_due_date)
  WHERE completed_date IS NULL;
CREATE INDEX orders_spur_d_analyse_eingang_idx
  ON public.orders (tenant_id, created_at);
CREATE INDEX orders_spur_d_analyse_abschluss_idx
  ON public.orders (tenant_id, completed_date)
  WHERE completed_date IS NOT NULL;
CREATE INDEX orders_spur_d_station_idx
  ON public.orders (tenant_id, station);
