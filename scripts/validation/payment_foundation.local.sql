\set ON_ERROR_STOP on

DO $validation$
DECLARE
  v_tenant constant text := 'galvanik-kreile';
  v_customer constant text := 'validation-payment-customer';
  v_order constant text := 'validation-payment-order';
  v_foreign_order constant text := 'validation-payment-foreign-order';
  v_attempt uuid := gen_random_uuid();
  v_foreign_attempt uuid := gen_random_uuid();
  v_quote record;
  v_reservation record;
  v_first_finalize record;
  v_replay_finalize record;
BEGIN
  INSERT INTO public.customers (id, tenant_id, name, type)
  VALUES (v_customer, v_tenant, 'Validation Customer', 'business');

  INSERT INTO public.orders (
    id, tenant_id, order_number, customer_id, title, station, status
  ) VALUES
    (
      v_order,
      v_tenant,
      'VALIDATION-PAYMENT-ORDER',
      v_customer,
      'Payment validation',
      'wareneingang',
      'in_progress'
    ),
    (
      v_foreign_order,
      v_tenant,
      'VALIDATION-PAYMENT-FOREIGN',
      v_customer,
      'Foreign provider validation',
      'wareneingang',
      'in_progress'
    );

  INSERT INTO public.price_lines (
    tenant_id, order_id, position_text, qty, unit_price_eur
  ) VALUES
    (v_tenant, v_order, 'Validation line', 1, 123.45),
    (v_tenant, v_foreign_order, 'Validation line', 1, 10);

  SELECT * INTO v_quote
  FROM public.get_mollie_payment_quote(v_tenant, v_order);

  BEGIN
    PERFORM *
    FROM public.reserve_mollie_payment_attempt(
      gen_random_uuid(),
      v_tenant,
      v_order,
      NULL,
      v_quote.quote_digest,
      repeat('a', 64)
    );
    RAISE EXCEPTION 'EXPECTED_NULL_RESERVATION_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_NULL_RESERVATION_REJECTION'
       OR SQLERRM NOT LIKE 'INVALID_PAYMENT_RESERVATION%' THEN
      RAISE;
    END IF;
  END;

  SELECT * INTO v_reservation
  FROM public.reserve_mollie_payment_attempt(
    v_attempt,
    v_tenant,
    v_order,
    v_quote.amount_cents,
    v_quote.quote_digest,
    repeat('a', 64)
  );

  IF NOT v_reservation.was_created OR v_reservation.payment_id <> v_attempt THEN
    RAISE EXCEPTION 'Payment reservation was not durably created';
  END IF;

  BEGIN
    UPDATE public.price_lines
    SET unit_price_eur = 99
    WHERE tenant_id = v_tenant AND order_id = v_order;
    RAISE EXCEPTION 'EXPECTED_ACTIVE_QUOTE_LOCK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_ACTIVE_QUOTE_LOCK'
       OR SQLERRM NOT LIKE 'ACTIVE_PAYMENT_LOCKS_QUOTE%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM public.bind_mollie_payment_provider(
      v_attempt,
      'tr_validationpayment',
      'open',
      NULL,
      v_quote.quote_digest
    );
    RAISE EXCEPTION 'EXPECTED_NULL_BINDING_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_NULL_BINDING_REJECTION'
       OR SQLERRM NOT LIKE 'INVALID_PROVIDER_BINDING%' THEN
      RAISE;
    END IF;
  END;

  PERFORM public.bind_mollie_payment_provider(
    v_attempt,
    'tr_validationpayment',
    'open',
    v_quote.amount_cents,
    v_quote.quote_digest
  );

  SELECT * INTO v_first_finalize
  FROM public.finalize_mollie_payment(
    'tr_validationpayment',
    'paid',
    'banktransfer',
    '2099-07-15T12:00:00Z'::timestamptz,
    v_order,
    v_tenant,
    v_quote.amount_cents,
    v_quote.quote_digest
  );

  SELECT * INTO v_replay_finalize
  FROM public.finalize_mollie_payment(
    'tr_validationpayment',
    'paid',
    'banktransfer',
    '2099-07-15T12:00:00Z'::timestamptz,
    v_order,
    v_tenant,
    v_quote.amount_cents,
    v_quote.quote_digest
  );

  IF NOT v_first_finalize.created
     OR v_replay_finalize.created
     OR v_first_finalize.invoice_id IS DISTINCT FROM v_replay_finalize.invoice_id THEN
    RAISE EXCEPTION 'Payment finalization replay is not exact';
  END IF;

  BEGIN
    UPDATE public.price_lines
    SET unit_price_eur = 99
    WHERE tenant_id = v_tenant AND order_id = v_order;
    RAISE EXCEPTION 'EXPECTED_COMPLETED_QUOTE_LOCK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_COMPLETED_QUOTE_LOCK'
       OR SQLERRM NOT LIKE 'ACTIVE_PAYMENT_LOCKS_QUOTE%' THEN
      RAISE;
    END IF;
  END;

  INSERT INTO public.payments (
    id, tenant_id, order_id, amount_eur, status, provider, created_at
  ) VALUES (
    v_foreign_attempt,
    v_tenant,
    v_foreign_order,
    10,
    'pending',
    'foreign-provider',
    now()
  );

  SELECT * INTO v_quote
  FROM public.get_mollie_payment_quote(v_tenant, v_foreign_order);

  BEGIN
    PERFORM *
    FROM public.reserve_mollie_payment_attempt(
      gen_random_uuid(),
      v_tenant,
      v_foreign_order,
      v_quote.amount_cents,
      v_quote.quote_digest,
      repeat('b', 64)
    );
    RAISE EXCEPTION 'EXPECTED_FOREIGN_PROVIDER_CONFLICT';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_FOREIGN_PROVIDER_CONFLICT'
       OR SQLERRM NOT LIKE 'PAYMENT_ACTIVE_PROVIDER_CONFLICT%' THEN
      RAISE;
    END IF;
  END;
END
$validation$;

SELECT 'payment_foundation_ok' AS result;
