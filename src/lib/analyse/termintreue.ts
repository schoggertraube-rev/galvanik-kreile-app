type TermintreueBeleg = Readonly<{ termintreue_pct: number | null; nenner: number }>;

/** Null Prozent ist ein Messwert, wenn mindestens ein Abschluss messbar war. */
export function belegteTermintreue(stand: TermintreueBeleg | null | undefined): number | null {
  if (!stand || !Number.isSafeInteger(stand.nenner) || stand.nenner < 1) return null;
  const wert = stand.termintreue_pct;
  return wert !== null && Number.isFinite(wert) && wert >= 0 && wert <= 100 ? wert : null;
}
