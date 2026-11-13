-- S05K A1, PL 12.11 19:45: technical continuation per configured mailbox.
-- Values are written only by the existing authenticated mailbox synchronization.
ALTER TABLE public.company_settings
  ADD COLUMN mailbox_fetch_state jsonb,
  ADD CONSTRAINT company_settings_mailbox_fetch_state_object
    CHECK (mailbox_fetch_state IS NULL OR jsonb_typeof(mailbox_fetch_state)='object');
COMMENT ON COLUMN public.company_settings.mailbox_fetch_state IS
  'Mailbox-keyed Graph continuation URL and saved timestamp; expires after 24 hours. No credentials.';
