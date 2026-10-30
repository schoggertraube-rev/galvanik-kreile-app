UPDATE public.customers
SET payment_preference = NULL,
    updated_at = statement_timestamp()
WHERE tenant_id = 'galvanik-kreile'
  AND customer_number IN ('K-2026-0001', 'K-2026-0011', 'K-2026-0012');
