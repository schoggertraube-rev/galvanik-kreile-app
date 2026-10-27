-- A-56: Stufe 1 kennt nur Gewerbe und Privat.
-- Historische Institutionen sind fachlich Gewerbekunden; unveränderliche
-- Belege bleiben als Nachweis bestehen.
UPDATE public.customers
SET type = 'business',
    updated_at = statement_timestamp()
WHERE type = 'institution';
