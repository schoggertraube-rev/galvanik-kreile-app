-- V5: Der vorhandene Leistungskatalog darf eine offene Standard-Durchlaufzeit enthalten.
ALTER TABLE public.catalog_services
  ALTER COLUMN standard_lead_time_working_days DROP NOT NULL,
  ALTER COLUMN standard_lead_time_working_days DROP DEFAULT;
