-- P66(5): stale browser tabs must never overwrite an intake draft.
-- Existing drafts are the first readable revision (0); every later write increments it.
ALTER TABLE private.intake_drafts
  ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK (version >= 0);

COMMENT ON COLUMN private.intake_drafts.version IS
  'Optimistic concurrency revision for a private intake draft; 0 is the first persisted revision.';
