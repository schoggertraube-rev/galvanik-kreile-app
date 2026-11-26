ALTER TABLE private.today_preferences
  ADD COLUMN own_note jsonb,
  ADD CONSTRAINT today_preferences_own_note_v1_chk CHECK (
    own_note IS NULL OR (
      jsonb_typeof(own_note) = 'object'
      AND own_note ?& ARRAY['text', 'clientRequestId', 'capturedAt', 'savedAt']
      AND jsonb_typeof(own_note -> 'text') = 'string'
      AND char_length(own_note ->> 'text') <= 4000
      AND jsonb_typeof(own_note -> 'clientRequestId') = 'string'
      AND jsonb_typeof(own_note -> 'capturedAt') = 'string'
      AND jsonb_typeof(own_note -> 'savedAt') = 'string'
    )
  );

CREATE UNIQUE INDEX today_own_note_once
  ON public.ui_events (tenant_id, (payload ->> 'actorId'), (payload ->> 'clientRequestId'))
  WHERE event_type = 'today_own_note_saved';
