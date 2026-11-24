-- Der E3-Positionsschreiber übernimmt Satz und Grund aus derselben U10-Prüfung.
-- NULL erhält die bestätigten Altpositionen und steht bei neuen Regelpositionen für keinen Grund.
ALTER TABLE public.items
  ADD COLUMN vat_reduction_reason text,
  ADD CONSTRAINT items_vat_reduction_reason_chk CHECK (
    vat_reduction_reason IS NULL OR (
      vat_rate_basis_points IS NOT NULL
      AND vat_rate_basis_points > 0
      AND vat_reduction_reason ~ '[^[:space:]]'
    )
  );

COMMENT ON COLUMN public.items.vat_reduction_reason IS
  'U10: Pflichtgrund bei ermäßigter Steuer in einer neuen Position, zusammen mit dem bestätigten Satz gespeichert.';
