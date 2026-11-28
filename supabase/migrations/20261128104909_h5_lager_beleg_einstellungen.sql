ALTER TABLE public.company_settings
  ADD COLUMN lager_beleg_preisabweichung_prozent numeric
    CONSTRAINT company_settings_lager_beleg_preisabweichung_check
    CHECK (lager_beleg_preisabweichung_prozent >= 0 AND lager_beleg_preisabweichung_prozent < 'Infinity'::numeric),
  ADD COLUMN lager_beleg_abgleich_tage integer
    CONSTRAINT company_settings_lager_beleg_abgleich_tage_check
    CHECK (lager_beleg_abgleich_tage > 0);
