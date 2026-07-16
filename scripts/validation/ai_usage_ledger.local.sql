\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_first record;
  v_settled record;
  v_replay record;
  v_limited record;
  v_invalid_rejected boolean := false;
BEGIN
  SELECT * INTO v_first
  FROM public.reserve_ai_usage(
    'galvanik-kreile-validation',
    'validation-user',
    'notes-extract',
    repeat('a', 64),
    100,
    60,
    1,
    10,
    1000,
    10000
  );
  IF NOT v_first.allowed OR v_first.replay OR v_first.reservation_id IS NULL THEN
    RAISE EXCEPTION 'first reservation was not admitted';
  END IF;

  IF public.claim_ai_usage_reservation(
    v_first.reservation_id,
    'galvanik-kreile-validation',
    'wrong-user',
    'notes-extract'
  ) THEN
    RAISE EXCEPTION 'identity-mismatched claim was accepted';
  END IF;
  IF NOT public.claim_ai_usage_reservation(
    v_first.reservation_id,
    'galvanik-kreile-validation',
    'validation-user',
    'notes-extract'
  ) THEN
    RAISE EXCEPTION 'bound claim was rejected';
  END IF;
  IF public.claim_ai_usage_reservation(
    v_first.reservation_id,
    'galvanik-kreile-validation',
    'validation-user',
    'notes-extract'
  ) THEN
    RAISE EXCEPTION 'reservation was claimable twice';
  END IF;

  SELECT * INTO v_settled
  FROM public.settle_ai_usage_reservation(
    v_first.reservation_id,
    'galvanik-kreile-validation',
    'validation-user',
    'notes-extract',
    'succeeded',
    80,
    'validation-provider:200',
    '{"result":"verified"}'::jsonb
  );
  IF NOT v_settled.changed OR v_settled.usage_status <> 'succeeded' THEN
    RAISE EXCEPTION 'successful settlement did not become terminal';
  END IF;

  SELECT * INTO v_settled
  FROM public.settle_ai_usage_reservation(
    v_first.reservation_id,
    'galvanik-kreile-validation',
    'validation-user',
    'notes-extract',
    'failed',
    NULL,
    'late-failure',
    NULL
  );
  IF v_settled.changed OR v_settled.usage_status <> 'succeeded' THEN
    RAISE EXCEPTION 'terminal settlement was not monotone/idempotent';
  END IF;

  SELECT * INTO v_replay
  FROM public.reserve_ai_usage(
    'galvanik-kreile-validation',
    'validation-user',
    'notes-extract',
    repeat('a', 64),
    100,
    60,
    1,
    10,
    1000,
    10000
  );
  IF NOT v_replay.allowed OR NOT v_replay.replay OR v_replay.replay_result <> '{"result":"verified"}'::jsonb THEN
    RAISE EXCEPTION 'completed request was not replayed';
  END IF;

  SELECT * INTO v_limited
  FROM public.reserve_ai_usage(
    'galvanik-kreile-validation',
    'validation-user',
    'notes-extract',
    repeat('b', 64),
    100,
    60,
    1,
    10,
    1000,
    10000
  );
  IF v_limited.allowed OR v_limited.decision_reason <> 'user_window' THEN
    RAISE EXCEPTION 'user window limit was not enforced';
  END IF;

  BEGIN
    PERFORM * FROM public.reserve_ai_usage(
      'galvanik-kreile-validation',
      'validation-user',
      NULL,
      repeat('c', 64),
      100,
      60,
      1,
      10,
      1000,
      10000
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'INVALID_AI_USAGE_POLICY' THEN
      v_invalid_rejected := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_invalid_rejected THEN
    RAISE EXCEPTION 'NULL feature bypassed policy validation';
  END IF;
END;
$$;

ROLLBACK;
