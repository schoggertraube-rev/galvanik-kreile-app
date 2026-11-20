-- PL20.11.15:36/15:43 L1: existing company settings, no new data truth.
ALTER TABLE public.company_settings
  ADD COLUMN seiten_abfrage_ms integer NOT NULL DEFAULT 10000
    CHECK (seiten_abfrage_ms > 0),
  ADD COLUMN rechnung_mail_grenze integer NOT NULL DEFAULT 101
    CHECK (rechnung_mail_grenze > 0);
