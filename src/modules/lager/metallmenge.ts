type Dezimal = { wert: bigint; skala: number };

function dezimal(eingabe: string, vorzeichen: boolean): Dezimal {
  const muster = vorzeichen
    ? /^(-?)(0|[1-9][0-9]{0,19})(?:\.([0-9]{1,12}))?$/u
    : /^()(0|[1-9][0-9]{0,19})(?:\.([0-9]{1,12}))?$/u;
  const treffer = muster.exec(eingabe);
  if (!treffer || treffer[0] !== eingabe) throw new RangeError("INVALID_METAL_QUANTITY");
  const nachkomma = treffer[3] ?? "";
  return { wert: BigInt(treffer[1] + treffer[2] + nachkomma), skala: nachkomma.length };
}

function produkt(links: Dezimal, rechts: Dezimal, divisorSkala: number): string {
  const wert = links.wert * rechts.wert;
  const skala = links.skala + rechts.skala + divisorSkala;
  if (wert === BigInt(0) || skala === 0) return wert.toString();
  const negativ = wert < BigInt(0);
  const ziffern = (negativ ? -wert : wert).toString().padStart(skala + 1, "0");
  const ganz = ziffern.slice(0, -skala);
  const rest = ziffern.slice(-skala).replace(/0+$/u, "");
  return `${negativ ? "-" : ""}${ganz}${rest ? `.${rest}` : ""}`;
}

/** Die Masse wurde zuvor über einen belegten Mengenweg in Gramm ermittelt. */
export function feinmetallAusBewegung(
  massenDeltaGramm: string | null,
  feingehaltProzent: string | null,
): string | null {
  const masse = massenDeltaGramm === null ? null : dezimal(massenDeltaGramm, true);
  const gehalt = feingehaltProzent === null ? null : dezimal(feingehaltProzent, false);
  if (gehalt && gehalt.wert > BigInt(100) * BigInt(10) ** BigInt(gehalt.skala)) {
    throw new RangeError("INVALID_METAL_PURITY");
  }
  return masse && gehalt ? produkt(masse, gehalt, 2) : null;
}

/** Konzentration und Volumen stammen aus derselben dokumentierten Analyse. */
export function feinmetallAusBadanalyse(
  grammProLiter: string | null,
  volumenLiter: string | null,
): string | null {
  const konzentration = grammProLiter === null ? null : dezimal(grammProLiter, false);
  const volumen = volumenLiter === null ? null : dezimal(volumenLiter, false);
  return konzentration && volumen ? produkt(konzentration, volumen, 0) : null;
}
