ALTER TABLE public.scan_uploads
  ADD COLUMN IF NOT EXISTS upload_claim_token text,
  ADD COLUMN IF NOT EXISTS upload_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_scan_uploads_cleanup_lease
  ON public.scan_uploads (upload_claimed_at)
  WHERE status = 'cleanup_claimed';
