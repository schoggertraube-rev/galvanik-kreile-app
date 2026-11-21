-- PLAN_LADEZEIT M14: additive access paths; existing indexes and rights stay intact.
CREATE INDEX IF NOT EXISTS events_today_order_type_created_idx
  ON public.events (tenant_id, order_id, event_type, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS complaints_today_tenant_order_idx
  ON public.complaints (tenant_id, order_id);
CREATE INDEX IF NOT EXISTS invoices_today_tenant_customer_idx
  ON public.invoices (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS payments_today_invoice_idx
  ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS communication_messages_today_thread_idx
  ON public.communication_messages (tenant_id, thread_id);
