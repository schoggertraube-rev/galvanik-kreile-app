-- A-25: the refresh lease must fit the bounded Vercel runtime budget.
ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_today_refresh_lease_ceiling
  CHECK (today_refresh_lease_seconds <= 240);
