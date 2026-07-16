\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_job_id uuid := '11111111-1111-4111-8111-111111111111';
  v_other_job_id uuid := '22222222-2222-4222-8222-222222222222';
  v_first record;
  v_claim record;
  v_settle record;
  v_replay record;
  v_duplicate record;
  v_limited record;
  v_invalid_rejected boolean := false;
BEGIN
  SELECT * INTO v_first
  FROM public.reserve_item_photo_job(
    v_job_id,
    'galvanik-kreile',
    'validation-user',
    'order-validation',
    'item-validation',
    repeat('a', 64),
    repeat('b', 64),
    'galvanik-kreile/order-validation/item-validation/11111111-1111-4111-8111-111111111111.jpg',
    'image/jpeg',
    1024,
    60,
    10,
    1,
    10485760,
    10,
    20,
    2,
    4
  );
  IF NOT v_first.allowed OR NOT v_first.upload_required OR v_first.job_id <> v_job_id THEN
    RAISE EXCEPTION 'first photo job was not reserved';
  END IF;

  IF public.bind_item_photo_upload(v_job_id, 'galvanik-kreile', 'wrong-user') THEN
    RAISE EXCEPTION 'identity-mismatched upload bind was accepted';
  END IF;
  IF NOT public.bind_item_photo_upload(v_job_id, 'galvanik-kreile', 'validation-user') THEN
    RAISE EXCEPTION 'bound upload was rejected';
  END IF;

  SELECT * INTO v_claim FROM public.claim_item_photo_analysis(v_job_id);
  IF NOT v_claim.claimed OR v_claim.replay OR v_claim.job_status <> 'in_flight' THEN
    RAISE EXCEPTION 'first analysis claim failed';
  END IF;
  SELECT * INTO v_claim FROM public.claim_item_photo_analysis(v_job_id);
  IF v_claim.claimed OR v_claim.replay OR v_claim.job_status <> 'in_flight' THEN
    RAISE EXCEPTION 'analysis was claimable twice';
  END IF;

  SELECT * INTO v_settle
  FROM public.settle_item_photo_analysis(
    v_job_id,
    'succeeded',
    75,
    'validation-provider:200',
    '{"material":"Stahl","confidence":0.9}'::jsonb
  );
  IF NOT v_settle.changed OR v_settle.job_status <> 'succeeded' THEN
    RAISE EXCEPTION 'photo analysis did not settle';
  END IF;
  SELECT * INTO v_settle
  FROM public.settle_item_photo_analysis(v_job_id, 'failed', NULL, 'late-failure', NULL);
  IF v_settle.changed OR v_settle.job_status <> 'succeeded' THEN
    RAISE EXCEPTION 'terminal photo job was downgraded';
  END IF;

  SELECT * INTO v_replay
  FROM public.reserve_item_photo_job(
    '33333333-3333-4333-8333-333333333333',
    'galvanik-kreile',
    'validation-user',
    'order-validation',
    'item-validation',
    repeat('a', 64),
    repeat('b', 64),
    'galvanik-kreile/order-validation/item-validation/33333333-3333-4333-8333-333333333333.jpg',
    'image/jpeg', 1024, 60, 10, 1, 10485760, 10, 20, 2, 4
  );
  IF NOT v_replay.allowed OR NOT v_replay.replay OR v_replay.replay_result IS NULL THEN
    RAISE EXCEPTION 'settled job was not replayed';
  END IF;

  SELECT * INTO v_duplicate
  FROM public.reserve_item_photo_job(
    '44444444-4444-4444-8444-444444444444',
    'galvanik-kreile',
    'other-user',
    'order-validation',
    'item-validation',
    repeat('c', 64),
    repeat('b', 64),
    'galvanik-kreile/order-validation/item-validation/44444444-4444-4444-8444-444444444444.jpg',
    'image/jpeg', 1024, 60, 10, 1, 10485760, 10, 20, 2, 4
  );
  IF v_duplicate.allowed OR v_duplicate.decision_reason <> 'duplicate_content' THEN
    RAISE EXCEPTION 'cross-user duplicate content was not rejected';
  END IF;

  SELECT * INTO v_limited
  FROM public.reserve_item_photo_job(
    v_other_job_id,
    'galvanik-kreile',
    'validation-user',
    'order-validation',
    'item-validation',
    repeat('d', 64),
    repeat('e', 64),
    'galvanik-kreile/order-validation/item-validation/22222222-2222-4222-8222-222222222222.jpg',
    'image/jpeg', 1024, 60, 10, 1, 10485760, 10, 20, 2, 4
  );
  IF v_limited.allowed OR v_limited.decision_reason <> 'item_limit' THEN
    RAISE EXCEPTION 'server-side item photo limit was not enforced';
  END IF;

  BEGIN
    PERFORM * FROM public.reserve_item_photo_job(
      '55555555-5555-4555-8555-555555555555',
      'galvanik-kreile',
      'validation-user',
      'order-validation',
      'item-other',
      repeat('f', 64),
      repeat('0', 64),
      'galvanik-kreile/order-validation/item-other/55555555-5555-4555-8555-555555555555.jpg',
      NULL,
      1024, 60, 10, 1, 10485760, 10, 20, 2, 4
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'INVALID_ITEM_PHOTO_POLICY' THEN
      v_invalid_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_invalid_rejected THEN
    RAISE EXCEPTION 'NULL MIME bypassed policy validation';
  END IF;
END;
$$;

ROLLBACK;
