DO $migration$
DECLARE
  settings_row record;
  legacy_days jsonb;
  closed_day date;
  covered boolean;
  day_text text;
  period jsonb;
  period_start date;
  period_end date;
  appended_periods jsonb;
BEGIN
  FOR settings_row IN
    SELECT id, ausgang_regeln, betriebsruhe
    FROM public.company_settings
    WHERE ausgang_regeln ? 'holidays'
    FOR UPDATE
  LOOP
    legacy_days := settings_row.ausgang_regeln -> 'holidays';
    IF jsonb_typeof(legacy_days) <> 'array' THEN
      RAISE EXCEPTION 'P12_DISPATCH_HOLIDAYS_INVALID';
    END IF;
    IF jsonb_array_length(legacy_days) > 366 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(legacy_days) AS legacy(day)
      WHERE jsonb_typeof(legacy.day) <> 'string'
    ) OR (
      SELECT count(DISTINCT legacy.day) FROM jsonb_array_elements(legacy_days) AS legacy(day)
    ) <> jsonb_array_length(legacy_days) THEN
      RAISE EXCEPTION 'P12_DISPATCH_HOLIDAYS_INVALID';
    END IF;

    FOR period IN SELECT value FROM jsonb_array_elements(settings_row.betriebsruhe) LOOP
      IF jsonb_typeof(period) IS DISTINCT FROM 'object'
        OR jsonb_typeof(period -> 'von') IS DISTINCT FROM 'string'
        OR jsonb_typeof(period -> 'bis') IS DISTINCT FROM 'string'
        OR (period ->> 'von') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR (period ->> 'bis') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RAISE EXCEPTION 'P12_COMPANY_CLOSURE_INVALID';
      END IF;
      period_start := (period ->> 'von')::date;
      period_end := (period ->> 'bis')::date;
      IF period_start < DATE '0100-01-01' OR period_start > period_end THEN
        RAISE EXCEPTION 'P12_COMPANY_CLOSURE_INVALID';
      END IF;
    END LOOP;

    appended_periods := '[]'::jsonb;
    FOR day_text IN SELECT value FROM jsonb_array_elements_text(legacy_days) ORDER BY value LOOP
      IF day_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        RAISE EXCEPTION 'P12_DISPATCH_HOLIDAY_INVALID';
      END IF;
      closed_day := day_text::date;
      IF closed_day < DATE '0100-01-01' THEN
        RAISE EXCEPTION 'P12_DISPATCH_HOLIDAY_INVALID';
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(settings_row.betriebsruhe) AS existing(period)
        WHERE closed_day BETWEEN (existing.period ->> 'von')::date AND (existing.period ->> 'bis')::date
      ) INTO covered;
      IF NOT covered THEN
        appended_periods := appended_periods || jsonb_build_array(jsonb_build_object('von', day_text, 'bis', day_text));
      END IF;
    END LOOP;

    UPDATE public.company_settings
    SET betriebsruhe = settings_row.betriebsruhe || appended_periods,
        ausgang_regeln = settings_row.ausgang_regeln - 'holidays',
        updated_at = statement_timestamp()
    WHERE id = settings_row.id;
  END LOOP;
END
$migration$;
