\set ON_ERROR_STOP on

DO $validation$
DECLARE
  v_tenant constant text := 'galvanik-kreile';
  v_actor uuid;
  v_other_actor uuid;
  v_account uuid;
  v_cost_center uuid;
  v_customer text;
  v_clean_period uuid := gen_random_uuid();
  v_blocked_period uuid := gen_random_uuid();
  v_receipt uuid := gen_random_uuid();
  v_invoice uuid := gen_random_uuid();
  v_invoice_position uuid := gen_random_uuid();
  v_preliminary_request uuid := gen_random_uuid();
  v_final_request uuid := gen_random_uuid();
  v_status text;
  v_replayed boolean;
BEGIN
  SELECT id INTO v_actor
  FROM public.app_users
  WHERE tenant_id = v_tenant
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_other_actor
  FROM public.app_users
  WHERE tenant_id = v_tenant AND id <> v_actor
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_account FROM public.konto ORDER BY id LIMIT 1;
  SELECT id INTO v_cost_center FROM public.kostenstelle ORDER BY id LIMIT 1;
  SELECT id INTO v_customer
  FROM public.customers
  WHERE tenant_id = v_tenant
  ORDER BY id
  LIMIT 1;

  IF v_actor IS NULL
     OR v_other_actor IS NULL
     OR v_account IS NULL
     OR v_cost_center IS NULL
     OR v_customer IS NULL THEN
    RAISE EXCEPTION 'Period validation prerequisites are missing';
  END IF;

  INSERT INTO public.periode (id, tenant_id, jahr, monat, status)
  VALUES
    (v_clean_period, v_tenant, 2098, 1, 'offen'),
    (v_blocked_period, v_tenant, 2098, 2, 'offen');

  INSERT INTO public.orders (
    id, tenant_id, order_number, customer_id, title, station, status
  ) VALUES (
    'validation-period-order',
    v_tenant,
    'VALIDATION-PERIOD-ORDER',
    v_customer,
    'Period validation',
    'wareneingang',
    'in_progress'
  );

  INSERT INTO public.beleg (
    id,
    belegdatum,
    original_datei,
    erstellt_von,
    status,
    konto_id,
    kostenstelle_id,
    periode_id
  ) VALUES (
    v_receipt,
    '2098-01-10',
    'validation/period/receipt.pdf',
    v_actor,
    'festgeschrieben',
    v_account,
    v_cost_center,
    v_clean_period
  );

  INSERT INTO public.beleg_position (beleg_id, beschreibung, netto)
  VALUES (v_receipt, 'Validation position', 10);

  INSERT INTO public.ausgangsrechnung (
    id,
    nummer,
    kunde_id,
    datum,
    brutto,
    status,
    order_id,
    periode_id,
    tenant_id
  ) VALUES (
    v_invoice,
    'VALIDATION-PERIOD-INVOICE',
    v_customer,
    '2098-01-11',
    119,
    'offen',
    'validation-period-order',
    v_clean_period,
    v_tenant
  );

  INSERT INTO public.ausgangsrechnung_position (
    id, ausgangsrechnung_id, beschreibung, menge, einzelpreis_netto
  ) VALUES (
    v_invoice_position,
    v_invoice,
    'Validation invoice position',
    1,
    100
  );

  SELECT status, replayed INTO v_status, v_replayed
  FROM public.finance_close_period(
    v_clean_period,
    'vorlaeufig_geschlossen',
    v_actor,
    v_preliminary_request
  );
  IF v_status <> 'vorlaeufig_geschlossen' OR v_replayed THEN
    RAISE EXCEPTION 'Preliminary close was not confirmed';
  END IF;

  SELECT status, replayed INTO v_status, v_replayed
  FROM public.finance_close_period(
    v_clean_period,
    'vorlaeufig_geschlossen',
    v_actor,
    v_preliminary_request
  );
  IF v_status <> 'vorlaeufig_geschlossen' OR NOT v_replayed THEN
    RAISE EXCEPTION 'Exact replay was not confirmed';
  END IF;

  BEGIN
    PERFORM *
    FROM public.finance_close_period(
      v_clean_period,
      'vorlaeufig_geschlossen',
      v_other_actor,
      v_preliminary_request
    );
    RAISE EXCEPTION 'EXPECTED_ACTOR_REPLAY_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_ACTOR_REPLAY_REJECTION'
       OR SQLERRM NOT LIKE 'IDEMPOTENCY_KEY_REUSE%' THEN
      RAISE;
    END IF;
  END;

  PERFORM *
  FROM public.finance_close_period(
    v_clean_period,
    'final_geschlossen',
    v_actor,
    v_final_request
  );

  BEGIN
    INSERT INTO public.beleg (
      belegdatum, original_datei, erstellt_von, status
    ) VALUES (
      '2098-01-20',
      'validation/period/late-receipt.pdf',
      v_actor,
      'festgeschrieben'
    );
    RAISE EXCEPTION 'EXPECTED_UNASSIGNED_RECEIPT_FINAL_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_UNASSIGNED_RECEIPT_FINAL_REJECTION'
       OR SQLERRM NOT LIKE 'FINAL_PERIOD_IMMUTABLE%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO public.ausgangsrechnung (
      nummer, kunde_id, datum, brutto, status, tenant_id
    ) VALUES (
      'VALIDATION-PERIOD-LATE-INVOICE',
      v_customer,
      '2098-01-21',
      20,
      'offen',
      v_tenant
    );
    RAISE EXCEPTION 'EXPECTED_UNASSIGNED_INVOICE_FINAL_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_UNASSIGNED_INVOICE_FINAL_REJECTION'
       OR SQLERRM NOT LIKE 'FINAL_PERIOD_IMMUTABLE%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO public.beleg_position (beleg_id, beschreibung, netto)
    VALUES (v_receipt, 'Late position', 1);
    RAISE EXCEPTION 'EXPECTED_RECEIPT_CHILD_FINAL_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_RECEIPT_CHILD_FINAL_REJECTION'
       OR SQLERRM NOT LIKE 'FINAL_PERIOD_IMMUTABLE%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.ausgangsrechnung_position
    SET einzelpreis_netto = 101
    WHERE id = v_invoice_position;
    RAISE EXCEPTION 'EXPECTED_INVOICE_CHILD_FINAL_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_INVOICE_CHILD_FINAL_REJECTION'
       OR SQLERRM NOT LIKE 'FINAL_PERIOD_IMMUTABLE%' THEN
      RAISE;
    END IF;
  END;

  UPDATE public.ausgangsrechnung
  SET
    status = 'bezahlt',
    bezahlt_am = '2098-02-01',
    bezahlt_methode = 'banktransfer',
    bezahlt_betrag_eur = brutto
  WHERE id = v_invoice;

  BEGIN
    UPDATE public.ausgangsrechnung
    SET status = 'offen'
    WHERE id = v_invoice;
    RAISE EXCEPTION 'EXPECTED_PAYMENT_REVERSAL_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_PAYMENT_REVERSAL_REJECTION'
       OR SQLERRM NOT LIKE 'FINAL_PERIOD_IMMUTABLE%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.ausgangsrechnung
    SET mahnstufe = coalesce(mahnstufe, 0) + 1
    WHERE id = v_invoice;
    RAISE EXCEPTION 'EXPECTED_FINAL_DUNNING_MUTATION_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_FINAL_DUNNING_MUTATION_REJECTION'
       OR SQLERRM NOT LIKE 'FINAL_PERIOD_IMMUTABLE%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    INSERT INTO public.orders (
      id,
      tenant_id,
      order_number,
      customer_id,
      title,
      station,
      status,
      completed_date
    ) VALUES (
      'validation-period-late-order',
      v_tenant,
      'VALIDATION-PERIOD-LATE-ORDER',
      v_customer,
      'Late final-period order',
      'wareneingang',
      'completed',
      '2098-01-31T23:30:00+01'::timestamptz
    );
    RAISE EXCEPTION 'EXPECTED_FINAL_ORDER_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_FINAL_ORDER_REJECTION'
       OR SQLERRM NOT LIKE 'FINAL_PERIOD_IMMUTABLE%' THEN
      RAISE;
    END IF;
  END;

  INSERT INTO public.beleg (
    belegdatum, original_datei, erstellt_von, status
  ) VALUES (
    '2098-02-10',
    'validation/period/unassigned-blocker.pdf',
    v_actor,
    'festgeschrieben'
  );

  BEGIN
    PERFORM *
    FROM public.finance_close_period(
      v_blocked_period,
      'vorlaeufig_geschlossen',
      v_actor,
      gen_random_uuid()
    );
    RAISE EXCEPTION 'EXPECTED_UNASSIGNED_BLOCKER_REJECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EXPECTED_UNASSIGNED_BLOCKER_REJECTION'
       OR SQLERRM NOT LIKE 'PERIOD_CLOSE_BLOCKED:%' THEN
      RAISE;
    END IF;
  END;
END
$validation$;

SELECT 'period_close_foundation_ok' AS result;
